-- CarreApp · Bloque 6: mapa y GPS.
--  * Cada base tiene una ubicación (lat/lng). La fija el coordinador o la propia base
--    (por ejemplo si se mueve por lluvia; el trigger de 0007 ya permite cambiar solo foto y ubicación).
--  * Una tabla con la ÚLTIMA ubicación de cada grupo. Solo la escribe el corredor designado
--    para el GPS de ese grupo; solo el coordinador la lee.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.bases
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180);

create table public.team_locations (
  team_id    uuid primary key references public.teams (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  accuracy   real,                       -- metros
  heading    real,                       -- grados
  speed      real,                       -- m/s
  updated_at timestamptz not null default now()
);

-- Quién envió y cuándo lo pone el servidor, no el cliente.
create function public.stamp_team_location() returns trigger
language plpgsql as $$
begin
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
create trigger team_locations_stamp before insert or update on public.team_locations
  for each row execute function public.stamp_team_location();

alter table public.team_locations enable row level security;

-- El coordinador ve dónde están todos los grupos.
create policy team_locations_admin_read on public.team_locations for select to authenticated
  using (public.is_admin());

-- El corredor designado puede leer la fila de SU grupo: el upsert (insert ... on conflict update)
-- exige poder leer la fila que actualiza. No ve la de ningún otro grupo.
create policy team_locations_tracker_read on public.team_locations for select to authenticated
  using (exists (
    select 1 from public.team_runners tr
    where tr.team_id = team_locations.team_id and tr.user_id = auth.uid() and tr.is_gps_tracker
  ));

-- Solo el corredor designado para el GPS de ese grupo escribe su ubicación.
create policy team_locations_tracker_insert on public.team_locations for insert to authenticated
  with check (exists (
    select 1 from public.team_runners tr
    where tr.team_id = team_locations.team_id and tr.user_id = auth.uid() and tr.is_gps_tracker
  ));
create policy team_locations_tracker_update on public.team_locations for update to authenticated
  using (exists (
    select 1 from public.team_runners tr
    where tr.team_id = team_locations.team_id and tr.user_id = auth.uid() and tr.is_gps_tracker
  ))
  with check (exists (
    select 1 from public.team_runners tr
    where tr.team_id = team_locations.team_id and tr.user_id = auth.uid() and tr.is_gps_tracker
  ));
create policy team_locations_admin_write on public.team_locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Tiempo real para el mapa del coordinador.
alter publication supabase_realtime add table public.team_locations;
