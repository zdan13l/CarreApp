-- CarreApp · Endurecimiento (tercera ejecución del agente de pruebas).
--  * server_now(): la hora del servidor, para que las alertas en pantalla no dependan del reloj del teléfono.
--  * Avisos: los lee solo quien debe (coordinador, base y corredores del cruce), una base solo puede
--    avisar con el event_id de su propio cruce y hay un mínimo de 20 s entre avisos de una base al mismo cruce (el coordinador no tiene límite).
--  * Auditoría: cambiar solo "quién calificó" (p. ej. al borrar a un inductor) ya no escribe filas "Corrigió".
-- Ejecutar completo en Supabase > SQL Editor.

create function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;
revoke all on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;

-- ---------------------------------------------------------------- avisos
create function public.is_runner_of_match(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches m
    join public.team_runners tr on tr.team_id in (m.team_a, m.team_b)
    where m.id = p_match and tr.user_id = auth.uid()
  );
$$;
revoke all on function public.is_runner_of_match(uuid) from public, anon;
grant execute on function public.is_runner_of_match(uuid) to authenticated;

drop policy alerts_read on public.alerts;
create policy alerts_read on public.alerts for select to authenticated
  using (public.is_admin() or public.is_runner_of_match(match_id) or public.is_staff_of_match(match_id));

drop policy alerts_base_insert on public.alerts;
create policy alerts_base_insert on public.alerts for insert to authenticated
  with check (
    public.is_staff_of_match(match_id)
    and event_id = (select m.event_id from public.matches m where m.id = match_id)
  );

-- AFTER insert, so the permission policy is checked first and its error is the one that shows.
create function public.alerts_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return null; end if; -- the coordinator is trusted
  if exists (
    select 1 from public.alerts a
    where a.match_id = new.match_id and a.created_by is not distinct from new.created_by and a.id <> new.id and a.created_at > now() - interval '20 seconds'
  ) then
    raise exception 'Espera unos segundos antes de enviar otro aviso a este cruce.';
  end if;
  return null;
end;
$$;
create trigger alerts_rate_limit after insert on public.alerts
  for each row execute function public.alerts_rate_limit();
revoke all on function public.alerts_rate_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------- auditoría sin ruido
create or replace function public.after_score_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_match uuid := coalesce(new.match_id, old.match_id);
  v_count int;
begin
  -- Only "who scored it" changed (e.g. the inductor was deleted: awarded_by -> null): nothing to record.
  if tg_op = 'UPDATE'
     and old.winner_team_id is not distinct from new.winner_team_id
     and old.voided is not distinct from new.voided then
    return null;
  end if;

  insert into public.score_audit
    (match_id, item, action, old_winner, new_winner, old_voided, new_voided, changed_by)
  values (
    v_match,
    coalesce(new.item, old.item),
    lower(tg_op),
    old.winner_team_id,
    new.winner_team_id,
    old.voided,
    new.voided,
    auth.uid()
  );

  select count(*) into v_count from public.match_scores where match_id = v_match;
  update public.matches m
     set status = case when v_count >= 3 then 'finished'
                       when v_count >= 1 or m.arrived_at is not null then 'in_progress'
                       else 'pending' end::public.match_status,
         finished_at = case when v_count >= 3 then coalesce(m.finished_at, now()) else null end
   where m.id = v_match;
  return null;
end;
$$;
