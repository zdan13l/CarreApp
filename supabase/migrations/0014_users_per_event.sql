-- CarreApp · Usuarios por Carrera.
--  * Cada corredor / inductor pertenece a UNA Carrera (profiles.event_id). El coordinador no tiene Carrera.
--  * No se puede asignar a un grupo o base de otra Carrera; al asignar a alguien sin Carrera, se queda en esa.
--  * Los usuarios existentes se asignan a la Carrera donde ya trabajan (la más reciente si estaban en varias).
--  * La tabla events entra a Realtime: al activar/desactivar la Carrera, los teléfonos lo notan de inmediato.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.profiles
  add column event_id uuid references public.events (id) on delete set null;
create index profiles_event_idx on public.profiles (event_id);

-- Backfill: the most recent Carrera where the person already works.
update public.profiles p set event_id = x.event_id
from (
  select distinct on (user_id) user_id, event_id from (
    select tr.user_id, t.event_id, e.created_at
    from public.team_runners tr join public.teams t on t.id = tr.team_id join public.events e on e.id = t.event_id
    union all
    select bs.user_id, b.event_id, e.created_at
    from public.base_staff bs join public.bases b on b.id = bs.base_id join public.events e on e.id = b.event_id
  ) u order by user_id, created_at desc
) x
where p.id = x.user_id and p.role <> 'admin';

-- A runner / inductor can only work in the Carrera they belong to.
create or replace function public.validate_base_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev uuid; pev uuid;
begin
  select event_id into ev from public.bases where id = new.base_id;
  select event_id into pev from public.profiles where id = new.user_id;
  if pev is not null and pev <> ev then
    raise exception 'Ese usuario pertenece a otra Carrera.';
  end if;
  if exists (
    select 1 from public.base_staff bs join public.bases other on other.id = bs.base_id
    where bs.user_id = new.user_id and bs.base_id <> new.base_id and other.event_id = ev
  ) then
    raise exception 'Ese inductor ya está asignado a otra base de esta Carrera.';
  end if;
  if pev is null then update public.profiles set event_id = ev where id = new.user_id; end if;
  return new;
end;
$$;

create or replace function public.validate_team_runner() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev uuid; pev uuid;
begin
  select event_id into ev from public.teams where id = new.team_id;
  select event_id into pev from public.profiles where id = new.user_id;
  if pev is not null and pev <> ev then
    raise exception 'Ese usuario pertenece a otra Carrera.';
  end if;
  if exists (
    select 1 from public.team_runners tr join public.teams other on other.id = tr.team_id
    where tr.user_id = new.user_id and tr.team_id <> new.team_id and other.event_id = ev
  ) then
    raise exception 'Ese corredor ya está en otro grupo de esta Carrera.';
  end if;
  if pev is null then update public.profiles set event_id = ev where id = new.user_id; end if;
  return new;
end;
$$;
revoke all on function public.validate_base_staff() from public, anon, authenticated;
revoke all on function public.validate_team_runner() from public, anon, authenticated;

-- Activating / deactivating a Carrera reaches every phone right away.
alter publication supabase_realtime add table public.events;
