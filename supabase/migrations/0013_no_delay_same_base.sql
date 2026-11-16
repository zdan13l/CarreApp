-- CarreApp · Alertas de demora: un grupo que juega de nuevo en la MISMA base donde ya está no camina,
-- así que no puede estar "en demora" (antes recibía la alerta y la notificación cada 30 s sin haberse
-- movido, solo porque su rival tardaba). Solo cuentan los grupos que de verdad tienen que caminar a otra base.
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
      and p.base_id <> m.base_id   -- a group that stays at its base does not walk: it cannot be late
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
