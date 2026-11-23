-- CarreApp · migración 0038: cada sello pertenece a UNA inducción (carrera) y solo se usa en ella.
--  * custom_seals.event_id: los sellos que se suben (0034) quedan atados a una carrera; los que ya existían son de la 2710.
--  * event_seals admite también el tipo 'base': el sello de cada base de la carrera (la forma, el color y la imagen se pueden editar).
--  * El límite de bases de una carrera cuenta los sellos 15 de la app + los subidos PARA ESA carrera (event_seal_capacity).
--  * La carrera de prueba recibe sellos arbitrarios (temática, subtemáticas, grupos, bases y comités) para probar; los sellos de siempre
--    (los 15 de las bases, los de los comités y los de las culturas) son los de la 2710 y se pueden editar en su pestaña Sellos.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.event_seals drop constraint if exists event_seals_kind_check;
alter table public.event_seals add constraint event_seals_kind_check check (kind in ('theme', 'subtheme', 'team', 'committee', 'coordinator', 'base'));

alter table public.custom_seals add column if not exists event_id uuid references public.events (id) on delete cascade;
update public.custom_seals set event_id = (select id from public.events where code = '2710' limit 1) where event_id is null;
create index if not exists custom_seals_event_idx on public.custom_seals (event_id);

create or replace function public.event_seal_capacity(p_event uuid) returns int
language sql stable security definer set search_path = public as $$
  select 15 + (select count(*)::int from public.custom_seals where event_id = p_event);
$$;
revoke all on function public.event_seal_capacity(uuid) from public, anon;
grant execute on function public.event_seal_capacity(uuid) to authenticated;

create or replace function public.bases_seal_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int := public.event_seal_capacity(new.event_id);
begin
  if (select count(*) from public.bases where event_id = new.event_id) >= cap then
    raise exception 'Hay % sellos en esta carrera y ya tiene % bases: primero hay que corregir los sellos (súbelos en la pestaña Sellos de la carrera) antes de crear otra base.', cap, cap;
  end if;
  return new;
end;
$$;
revoke all on function public.bases_seal_limit() from public, anon, authenticated;

create or replace function public.custom_seals_keep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.bases b where b.event_id = old.event_id group by b.event_id having count(*) > public.event_seal_capacity(old.event_id) - 1) then
    raise exception 'No puedes borrar este sello: la carrera tiene tantas bases como sellos.';
  end if;
  return old;
end;
$$;
revoke all on function public.custom_seals_keep() from public, anon, authenticated;

-- ============================================================ sellos arbitrarios en la carrera de prueba
-- the seeds are a convenience: one that clashes with a seal that already exists (same element, or the same design) is skipped, never an error
create or replace function public._seed_event_seal(p_event uuid, p_kind text, p_ref text, p_shape text, p_color text) returns void
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.event_seals where event_id = p_event and kind = p_kind and ref = p_ref) then return; end if;
  insert into public.event_seals (event_id, kind, ref, shape, color) values (p_event, p_kind, p_ref, p_shape, p_color);
exception when others then
  null;
end;
$$;

do $$
declare
  t uuid; term uuid; th text; i int; r record;
  shapes text[] := array['circle','hexagon','octagon','pentagon','shield','arch','roundsq','tablet','oval','wide','scallop'];
  colors text[] := array['#d1495b','#edae49','#00798c','#30638e','#003d5b','#6a4c93','#2a9d8f','#e76f51','#8ab17d','#b56576','#355070','#e56b6f',
                         '#588157','#bc6c25','#3a86ff','#8338ec','#ff006e','#06a77d','#ef476f','#118ab2','#7f5539','#9d4edd','#43aa8b','#f3722c'];
begin
  select id, term_id into t, term from public.events where is_test limit 1;
  if t is null then return; end if;
  select key into th from public.themes where term_id = term limit 1;
  if th is not null then
    perform public._seed_event_seal(t, 'theme', th, shapes[1], colors[1]);
    i := 0;
    for r in select key from public.theme_cultures where theme_key = th order by sort_order loop
      i := i + 1;
      perform public._seed_event_seal(t, 'subtheme', r.key, shapes[1 + (i % 11)], colors[1 + (i % 24)]);
    end loop;
  end if;
  i := 0;
  for r in select id from public.teams where event_id = t order by sort_order, name loop
    i := i + 1;
    perform public._seed_event_seal(t, 'team', r.id::text, shapes[1 + (i % 11)], colors[1 + ((i * 5) % 24)]);
  end loop;
  i := 0;
  for r in select id from public.bases where event_id = t order by sort_order, name loop
    i := i + 1;
    perform public._seed_event_seal(t, 'base', r.id::text, shapes[1 + ((i + 3) % 11)], colors[1 + ((i * 7) % 24)]);
  end loop;
  i := 0;
  for r in select committee_key from public.event_committees where event_id = t order by committee_key loop
    i := i + 1;
    perform public._seed_event_seal(t, 'committee', r.committee_key, shapes[1 + ((i * 2) % 11)], colors[1 + ((i * 3) % 24)]);
  end loop;
  -- a test coordi (the first person of the system) so the golden seal shows up
  begin
    update public.events set coordinator_id = (select id from public.passports order by created_at limit 1) where id = t and coordinator_id is null;
  exception when others then null;
  end;
end $$;
drop function if exists public._seed_event_seal(uuid, text, text, text, text);
