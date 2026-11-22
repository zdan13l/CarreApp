-- CarreApp · migración 0031: el aviso "apúrense" puede ir a UN solo grupo del cruce.
-- Antes un aviso de una base (o del coordinador) llegaba a los corredores de los DOS grupos del cruce. Pero a veces uno de los dos ya llegó
-- y el aviso le molesta: la base ahora elige entre los dos grupos o solo uno.
--  * alerts.team_id (opcional): si está, el aviso es solo para los corredores de ese grupo; si no, para los dos como siempre.
--  * El grupo tiene que jugar ese cruce (trigger alerts_team_check).
--  * Un corredor solo lee los avisos de su cruce que son para los dos grupos o para el suyo (alerts_read).
--  * El límite de 20 s entre avisos de una base cuenta por destinatario: apurar al grupo A y enseguida al grupo B se puede.
-- Los avisos existentes (team_id nulo) siguen yendo a los dos grupos. Ejecutar completo en Supabase > SQL Editor.

alter table public.alerts add column if not exists team_id uuid references public.teams (id) on delete cascade;

create or replace function public.is_runner_of_team(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_runners tr where tr.team_id = p_team and tr.user_id = auth.uid());
$$;
revoke all on function public.is_runner_of_team(uuid) from public, anon;
grant execute on function public.is_runner_of_team(uuid) to authenticated;

create or replace function public.alerts_team_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.team_id is not null and not exists (
    select 1 from public.matches m where m.id = new.match_id and new.team_id in (m.team_a, m.team_b)
  ) then
    raise exception 'Ese grupo no juega este cruce.';
  end if;
  return new;
end;
$$;
revoke all on function public.alerts_team_check() from public, anon, authenticated;
drop trigger if exists alerts_team_check on public.alerts;
create trigger alerts_team_check before insert on public.alerts
  for each row execute function public.alerts_team_check();

drop policy if exists alerts_read on public.alerts;
create policy alerts_read on public.alerts for select to authenticated
  using (
    public.is_admin()
    or (target = 'groups' and public.is_runner_of_match(match_id) and (team_id is null or public.is_runner_of_team(team_id)))
    or public.is_staff_of_match(match_id)
  );

create or replace function public.alerts_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  users jsonb;
begin
  select * into m from public.matches where id = new.match_id;
  if new.target = 'base' then
    select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb) into users from public.base_staff where base_id = m.base_id;
    perform public.push_send(jsonb_build_array(jsonb_build_object(
      'user_ids', users, 'title', 'Aviso del coordinador', 'body', new.message, 'tag', 'alert-' || new.id
    )));
  else
    select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb) into users
      from public.team_runners
      where case when new.team_id is not null then team_id = new.team_id else team_id in (m.team_a, m.team_b) end;
    perform public.push_send(jsonb_build_array(jsonb_build_object(
      'user_ids', users, 'title', 'Aviso: ¡apúrense!', 'body', new.message, 'tag', 'alert-' || new.id
    )));
  end if;
  return new;
end;
$$;
revoke all on function public.alerts_push() from public, anon, authenticated;

create or replace function public.alerts_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return null; end if;
  if exists (
    select 1 from public.alerts a
    where a.match_id = new.match_id and a.created_by is not distinct from new.created_by and a.id <> new.id
      and a.team_id is not distinct from new.team_id
      and a.created_at > now() - interval '20 seconds'
  ) then
    raise exception 'Espera unos segundos antes de enviar otro aviso a este cruce.';
  end if;
  return null;
end;
$$;
revoke all on function public.alerts_rate_limit() from public, anon, authenticated;
