-- CarreApp · Desactivar una Carrera reinicia todo su avance.
--  * Al pasar una Carrera de activa a desactivada se borra lo que se hizo DURANTE la carrera: puntajes, registro de
--    cambios, avisos y ubicaciones de los grupos, y cada cruce vuelve a "pendiente" sin llegada confirmada.
--  * Se conserva lo que se PREPARÓ: grupos, bases, usuarios, fotos, tiempos de traslado y el cronograma (los cruces).
--  Así, al volver a activarla arranca desde cero como el primer día.
-- Ejecutar completo en Supabase > SQL Editor.

create or replace function public.reset_event_progress(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- deleting the scores writes one audit row each (the matches still exist): those rows go too, right below
  delete from public.match_scores where match_id in (select id from public.matches where event_id = p_event);
  delete from public.score_audit where event_id = p_event;
  update public.matches set status = 'pending', arrived_at = null, finished_at = null where event_id = p_event;
  delete from public.alerts where event_id = p_event;
  delete from public.team_locations where team_id in (select id from public.teams where event_id = p_event);
end;
$$;
revoke all on function public.reset_event_progress(uuid) from public, anon, authenticated;

create or replace function public.events_reset_on_deactivate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_active and not new.is_active then
    perform public.reset_event_progress(new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.events_reset_on_deactivate() from public, anon, authenticated;

drop trigger if exists events_reset_on_deactivate on public.events;
create trigger events_reset_on_deactivate after update of is_active on public.events
  for each row execute function public.events_reset_on_deactivate();
