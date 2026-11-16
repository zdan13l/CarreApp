-- CarreApp · Bloque 7 (mejoras): tiempos de traslado por tramo y notificaciones push.
--  * Cada tramo (de una base a otra) puede tener su propio tiempo máximo; si no, vale el general.
--  * Suscripciones push de cada teléfono, para que las alertas suenen aunque la app esté cerrada.
--  * La base de datos revisa las demoras cada 10 segundos y manda las notificaciones, sin depender
--    de que alguien tenga la app abierta (la programación está en supabase/push_setup.sql).
-- Ejecutar completo en Supabase > SQL Editor.

create extension if not exists pg_net;

-- ============================================================
-- Tiempo máximo por tramo (base de origen -> base de destino)
-- ============================================================
create table public.base_travel_times (
  event_id     uuid not null references public.events (id) on delete cascade,
  from_base_id uuid not null references public.bases (id) on delete cascade,
  to_base_id   uuid not null references public.bases (id) on delete cascade,
  minutes      int  not null check (minutes between 1 and 180),
  primary key (from_base_id, to_base_id),
  check (from_base_id <> to_base_id)
);
alter table public.base_travel_times enable row level security;
create policy travel_times_read on public.base_travel_times for select to authenticated using (true);
create policy travel_times_admin on public.base_travel_times for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Suscripciones push (una por teléfono/navegador)
-- ============================================================
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

-- Guardar / quitar la suscripción de este teléfono. Si el teléfono lo usó otra persona antes,
-- la suscripción pasa a quien entró ahora (por eso es una función y no una política).
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language sql security definer set search_path = public as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
$$;
create function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- ============================================================
-- Envío de notificaciones (llama a /api/push en Vercel)
-- ============================================================
-- Dirección y clave del envío. Sin políticas: ningún usuario de la app puede leerla; solo las
-- funciones de abajo. Se llena una sola vez con supabase/push_setup.sql.
create table public.push_config (
  id     int primary key default 1 check (id = 1),
  url    text,
  secret text
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- items: [{ "user_ids": [uuid...], "title": "...", "body": "...", "tag": "..." }, ...]
create function public.push_send(items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cfg public.push_config;
begin
  select * into cfg from public.push_config where id = 1;
  if cfg.url is null or cfg.secret is null or jsonb_array_length(items) = 0 then
    return;
  end if;
  perform net.http_post(
    url := cfg.url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
    body := jsonb_build_object('notifications', items)
  );
end;
$$;
revoke all on function public.push_send(jsonb) from public, anon, authenticated;

-- Aviso manual del coordinador: llega también como notificación a los corredores de los dos
-- grupos y a los inductores de la base de ese cruce.
create function public.alerts_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  users jsonb;
begin
  select * into m from public.matches where id = new.match_id;
  select coalesce(jsonb_agg(distinct u), '[]'::jsonb) into users from (
    select user_id as u from public.team_runners where team_id in (m.team_a, m.team_b)
    union
    select user_id from public.base_staff where base_id = m.base_id
  ) x;
  perform public.push_send(jsonb_build_array(jsonb_build_object(
    'user_ids', users, 'title', 'Aviso del coordinador', 'body', new.message, 'tag', 'alert-' || new.id
  )));
  return new;
end;
$$;
create trigger alerts_after_insert after insert on public.alerts
  for each row execute function public.alerts_push();

-- Revisión de demoras (se ejecuta cada 10 s): un grupo está en demora si pasó su tiempo máximo
-- (del tramo, o el general) desde que terminó su cruce anterior y la base no confirmó la llegada.
-- Avisa al corredor, a la base y al coordinador. Mientras siga la demora, repite cada vez.
create function public.check_delays() returns void
language plpgsql security definer set search_path = public as $$
declare
  items jsonb := '[]'::jsonb;
  summary text := null;
  admins jsonb;
  r record;
begin
  for r in
    select m.id as match_id, m.round_number, b.name as base_name, t.team_id, tm.name as team_name,
           floor(extract(epoch from (now() - p.finished_at)) / 60)::int as elapsed,
           coalesce(bt.minutes, e.max_travel_minutes) as max_min
    from public.matches m
    join public.events e on e.id = m.event_id and e.is_active
    join public.bases b on b.id = m.base_id
    cross join lateral (values (m.team_a), (m.team_b)) as t(team_id)
    join public.teams tm on tm.id = t.team_id
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
    items := items || jsonb_build_array(jsonb_build_object(
      'user_ids', (select coalesce(jsonb_agg(user_id), '[]'::jsonb) from public.base_staff bs
                    join public.matches mm on mm.base_id = bs.base_id where mm.id = r.match_id),
      'title', format('Ronda %s: grupo en demora', r.round_number),
      'body', format('%s lleva %s min en el traslado.', r.team_name, r.elapsed),
      'tag', 'late-base-' || r.match_id || '-' || r.team_id
    ));
    summary := coalesce(summary || E'\n', '') || format('%s: %s min hacia %s', r.team_name, r.elapsed, r.base_name);
  end loop;

  if summary is not null then
    select coalesce(jsonb_agg(id), '[]'::jsonb) into admins from public.profiles where role = 'admin';
    items := items || jsonb_build_array(jsonb_build_object(
      'user_ids', admins, 'title', 'Grupos en demora', 'body', summary, 'tag', 'late-admin'
    ));
    perform public.push_send(items);
  end if;
end;
$$;
revoke all on function public.check_delays() from public, anon, authenticated;
