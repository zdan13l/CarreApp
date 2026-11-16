-- CarreApp · Bloque 7 (ajuste): las notificaciones push son solo para los corredores.
--  * check_delays(): avisa únicamente a los corredores del grupo en demora.
--  * alerts_push(): el aviso manual llega como notificación a los corredores de los dos grupos.
--  * La base también puede mandar avisos a los grupos de SUS cruces (antes solo el coordinador).
-- Ejecutar completo en Supabase > SQL Editor.

create or replace function public.check_delays() returns void
language plpgsql security definer set search_path = public as $$
declare
  items jsonb := '[]'::jsonb;
  r record;
begin
  for r in
    select m.id as match_id, b.name as base_name, t.team_id,
           floor(extract(epoch from (now() - p.finished_at)) / 60)::int as elapsed,
           coalesce(bt.minutes, e.max_travel_minutes) as max_min
    from public.matches m
    join public.events e on e.id = m.event_id and e.is_active
    join public.bases b on b.id = m.base_id
    cross join lateral (values (m.team_a), (m.team_b)) as t(team_id)
    join lateral (
      select pm.* from public.matches pm
      where pm.event_id = m.event_id and pm.round_number < m.round_number
        and (pm.team_a = t.team_id or pm.team_b = t.team_id)
      order by pm.round_number desc limit 1
    ) p on true
    left join public.base_travel_times bt on bt.from_base_id = p.base_id and bt.to_base_id = m.base_id
    where m.status = 'pending' and m.arrived_at is null
      and p.status = 'finished' and p.finished_at is not null
      and now() - p.finished_at >= make_interval(mins => coalesce(bt.minutes, e.max_travel_minutes))
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

create or replace function public.alerts_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  users jsonb;
begin
  select * into m from public.matches where id = new.match_id;
  select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb) into users
    from public.team_runners where team_id in (m.team_a, m.team_b);
  perform public.push_send(jsonb_build_array(jsonb_build_object(
    'user_ids', users, 'title', 'Aviso: ¡apúrense!', 'body', new.message, 'tag', 'alert-' || new.id
  )));
  return new;
end;
$$;

-- La base manda avisos a los grupos de sus propios cruces.
create policy alerts_base_insert on public.alerts for insert to authenticated
  with check (public.is_staff_of_match(match_id));
