-- CarreApp · migración 0032: los estados de la Carrera y el reloj desde el aviso de rotación.
-- Una Carrera pasa por cuatro estados (events.phase):
--   disabled  Deshabilitada: no la ve nadie (borrador, o ya pasó al historial).
--   enabled   Habilitada: lista, pero sin actividad. Las bases y los corredores ven las pantallas y pueden recorrer el tutorial, con los botones
--             desactivados. Una base no puede registrar nada todavía (llegadas, puntajes, avisos, rotación).
--   started   Iniciada: corre el tiempo y las bases pueden actuar.
--   finished  Terminada: las bases quedan bloqueadas otra vez; el coordinador valida los puntajes, el top y todo. Aún se puede corregir.
-- Deshabilitar (desde Habilitada o Terminada) hace lo de siempre: guarda el historial y reinicia el avance. "Reiniciar" (solo desde Terminada)
-- borra el avance SIN pasar al historial y deja la Carrera Habilitada, a la espera de que se inicie: sirve para las pruebas.
-- events.is_active sigue existiendo y es "phase <> 'disabled'" (un trigger los mantiene iguales; poner is_active = true equivale a Iniciada).
-- Además, las alertas de demora (check_delays) cuentan el tiempo desde el AVISO de rotación de la ronda anterior (si lo hay; si no, desde que
-- terminó el cruce), y solo corren con la Carrera Iniciada. La app (lateTeams) tiene la misma regla.
-- Las Carreras activas hoy quedan Iniciadas. Ejecutar completo en Supabase > SQL Editor.

alter table public.events
  add column if not exists phase text not null default 'disabled' check (phase in ('disabled', 'enabled', 'started', 'finished')),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

update public.events set phase = case when is_active then 'started' else 'disabled' end,
                         started_at = case when is_active then now() else null end;

-- is_active and phase always agree; the pairs below are the only moves a Carrera can make.
create or replace function public.events_sync_phase() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.phase <> 'disabled' then new.is_active := true;
    elsif new.is_active then new.phase := 'started';
    end if;
  elsif new.phase is distinct from old.phase then
    if not ((old.phase, new.phase) in (
      ('disabled', 'enabled'), ('disabled', 'started'), ('enabled', 'started'), ('enabled', 'disabled'),
      ('started', 'finished'), ('started', 'disabled'), ('finished', 'disabled'), ('finished', 'enabled')
    )) then
      raise exception 'La Carrera no puede pasar de "%" a "%".', old.phase, new.phase;
    end if;
    new.is_active := new.phase <> 'disabled';
  elsif new.is_active is distinct from old.is_active then
    new.phase := case when new.is_active then 'started' else 'disabled' end;
  end if;

  if tg_op = 'INSERT' or new.phase is distinct from old.phase then
    if new.phase = 'started' then
      new.started_at := now();
      new.finished_at := null;
    elsif new.phase = 'finished' then
      new.finished_at := now();
    else
      new.started_at := null;
      new.finished_at := null;
    end if;
  end if;
  return new;
end;
$$;
-- sorts before events_validate_activation (0002), so the completeness check sees is_active already in step with the phase
drop trigger if exists events_a_sync_phase on public.events;
create trigger events_a_sync_phase before insert or update on public.events
  for each row execute function public.events_sync_phase();

-- "update of is_active" triggers only fire when is_active is in the SET list, and moving the phase changes it from inside the trigger above:
-- the three that react to a Carrera being deactivated must listen to the phase too.
drop trigger if exists events_reset_on_deactivate on public.events;
create trigger events_reset_on_deactivate after update of is_active, phase on public.events
  for each row execute function public.events_reset_on_deactivate();
drop trigger if exists events_archive_stamps on public.events;
create trigger events_archive_stamps after update of is_active, phase on public.events
  for each row execute function public.events_archive_stamps();
drop trigger if exists events_archive_scores on public.events;
create trigger events_archive_scores after update of is_active, phase on public.events
  for each row execute function public.events_archive_scores();

-- The coordinator's moves, with their rules. Only the coordinator calls it.
create or replace function public.event_action(p_event uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if not public.is_admin() then
    raise exception 'Solo el coordinador puede cambiar el estado de la Carrera.';
  end if;
  select phase into cur from public.events where id = p_event for update;
  if cur is null then raise exception 'La Carrera no existe.'; end if;

  if p_action = 'enable' then
    if cur <> 'disabled' then raise exception 'La Carrera ya está habilitada.'; end if;
    if exists (select 1 from public.events where is_active and id <> p_event) then
      raise exception 'Ya hay otra Carrera activa: deshabilítala primero.';
    end if;
    update public.events set phase = 'enabled' where id = p_event; -- the completeness check runs here
  elsif p_action = 'start' then
    if cur <> 'enabled' then raise exception 'Solo se puede iniciar una Carrera habilitada.'; end if;
    update public.events set phase = 'started' where id = p_event;
  elsif p_action = 'finish' then
    if cur <> 'started' then raise exception 'Solo se puede terminar una Carrera iniciada.'; end if;
    update public.events set phase = 'finished' where id = p_event;
  elsif p_action = 'disable' then
    if cur = 'started' then raise exception 'Termina la Carrera antes de deshabilitarla.'; end if;
    if cur = 'disabled' then raise exception 'La Carrera ya está deshabilitada.'; end if;
    update public.events set phase = 'disabled' where id = p_event; -- archives the history and resets the progress (0020, 0023, 0028)
  elsif p_action = 'reset' then
    if cur <> 'finished' then raise exception 'Para reiniciar, primero termina la Carrera.'; end if;
    perform public.reset_event_progress(p_event); -- no history: this is for tests
    update public.events set phase = 'enabled' where id = p_event;
  else
    raise exception 'Acción desconocida.';
  end if;
end;
$$;
revoke all on function public.event_action(uuid, text) from public, anon;
grant execute on function public.event_action(uuid, text) to authenticated;

-- A base only ACTS (arrival, scores, alerts, rotation) while the Carrera is started. Reading stays as it was.
create or replace function public.staff_can_act(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff_of_match(p_match) and exists (
    select 1 from public.matches m join public.events e on e.id = m.event_id
    where m.id = p_match and e.phase = 'started'
  );
$$;
revoke all on function public.staff_can_act(uuid) from public, anon;
grant execute on function public.staff_can_act(uuid) to authenticated;

drop policy if exists scores_base_insert on public.match_scores;
create policy scores_base_insert on public.match_scores for insert to authenticated
  with check (public.staff_can_act(match_id));

drop policy if exists alerts_base_insert on public.alerts;
create policy alerts_base_insert on public.alerts for insert to authenticated
  with check (
    public.staff_can_act(match_id)
    and target = 'groups' -- a base warns the groups, never itself
    and event_id = (select m.event_id from public.matches m where m.id = match_id)
  );

create or replace function public.confirm_arrival(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.staff_can_act(p_match)) then
    raise exception 'Solo la base de este cruce puede confirmar la llegada, y solo con la Carrera iniciada.';
  end if;
  update public.matches
     set arrived_at = coalesce(arrived_at, now()),
         status = case when status = 'pending' then 'in_progress' else status end::public.match_status
   where id = p_match;
end;
$$;
grant execute on function public.confirm_arrival(uuid) to authenticated;

drop policy if exists acks_insert on public.rotation_acks;
create policy acks_insert on public.rotation_acks for insert to authenticated
  with check (
    public.is_staff_of_base(base_id)
    and exists (
      select 1
      from public.round_rotations r
      join public.bases b on b.event_id = r.event_id
      join public.events e on e.id = r.event_id
      where r.id = rotation_id and b.id = base_id and e.phase = 'started'
    )
  );

-- Delay alerts: only while the Carrera is started, counting from the rotation notice of the previous round when there is one.
create or replace function public.check_delays() returns void
language plpgsql security definer set search_path = public as $$
declare
  items jsonb := '[]'::jsonb;
  r record;
begin
  for r in
    select m.id as match_id, b.name as base_name, t.team_id,
           floor(extract(epoch from (now() - s.at)) / 60)::int as elapsed,
           coalesce(bt.minutes, e.max_travel_minutes) as max_min
    from public.matches m
    join public.events e on e.id = m.event_id and e.phase = 'started'
    join public.bases b on b.id = m.base_id
    cross join lateral (values (m.team_a), (m.team_b)) as t(team_id)
    join lateral (
      select pm.* from public.matches pm
      where pm.event_id = m.event_id and pm.round_number < m.round_number
        and (pm.team_a = t.team_id or pm.team_b = t.team_id)
      order by pm.round_number desc limit 1
    ) p on true
    left join public.round_rotations rr on rr.event_id = m.event_id and rr.round_number = p.round_number
    cross join lateral (select greatest(p.finished_at, coalesce(rr.created_at, p.finished_at)) as at) s
    left join public.base_travel_times bt on bt.from_base_id = p.base_id and bt.to_base_id = m.base_id
    where m.status = 'pending' and m.arrived_at is null
      and p.status = 'finished' and p.finished_at is not null
      and p.base_id <> m.base_id   -- a group that stays at its base does not walk: it cannot be late
      and p.round_number = m.round_number - 1   -- a group that rested a round has no walking deadline
      and now() - s.at >= make_interval(mins => coalesce(bt.minutes, e.max_travel_minutes))
  loop
    items := items || jsonb_build_array(jsonb_build_object(
      'user_ids', (select coalesce(jsonb_agg(user_id), '[]'::jsonb) from public.team_runners where team_id = r.team_id),
      'title', format('Llevas %s min en el traslado', r.elapsed),
      'body', format('Apúrate hacia %s (máximo %s min). Si ya llegaste, avísale a la base.', r.base_name, r.max_min),
      'tag', 'late-' || r.match_id || '-' || r.team_id
    ));
  end loop;

  if jsonb_array_length(items) > 0 then
    perform public.push_send(items);
  end if;
end;
$$;
revoke all on function public.check_delays() from public, anon, authenticated;
