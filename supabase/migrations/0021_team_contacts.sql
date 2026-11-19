-- 0021: team_contacts(): el @ de los corredores de cada grupo de MI Carrera
--
-- Un corredor puede abrir la ficha de otro equipo (foto grande y @ de su corredor) para encontrarlo en la Carrera.
-- Hasta ahora solo veía su propia fila de team_runners y su propio perfil, así que no podía saber el @ de los demás.
-- Esta función devuelve SOLO el usuario (@) de los corredores de los grupos de su propia Carrera, nada más (ni nombre ni foto
-- ni puntos). La puede llamar el coordinador y los corredores; los inductores no.
create or replace function public.team_contacts()
returns table (team_id uuid, username text)
language sql stable security definer set search_path = public as $$
  select tr.team_id, p.username
  from public.team_runners tr
  join public.teams t on t.id = tr.team_id
  join public.profiles p on p.id = tr.user_id
  where (public.is_admin() or (
          t.event_id = public.my_event_id()
          and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'runner')))
  order by p.username
$$;
revoke all on function public.team_contacts() from public, anon;
grant execute on function public.team_contacts() to authenticated;
