-- CarreApp · migración 0028: el historial de puntajes de cada Carrera.
-- Desactivar una Carrera reinicia su avance (0020: puntajes, cambios, avisos y ubicaciones). Antes de ese reinicio ahora se guarda una
-- copia legible del resultado: la tabla final de los grupos y cada punto de cada cruce, con los NOMBRES (grupo, base) escritos tal cual,
-- para que el historial siga entero aunque después se borren los grupos, las bases o la Carrera. Solo el coordinador la ve.
-- Ejecutar completo en Supabase > SQL Editor.

create table public.event_archives (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid references public.events (id) on delete set null,
  event_name     text not null,
  term_name      text,                          -- la inducción de esa Carrera (2710…)
  archived_at    timestamptz not null default now(),
  matches_played int not null default 0,
  standings      jsonb not null default '[]',   -- [{ "team": "Fénix", "points": 14 }, …] del que más puntos tiene al que menos
  results        jsonb not null default '[]'    -- [{ "round": 1, "base": "Atrio", "team_a": "…", "team_b": "…", "item": "barra", "winner": "…" | null, "voided": false, "at": "…" }, …]
);
create index event_archives_event_idx on public.event_archives (event_id);

alter table public.event_archives enable row level security;
create policy event_archives_admin on public.event_archives for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.archive_event_scores(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  ev record;
  n  int;
begin
  select e.name, t.name as term_name into ev from public.events e left join public.terms t on t.id = e.term_id where e.id = p_event;
  if not found then return; end if;
  select count(*) into n from public.match_scores s join public.matches m on m.id = s.match_id where m.event_id = p_event;
  if n = 0 then return; end if; -- a Carrera that was never played leaves no history

  insert into public.event_archives (event_id, event_name, term_name, matches_played, standings, results)
  select
    p_event, ev.name, ev.term_name,
    (select count(*) from public.matches where event_id = p_event and status = 'finished'),
    coalesce((
      select jsonb_agg(jsonb_build_object('team', x.name, 'points', x.points) order by x.points desc, x.name)
      from (
        select t.name, count(s.id) as points
        from public.teams t left join public.match_scores s on s.winner_team_id = t.id
        where t.event_id = p_event group by t.id, t.name
      ) x
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('round', m.round_number, 'base', b.name, 'team_a', ta.name, 'team_b', tb.name, 'item', s.item::text,
                           'winner', w.name, 'voided', s.voided, 'at', s.awarded_at)
        order by m.round_number, b.name, s.item
      )
      from public.match_scores s
      join public.matches m on m.id = s.match_id
      join public.bases b on b.id = m.base_id
      join public.teams ta on ta.id = m.team_a
      join public.teams tb on tb.id = m.team_b
      left join public.teams w on w.id = s.winner_team_id
      where m.event_id = p_event
    ), '[]'::jsonb);
end;
$$;
revoke all on function public.archive_event_scores(uuid) from public, anon, authenticated;

create or replace function public.events_archive_scores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_active and not new.is_active then
    perform public.archive_event_scores(new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.events_archive_scores() from public, anon, authenticated;

-- Se dispara ANTES que events_reset_on_deactivate (0020): los disparadores del mismo evento corren en orden alfabético y
-- "events_archive_scores" va antes que "events_archive_stamps" (0023) y que "events_reset_on_deactivate".
create trigger events_archive_scores after update of is_active on public.events
  for each row execute function public.events_archive_scores();
