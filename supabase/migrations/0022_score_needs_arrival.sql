-- CarreApp · Calificar exige que la llegada esté confirmada.
-- Hasta ahora la base de datos aceptaba el puntaje de una base aunque no hubiera confirmado la llegada de los dos
-- grupos (solo la pantalla escondía los botones). Con el primer puntaje el cruce pasaba a "en juego" sin hora de llegada
-- (`arrived_at` vacío), y las demoras y el registro de operaciones quedaban sin esa hora.
-- Ahora una base solo puede registrar un puntaje si `arrived_at` tiene valor. El coordinador no está obligado (puede
-- cargar o corregir resultados a mano). Ejecutar completo en Supabase > SQL Editor.

create or replace function public.validate_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  select * into m from public.matches where id = new.match_id;
  if new.voided and not public.is_admin() then
    raise exception 'Solo el coordinador puede invalidar un ítem.';
  end if;
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
    if not public.is_admin() and m.arrived_at is null then
      raise exception 'Primero confirma que llegaron los dos grupos a tu base.';
    end if;
    new.awarded_by := auth.uid();
    new.awarded_at := now();
  end if;
  return new;
end;
$$;
