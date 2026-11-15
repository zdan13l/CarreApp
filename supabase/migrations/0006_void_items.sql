-- CarrerApp · Bloque 4: ítems invalidados.
-- Si por tiempo no se hace una barra, una pregunta o un minijuego, SOLO el coordinador puede
-- marcar ese ítem como "invalidado": nadie suma, la base no puede puntuarlo y el cruce se
-- considera terminado cuando todos sus ítems están puntuados o invalidados (3 en total).
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.match_scores add column voided boolean not null default false;

-- Un puntaje tiene ganador, o está invalidado (sin ganador). Nunca un empate.
alter table public.match_scores drop constraint match_scores_winner_required;
alter table public.match_scores add constraint match_scores_winner_or_void
  check ((voided and winner_team_id is null) or (not voided and winner_team_id is not null)) not valid;

-- La auditoría también registra las invalidaciones.
alter table public.score_audit add column old_voided boolean, add column new_voided boolean;

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
    new.awarded_by := auth.uid();
    new.awarded_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.after_score_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_match uuid := coalesce(new.match_id, old.match_id);
  v_count int;
begin
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

  -- Puntuado o invalidado cuenta como ítem resuelto.
  select count(*) into v_count from public.match_scores where match_id = v_match;
  update public.matches
     set status = case when v_count >= 3 then 'finished'
                       when v_count >= 1 then 'in_progress'
                       else 'pending' end::public.match_status
   where id = v_match;
  return null;
end;
$$;
