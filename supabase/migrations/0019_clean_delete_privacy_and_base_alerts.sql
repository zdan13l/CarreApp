  -- CarreApp · Borrado limpio, privacidad entre Carreras y avisos a las bases.
  --  * Eliminar una Carrera ya no deja filas huérfanas en score_audit (y se limpian las que ya había).
  --  * Una Carrera solo se puede eliminar si está DESACTIVADA (lo exige la base de datos, no solo la pantalla).
  --  * Privacidad: cada persona lee solo los datos de SU Carrera (el coordinador lee todas), y los puntajes solo los
  --    lee el coordinador, el inductor de esa base y los corredores de ese cruce: nadie puede saber quién va ganando
  --    antes de que se anuncie.
  --  * Un grupo ahora necesita al menos 1 corredor (puede ser un usuario compartido por la pareja).
  --  * Avisos del coordinador a la BASE (alerts.target): llegan como notificación y sonido a los inductores.
  -- Ejecutar completo en Supabase > SQL Editor.
  
  -- ---------------------------------------------------------------- helpers
  -- is_runner_of_match / server_now / the alerts rate limit come from 0017; they are repeated here (idempotent) so this
  -- script runs even where 0017 was not applied completely.
  create or replace function public.is_runner_of_match(p_match uuid) returns boolean
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
  
  create or replace function public.server_now() returns timestamptz
  language sql stable as $$ select now() $$;
  revoke all on function public.server_now() from public, anon;
  grant execute on function public.server_now() to authenticated;
  
  create or replace function public.my_event_id() returns uuid
  language sql stable security definer set search_path = public as $$
    select event_id from public.profiles where id = auth.uid();
  $$;
  revoke all on function public.my_event_id() from public, anon;
  grant execute on function public.my_event_id() to authenticated;
  
  -- ---------------------------------------------------------------- borrado limpio
  delete from public.score_audit where event_id is null; -- orphans left by deleted Carreras / matches
  
  create or replace function public.after_score_change() returns trigger
  language plpgsql security definer set search_path = public as $$
  declare
    v_match uuid := coalesce(new.match_id, old.match_id);
    v_count int;
  begin
    -- The match is already gone (it is being deleted, e.g. with its whole Carrera): there is nothing to record.
    if tg_op = 'DELETE' and not exists (select 1 from public.matches where id = v_match) then
      return null;
    end if;
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
  
  create or replace function public.events_delete_guard() returns trigger
  language plpgsql set search_path = public as $$
  begin
    if old.is_active then
      raise exception 'Desactiva la Carrera antes de eliminarla.';
    end if;
    return old;
  end;
  $$;
  drop trigger if exists events_delete_guard on public.events;
  create trigger events_delete_guard before delete on public.events
    for each row execute function public.events_delete_guard();
  
  -- ---------------------------------------------------------------- privacidad entre Carreras
  drop policy if exists events_read on public.events;
  create policy events_read on public.events for select to authenticated
    using (public.is_admin() or id = public.my_event_id());
  
  drop policy if exists teams_read on public.teams;
  create policy teams_read on public.teams for select to authenticated
    using (public.is_admin() or event_id = public.my_event_id());
  
  drop policy if exists bases_read on public.bases;
  create policy bases_read on public.bases for select to authenticated
    using (public.is_admin() or event_id = public.my_event_id());
  
  drop policy if exists matches_read on public.matches;
  create policy matches_read on public.matches for select to authenticated
    using (public.is_admin() or event_id = public.my_event_id());
  
  drop policy if exists travel_times_read on public.base_travel_times;
  create policy travel_times_read on public.base_travel_times for select to authenticated
    using (public.is_admin() or event_id = public.my_event_id());
  
  drop policy if exists team_runners_read on public.team_runners;
  create policy team_runners_read on public.team_runners for select to authenticated
    using (public.is_admin() or user_id = auth.uid());
  
  drop policy if exists base_staff_read on public.base_staff;
  create policy base_staff_read on public.base_staff for select to authenticated
    using (public.is_admin() or user_id = auth.uid());
  
  -- Scores (and so the standings, a view that respects these policies): the coordinator, the inductor of that base
  -- and the runners of that match only.
  drop policy if exists scores_read on public.match_scores;
  create policy scores_read on public.match_scores for select to authenticated
    using (
      public.is_admin()
      or exists (
        select 1 from public.matches m
        where m.id = match_id and (public.is_staff_of_base(m.base_id) or public.is_runner_of_match(m.id))
      )
    );
  
  -- ---------------------------------------------------------------- un grupo = al menos un usuario
  create or replace function public.event_problems(p_event uuid) returns text[]
  language plpgsql stable set search_path = public as $$
  declare
    problems text[] := '{}';
    r record;
  begin
    if (select count(*) from teams where event_id = p_event) < 2 then
      problems := array_append(problems, 'Debe haber al menos 2 grupos.');
    end if;
    if (select count(*) from bases where event_id = p_event) < 1 then
      problems := array_append(problems, 'Debe haber al menos 1 base.');
    end if;
  
    for r in
      select t.name, t.photo_path,
             (select count(*) from team_runners tr where tr.team_id = t.id) as runners
      from teams t where t.event_id = p_event order by t.sort_order, t.name
    loop
      if r.photo_path is null then
        problems := array_append(problems, format('El grupo "%s" no tiene foto.', r.name));
      end if;
      if r.runners < 1 then
        problems := array_append(problems, format('El grupo "%s" no tiene ningún corredor (usuario) asignado.', r.name));
      end if;
    end loop;
  
    for r in
      select b.name, b.location_photo_path,
             (select d.info from base_details d where d.base_id = b.id) as info,
             (select count(*) from base_questions q where q.base_id = b.id) as questions
      from bases b where b.event_id = p_event order by b.sort_order, b.name
    loop
      if r.location_photo_path is null then
        problems := array_append(problems, format('La base "%s" no tiene foto del lugar.', r.name));
      end if;
      if r.info is null or length(trim(r.info)) = 0 then
        problems := array_append(problems, format('La base "%s" no tiene la información que se da.', r.name));
      end if;
      if r.questions < 3 then
        problems := array_append(problems, format('La base "%s" tiene %s de 3 preguntas.', r.name, r.questions));
      end if;
    end loop;
  
    for r in
      select p.full_name
      from base_staff bs
      join bases b on b.id = bs.base_id and b.event_id = p_event
      join profiles p on p.id = bs.user_id
      group by p.id, p.full_name having count(*) > 1
    loop
      problems := array_append(problems, format('%s está asignado a más de una base.', r.full_name));
    end loop;
    for r in
      select p.full_name
      from team_runners tr
      join teams t on t.id = tr.team_id and t.event_id = p_event
      join profiles p on p.id = tr.user_id
      group by p.id, p.full_name having count(*) > 1
    loop
      problems := array_append(problems, format('%s está en más de un grupo.', r.full_name));
    end loop;
  
    return problems;
  end;
  $$;
  
  -- ---------------------------------------------------------------- avisos a la base
  alter table public.alerts
    add column if not exists target text not null default 'groups' check (target in ('groups', 'base'));
  
  drop policy if exists alerts_read on public.alerts;
  create policy alerts_read on public.alerts for select to authenticated
    using (
      public.is_admin()
      or (target = 'groups' and public.is_runner_of_match(match_id))
      or public.is_staff_of_match(match_id)
    );
  
  drop policy if exists alerts_base_insert on public.alerts;
  create policy alerts_base_insert on public.alerts for insert to authenticated
    with check (
      public.is_staff_of_match(match_id)
      and target = 'groups' -- a base warns the groups, never itself
      and event_id = (select m.event_id from public.matches m where m.id = match_id)
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
        from public.team_runners where team_id in (m.team_a, m.team_b);
      perform public.push_send(jsonb_build_array(jsonb_build_object(
        'user_ids', users, 'title', 'Aviso: ¡apúrense!', 'body', new.message, 'tag', 'alert-' || new.id
      )));
    end if;
    return new;
  end;
  $$;
  revoke all on function public.alerts_push() from public, anon, authenticated;
  
  -- The 20-second limit between alerts of a base (also from 0017).
  create or replace function public.alerts_rate_limit() returns trigger
  language plpgsql security definer set search_path = public as $$
  begin
    if public.is_admin() then return null; end if;
    if exists (
      select 1 from public.alerts a
      where a.match_id = new.match_id and a.created_by is not distinct from new.created_by and a.id <> new.id and a.created_at > now() - interval '20 seconds'
    ) then
      raise exception 'Espera unos segundos antes de enviar otro aviso a este cruce.';
    end if;
    return null;
  end;
  $$;
  revoke all on function public.alerts_rate_limit() from public, anon, authenticated;
  drop trigger if exists alerts_rate_limit on public.alerts;
  create trigger alerts_rate_limit after insert on public.alerts
    for each row execute function public.alerts_rate_limit();
