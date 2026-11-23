-- CarreApp · migración 0036: las carreras como ediciones con código, la carrera de prueba permanente, "Finalizada" y sin eliminar.
--  * events.code: el código de la edición, 2710, 2730, 2810… (año de dos cifras + 10 primer semestre / 30 segundo). Lo genera la base de datos
--    (next_event_code / create_event): el coordi no lo escribe.
--  * events.is_test: UNA carrera de prueba, siempre disponible. No se puede eliminar ni dejar de serlo.
--  * Nuevo estado "archived" (Finalizada): la carrera se cierra y pasa al historial CONSERVANDO todos sus datos (a diferencia de deshabilitar,
--    que vuelve a la configuración y reinicia el avance). Se puede reabrir.
--  * Las carreras no se eliminan desde la app: se finalizan. (Quien tenga acceso al SQL puede, salvo la de prueba.)
--  * public.badges: las insignias (el logo de cada grupo de carreras: la plantita de Biomec, etc.) como catálogo GLOBAL: nombre, imagen,
--    disponibilidad. No son sellos.
-- La carrera que hoy se llama "Carrera 2710" tiene datos de prueba: pasa a ser la carrera de prueba y se crea la 2710 real, vacía.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.events
  add column if not exists code text,
  add column if not exists is_test boolean not null default false;
create unique index if not exists events_code_unique on public.events (code) where code is not null;
create unique index if not exists events_one_test on public.events (is_test) where is_test;
alter table public.events drop constraint if exists events_code_format;
alter table public.events add constraint events_code_format check (code is null or is_test or code ~ '^[0-9]{4}$');

alter table public.events drop constraint if exists events_phase_check;
alter table public.events add constraint events_phase_check check (phase in ('disabled', 'enabled', 'started', 'finished', 'archived'));

-- the test Carrera is permanent: it is never deleted and never stops being the test one
create or replace function public.events_protect_test() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_test then raise exception 'La carrera de prueba es permanente: no se puede eliminar.'; end if;
    -- a Carrera is not deleted from the app: it is finished and stays in the history (only direct access to the database can)
    if current_user in ('authenticated', 'anon') then raise exception 'Las carreras no se eliminan: se finalizan y quedan en el historial.'; end if;
    return old;
  end if;
  if old.is_test and not new.is_test then raise exception 'La carrera de prueba siempre debe existir.'; end if;
  return new;
end;
$$;
drop trigger if exists events_protect_test on public.events;
create trigger events_protect_test before update or delete on public.events
  for each row execute function public.events_protect_test();

-- phases: add archived (Finalizada). is_active = the Carrera is open to the phones (not draft, not in the history).
create or replace function public.events_sync_phase() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.phase not in ('disabled', 'archived') then new.is_active := true;
    elsif new.is_active then new.phase := 'started';
    end if;
  elsif new.phase is distinct from old.phase then
    if not ((old.phase, new.phase) in (
      ('disabled', 'enabled'), ('disabled', 'started'), ('enabled', 'started'), ('enabled', 'disabled'),
      ('started', 'finished'), ('started', 'disabled'), ('finished', 'disabled'), ('finished', 'enabled'),
      ('finished', 'archived'), ('archived', 'finished')
    )) then
      raise exception 'La carrera no puede pasar de "%" a "%".', old.phase, new.phase;
    end if;
    new.is_active := new.phase not in ('disabled', 'archived');
  elsif new.is_active is distinct from old.is_active then
    new.phase := case when new.is_active then 'started' else 'disabled' end;
  end if;

  if tg_op = 'INSERT' or new.phase is distinct from old.phase then
    if new.phase = 'started' then
      new.started_at := now();
      new.finished_at := null;
    elsif new.phase = 'finished' then
      new.finished_at := coalesce(new.finished_at, now());
    elsif new.phase = 'archived' then
      null; -- it keeps its times: it is the same Carrera, now closed
    else
      new.started_at := null;
      new.finished_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- finishing (archiving) keeps EVERYTHING: only a Carrera that goes back to draft resets its progress
create or replace function public.events_reset_on_deactivate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_active and not new.is_active and new.phase is distinct from 'archived' then
    perform public.reset_event_progress(new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.events_reset_on_deactivate() from public, anon, authenticated;

-- the codes: 2710, 2730, 2810, 2830, 2910… (there is no 20: the intersemestral is not a Carrera)
create or replace function public.next_event_code() returns text
language plpgsql stable security definer set search_path = public as $$
declare last text; yy int; half int;
begin
  select code into last from public.events where code ~ '^[0-9]{4}$' and not is_test order by code desc limit 1;
  if last is null then return '2710'; end if;
  yy := substr(last, 1, 2)::int;
  half := substr(last, 3, 2)::int;
  if half < 30 then return lpad(yy::text, 2, '0') || '30'; end if;
  return lpad(((yy + 1) % 100)::text, 2, '0') || '10';
end;
$$;
revoke all on function public.next_event_code() from public, anon;
grant execute on function public.next_event_code() to authenticated;

-- a new Carrera is an independent instance: empty (no groups, bases, users or schedule inherited), with the next code and its own semester
create or replace function public.create_event() returns uuid
language plpgsql security definer set search_path = public as $$
declare c text; t uuid; e uuid;
begin
  if not public.is_admin() then raise exception 'Solo el coordi puede crear carreras.'; end if;
  c := public.next_event_code();
  select id into t from public.terms where name = c;
  if t is null then
    insert into public.terms (name, theme) values (c, coalesce((select theme from public.terms where is_current limit 1), 'mitologias')) returning id into t;
  end if;
  insert into public.events (name, code, term_id) values ('Carrera ' || c, c, t) returning id into e;
  return e;
end;
$$;
revoke all on function public.create_event() from public, anon;
grant execute on function public.create_event() to authenticated;

-- the coordinator's moves (0032) + finalize / reopen; the test Carrera can be restarted from any open state
create or replace function public.event_action(p_event uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text; test boolean;
begin
  if not public.is_admin() then
    raise exception 'Solo el coordi puede cambiar el estado de la carrera.';
  end if;
  select phase, is_test into cur, test from public.events where id = p_event for update;
  if cur is null then raise exception 'La carrera no existe.'; end if;

  if p_action = 'enable' then
    if cur <> 'disabled' then raise exception 'La carrera ya está habilitada.'; end if;
    if exists (select 1 from public.events where is_active and id <> p_event) then
      raise exception 'Ya hay otra carrera activa: deshabilítala o finalízala primero.';
    end if;
    update public.events set phase = 'enabled' where id = p_event; -- the completeness check runs here
  elsif p_action = 'start' then
    if cur <> 'enabled' then raise exception 'Solo se puede iniciar una carrera habilitada.'; end if;
    update public.events set phase = 'started' where id = p_event;
  elsif p_action = 'finish' then
    if cur <> 'started' then raise exception 'Solo se puede terminar una carrera iniciada.'; end if;
    update public.events set phase = 'finished' where id = p_event;
  elsif p_action = 'archive' then
    if cur <> 'finished' then raise exception 'Solo se puede finalizar una carrera terminada.'; end if;
    update public.events set phase = 'archived' where id = p_event; -- to the history, with all its data
  elsif p_action = 'reopen' then
    if cur <> 'archived' then raise exception 'Solo se puede reabrir una carrera finalizada.'; end if;
    if exists (select 1 from public.events where is_active and id <> p_event) then
      raise exception 'Ya hay otra carrera activa: deshabilítala o finalízala primero.';
    end if;
    update public.events set phase = 'finished' where id = p_event;
  elsif p_action = 'disable' then
    if cur = 'started' then raise exception 'Termina la carrera antes de deshabilitarla.'; end if;
    if cur = 'disabled' then raise exception 'La carrera ya está deshabilitada.'; end if;
    if cur = 'archived' then raise exception 'Una carrera finalizada está en el historial: reábrela primero.'; end if;
    update public.events set phase = 'disabled' where id = p_event; -- back to configuration: archives a copy and resets the progress (0020, 0023, 0028)
  elsif p_action = 'reset' then
    if cur <> 'finished' and not (test and cur in ('enabled', 'started')) then
      raise exception 'Para reiniciar, primero termina la carrera.';
    end if;
    perform public.reset_event_progress(p_event); -- no history: this is for tests
    if cur = 'finished' then
      update public.events set phase = 'enabled' where id = p_event;
    elsif cur = 'started' then
      update public.events set phase = 'finished' where id = p_event;
      update public.events set phase = 'enabled' where id = p_event;
    end if;
  else
    raise exception 'Acción desconocida.';
  end if;
end;
$$;
revoke all on function public.event_action(uuid, text) from public, anon;
grant execute on function public.event_action(uuid, text) to authenticated;

-- ============================================================ la carrera de prueba y la 2710 real
do $$
declare old_id uuid;
begin
  if not exists (select 1 from public.events where is_test) then
    select id into old_id from public.events where lower(trim(name)) = 'carrera 2710' order by created_at limit 1;
    if old_id is not null then
      update public.events set name = 'Carrera de prueba', code = null, is_test = true where id = old_id;
    else
      insert into public.events (name, is_test) values ('Carrera de prueba', true);
    end if;
  end if;
  if not exists (select 1 from public.events where code = '2710') then
    insert into public.events (name, code, term_id)
    values ('Carrera 2710', '2710', (select id from public.terms where name = '2710' limit 1));
  end if;
end $$;

-- ============================================================ insignias (globales)
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z0-9_-]{2,30}$'),
  name        text not null check (length(trim(name)) between 1 and 40),
  description text check (description is null or length(description) <= 200),
  group_id    uuid references public.career_groups (id) on delete set null,
  image_path  text check (image_path is null or length(image_path) <= 200),
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.badges enable row level security;
drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges for select to authenticated using (true);
drop policy if exists badges_admin on public.badges;
create policy badges_admin on public.badges for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.badges (key, name, group_id, sort_order)
select lower(g.name), g.name, g.id, g.sort_order from public.career_groups g
on conflict (key) do nothing;
