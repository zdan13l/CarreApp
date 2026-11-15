-- CarreApp · Bloque 4: una base califica sus rondas EN ORDEN.
-- Un inductor de base no puede registrar puntos de una ronda mientras exista una ronda
-- anterior de su misma base sin terminar (sin los 3 ítems). El coordinador no tiene esta
-- restricción (puede corregir o completar cualquier cruce).
-- Ejecutar completo en Supabase > SQL Editor.

create or replace function public.validate_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  select * into m from public.matches where id = new.match_id;
  if new.winner_team_id is not null and new.winner_team_id not in (m.team_a, m.team_b) then
    raise exception 'El ganador debe ser uno de los dos grupos del enfrentamiento.';
  end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() and exists (
      select 1 from public.matches earlier
      where earlier.base_id = m.base_id
        and earlier.round_number < m.round_number
        and earlier.status <> 'finished'
    ) then
      raise exception 'Primero termina de calificar la ronda anterior de tu base.';
    end if;
    new.awarded_by := auth.uid();
    new.awarded_at := now();
  end if;
  return new;
end;
$$;
