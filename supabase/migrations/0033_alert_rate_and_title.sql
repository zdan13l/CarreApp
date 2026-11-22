-- CarreApp · migración 0033: avisos más ágiles y con el nombre corto.
--  * El límite entre avisos de una base al mismo destinatario baja de 20 s a 15 s (la app deja descansar el botón de apurar 16 s).
--  * La notificación al inductor dice "Aviso del coordi".
-- Ejecutar completo en Supabase > SQL Editor.

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
      'user_ids', users, 'title', 'Aviso del coordi', 'body', new.message, 'tag', 'alert-' || new.id
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

revoke all on function public.alerts_push() from public, anon, authenticated;

create or replace function public.alerts_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return null; end if;
  if exists (
    select 1 from public.alerts a
    where a.match_id = new.match_id and a.created_by is not distinct from new.created_by and a.id <> new.id
      and a.team_id is not distinct from new.team_id
      and a.created_at > now() - interval '15 seconds'
  ) then
    raise exception 'Espera unos segundos antes de enviar otro aviso a este cruce.';
  end if;
  return null;
end;
$$;
revoke all on function public.alerts_rate_limit() from public, anon, authenticated;
