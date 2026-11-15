-- CarreApp · Bloque 3: reglas de personal.
--  * Un inductor atiende UNA sola base por Carrera.
--  * Un corredor pertenece a UN solo grupo por Carrera.
--  * Cada grupo necesita al menos 2 corredores para activar la Carrera.
-- Ejecutar completo en Supabase > SQL Editor (rol postgres, el de por defecto).

-- ============================================================
-- Un inductor, una base (por Carrera)
-- ============================================================
create function public.validate_base_staff() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from public.base_staff bs
    join public.bases other on other.id = bs.base_id
    join public.bases mine on mine.id = new.base_id
    where bs.user_id = new.user_id
      and bs.base_id <> new.base_id
      and other.event_id = mine.event_id
  ) then
    raise exception 'Ese inductor ya está asignado a otra base de esta Carrera.';
  end if;
  return new;
end;
$$;
create trigger base_staff_validate before insert or update on public.base_staff
  for each row execute function public.validate_base_staff();

-- ============================================================
-- Un corredor, un grupo (por Carrera)
-- ============================================================
create function public.validate_team_runner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from public.team_runners tr
    join public.teams other on other.id = tr.team_id
    join public.teams mine on mine.id = new.team_id
    where tr.user_id = new.user_id
      and tr.team_id <> new.team_id
      and other.event_id = mine.event_id
  ) then
    raise exception 'Ese corredor ya está en otro grupo de esta Carrera.';
  end if;
  return new;
end;
$$;
create trigger team_runners_validate before insert or update on public.team_runners
  for each row execute function public.validate_team_runner();

-- ============================================================
-- Validación de la Carrera: ahora también exige 2 corredores por grupo
-- y detecta asignaciones repetidas ya existentes.
-- ============================================================
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
    if r.runners < 2 then
      problems := array_append(problems, format('El grupo "%s" tiene %s de 2 corredores como mínimo.', r.name, r.runners));
    end if;
  end loop;

  for r in
    select b.name, b.location_photo_path, b.info,
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

  -- Asignaciones repetidas que existían antes de estas reglas.
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
