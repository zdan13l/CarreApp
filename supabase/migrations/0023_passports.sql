-- CarreApp · El pasaporte personal del inductor.
--  * Cada inductor tiene UN usuario personal (@) que abre su pasaporte: un espacio propio donde se guarda, semestre a semestre,
--    su paso por la Carrera con los sellos de cada temática. No es el usuario del grupo ni el de la base (esos siguen siendo
--    los que entran a la operación en vivo): el personal solo ve su pasaporte.
--  * Un semestre ("term") tiene nombre y temática (p. ej. 2026-2 · mitologías). Cada persona tiene un REGISTRO por semestre
--    (`passport_records`): su carrera, su cultura dentro de la temática, su papel (corredor, base o coordinador) y, si corre,
--    el grupo de dos al que se enlaza (o, si es base, la base). Así en un semestre puede correr y en otro ser base.
--  * Los sellos del pasaporte (`passport_stamps`) se guardan para siempre: al desactivar una Carrera su avance se reinicia (0020),
--    así que antes de reiniciar se archiva en cada pasaporte lo que esa persona hizo.
-- Ejecutar completo en Supabase > SQL Editor.

-- ============================================================
-- Semestres
-- ============================================================
create table public.terms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) > 0),          -- "2026-2"
  theme      text not null default 'mitologias' check (theme ~ '^[a-z0-9_-]{2,30}$'),
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
-- Un solo semestre vigente a la vez.
create unique index terms_single_current on public.terms (is_current) where is_current;

-- Cada Carrera pertenece a un semestre: el vigente cuando se crea.
alter table public.events add column term_id uuid references public.terms (id) on delete set null;

create or replace function public.events_default_term() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.term_id is null then
    select id into new.term_id from public.terms where is_current;
  end if;
  return new;
end;
$$;
revoke all on function public.events_default_term() from public, anon, authenticated;
create trigger events_default_term before insert on public.events
  for each row execute function public.events_default_term();

-- ============================================================
-- Personas y registros
-- ============================================================
-- La persona: su usuario personal (auth.users) y lo que no cambia de semestre a semestre.
create table public.passports (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  full_name  text not null check (length(trim(full_name)) > 0),
  photo_path text,
  created_at timestamptz not null default now()
);

-- Su registro de un semestre.
create table public.passport_records (
  id          uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.passports (id) on delete cascade,
  term_id     uuid not null references public.terms (id) on delete cascade,
  role        text not null default 'runner' check (role in ('runner', 'base', 'coordinator')),
  career      text not null check (length(trim(career)) > 0),
  culture     text not null check (culture ~ '^[a-z_]{2,20}$'),            -- la cultura de su carrera dentro de la temática
  team_id     uuid references public.teams (id) on delete set null,       -- solo si corre: el grupo de dos
  base_id     uuid references public.bases (id) on delete set null,       -- solo si es base
  created_at  timestamptz not null default now(),
  unique (passport_id, term_id),
  check (team_id is null or role = 'runner'),
  check (base_id is null or role = 'base')
);
create index passport_records_team_idx on public.passport_records (team_id) where team_id is not null;
create index passport_records_base_idx on public.passport_records (base_id) where base_id is not null;
create index passport_records_term_idx on public.passport_records (term_id);

-- Un grupo son dos personas como máximo, y el grupo / la base deben ser de una Carrera del mismo semestre.
create or replace function public.validate_passport_record() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev_term uuid;
begin
  if new.team_id is not null then
    select e.term_id into ev_term from public.teams t join public.events e on e.id = t.event_id where t.id = new.team_id;
    if ev_term is not null and ev_term <> new.term_id then
      raise exception 'Ese grupo es de una Carrera de otro semestre.';
    end if;
    if (select count(*) from public.passport_records r where r.team_id = new.team_id and r.id <> new.id) >= 2 then
      raise exception 'Un grupo tiene como máximo dos personas.';
    end if;
  end if;
  if new.base_id is not null then
    select e.term_id into ev_term from public.bases b join public.events e on e.id = b.event_id where b.id = new.base_id;
    if ev_term is not null and ev_term <> new.term_id then
      raise exception 'Esa base es de una Carrera de otro semestre.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_passport_record() from public, anon, authenticated;
create trigger passport_records_validate before insert or update on public.passport_records
  for each row execute function public.validate_passport_record();

-- Los sellos que se guardan para siempre (lo que el pasaporte muestra de Carreras ya terminadas).
create table public.passport_stamps (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references public.passport_records (id) on delete cascade,
  event_id     uuid references public.events (id) on delete set null,
  event_name   text not null,
  kind         text not null check (kind in ('visited', 'hosted', 'coordinated')),
  base_name    text,                                   -- la base visitada o atendida (vacío si coordinó)
  base_key     text,                                   -- identificador de la base: de ahí salen la forma y la tinta del sello
  round_number int not null default 0,
  stamped_at   timestamptz not null default now(),
  unique (record_id, event_id, kind, round_number)
);
create index passport_stamps_record_idx on public.passport_stamps (record_id);

-- ============================================================
-- Permisos (RLS): cada quien ve solo su pasaporte; el coordinador gestiona todo
-- ============================================================
alter table public.terms           enable row level security;
alter table public.passports       enable row level security;
alter table public.passport_records enable row level security;
alter table public.passport_stamps enable row level security;

create policy terms_read on public.terms for select to authenticated using (true);
create policy terms_admin on public.terms for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy passports_select on public.passports for select to authenticated using (id = auth.uid() or public.is_admin());
create policy passports_admin on public.passports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy passport_records_select on public.passport_records for select to authenticated
  using (passport_id = auth.uid() or public.is_admin());
create policy passport_records_admin on public.passport_records for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy passport_stamps_select on public.passport_stamps for select to authenticated
  using (public.is_admin() or exists (select 1 from public.passport_records r where r.id = record_id and r.passport_id = auth.uid()));
create policy passport_stamps_admin on public.passport_stamps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Lo que el pasaporte muestra de la Carrera en curso (sin abrir las tablas de la operación)
-- ============================================================
-- Mi grupo (nombre, foto, con quién corro), mi base y mi Carrera, por cada registro mío. Solo nombres: ni puntos ni cruces.
create or replace function public.my_passport_context()
returns table (record_id uuid, team_id uuid, team_name text, team_photo_path text, partners text[],
               base_id uuid, base_name text, event_id uuid, event_name text, event_active boolean)
language sql stable security definer set search_path = public as $$
  select r.id, t.id, t.name, t.photo_path,
         coalesce((select array_agg(p.full_name order by p.full_name)
                     from public.passport_records o join public.passports p on p.id = o.passport_id
                    where r.team_id is not null and o.team_id = r.team_id and o.id <> r.id), '{}'),
         b.id, b.name, e.id, e.name, coalesce(e.is_active, false)
    from public.passport_records r
    left join public.teams t on t.id = r.team_id
    left join public.bases b on b.id = r.base_id
    left join public.events e on e.id = coalesce(
           t.event_id, b.event_id,
           (select x.id from public.events x where x.term_id = r.term_id order by x.is_active desc, x.created_at desc limit 1))
   where r.passport_id = auth.uid()
$$;
revoke all on function public.my_passport_context() from public, anon;
grant execute on function public.my_passport_context() to authenticated;

-- Los sellos que ya gané en la Carrera ACTIVA (los cruces terminados de mi grupo / de mi base). Los de Carreras ya cerradas
-- están en passport_stamps.
create or replace function public.my_live_stamps()
returns table (record_id uuid, event_id uuid, event_name text, kind text, base_name text, base_key text,
               round_number int, stamped_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, e.id, e.name, 'visited'::text, b.name, b.id::text, m.round_number, coalesce(m.finished_at, m.created_at)
    from public.passport_records r
    join public.matches m on r.team_id in (m.team_a, m.team_b) and m.status = 'finished'
    join public.events e on e.id = m.event_id and e.is_active
    join public.bases b on b.id = m.base_id
   where r.passport_id = auth.uid() and r.role = 'runner'
  union all
  select r.id, e.id, e.name, 'hosted'::text, b.name, b.id::text, m.round_number, coalesce(m.finished_at, m.created_at)
    from public.passport_records r
    join public.matches m on m.base_id = r.base_id and m.status = 'finished'
    join public.events e on e.id = m.event_id and e.is_active
    join public.bases b on b.id = m.base_id
   where r.passport_id = auth.uid() and r.role = 'base'
$$;
revoke all on function public.my_live_stamps() from public, anon;
grant execute on function public.my_live_stamps() to authenticated;

-- ============================================================
-- Archivar los sellos antes de reiniciar la Carrera (0020)
-- ============================================================
create or replace function public.archive_event_stamps(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ev record;
begin
  select id, name, term_id into ev from public.events where id = p_event;
  if not found then return; end if;

  -- corredores: un sello por cada base donde su grupo terminó el cruce
  insert into public.passport_stamps (record_id, event_id, event_name, kind, base_name, base_key, round_number, stamped_at)
  select r.id, ev.id, ev.name, 'visited', b.name, b.id::text, m.round_number, coalesce(m.finished_at, now())
    from public.passport_records r
    join public.matches m on m.event_id = p_event and m.status = 'finished' and r.team_id in (m.team_a, m.team_b)
    join public.bases b on b.id = m.base_id
   where r.role = 'runner'
  on conflict (record_id, event_id, kind, round_number)
  do update set base_name = excluded.base_name, base_key = excluded.base_key, stamped_at = excluded.stamped_at;

  -- inductores de base: un sello por cada cruce terminado en su base
  insert into public.passport_stamps (record_id, event_id, event_name, kind, base_name, base_key, round_number, stamped_at)
  select r.id, ev.id, ev.name, 'hosted', b.name, b.id::text, m.round_number, coalesce(m.finished_at, now())
    from public.passport_records r
    join public.matches m on m.event_id = p_event and m.status = 'finished' and m.base_id = r.base_id
    join public.bases b on b.id = m.base_id
   where r.role = 'base'
  on conflict (record_id, event_id, kind, round_number)
  do update set base_name = excluded.base_name, base_key = excluded.base_key, stamped_at = excluded.stamped_at;

  -- coordinadores del semestre: un sello por la Carrera, si de verdad se jugó algo
  if ev.term_id is not null and exists (select 1 from public.matches where event_id = p_event and status = 'finished') then
    insert into public.passport_stamps (record_id, event_id, event_name, kind, round_number, stamped_at)
    select r.id, ev.id, ev.name, 'coordinated', 0, now()
      from public.passport_records r
     where r.role = 'coordinator' and r.term_id = ev.term_id
    on conflict (record_id, event_id, kind, round_number) do update set stamped_at = excluded.stamped_at;
  end if;
end;
$$;
revoke all on function public.archive_event_stamps(uuid) from public, anon, authenticated;

create or replace function public.events_archive_stamps() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_active and not new.is_active then
    perform public.archive_event_stamps(new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.events_archive_stamps() from public, anon, authenticated;

-- Se dispara ANTES que events_reset_on_deactivate (0020): los disparadores del mismo evento corren en orden alfabético,
-- y "events_archive_stamps" va antes que "events_reset_on_deactivate".
create trigger events_archive_stamps after update of is_active on public.events
  for each row execute function public.events_archive_stamps();
