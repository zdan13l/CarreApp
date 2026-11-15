-- CarreApp · Bloque 5: la información y las preguntas de una base son PRIVADAS.
-- Solo las ven el coordinador y los inductores de esa base. Los corredores (y las demás
-- bases) solo pueden ver el nombre y la foto de dónde queda. Se aplica en la base de datos,
-- no solo ocultando campos en la pantalla.
-- Además, las bases pasan a tiempo real para que los corredores vean el cambio de foto.
-- Ejecutar completo en Supabase > SQL Editor.

-- ============================================================
-- Información de la base en una tabla aparte (RLS más estricto)
-- ============================================================
create table public.base_details (
  base_id uuid primary key references public.bases (id) on delete cascade,
  info    text
);

insert into public.base_details (base_id, info)
select id, info from public.bases where info is not null;

-- El trigger de 0007 mencionaba bases.info: se reemplaza antes de borrar la columna.
create or replace function public.restrict_base_staff_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (
    new.name is distinct from old.name
    or new.event_id is distinct from old.event_id
    or new.sort_order is distinct from old.sort_order
  ) then
    raise exception 'Una base solo puede cambiar la foto de su ubicación.';
  end if;
  return new;
end;
$$;

alter table public.bases drop column info;

-- ============================================================
-- Permisos: admin o inductores de esa base
-- ============================================================
create function public.is_staff_of_base(p_base uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.base_staff where base_id = p_base and user_id = auth.uid());
$$;

alter table public.base_details enable row level security;
create policy base_details_read on public.base_details for select to authenticated
  using (public.is_admin() or public.is_staff_of_base(base_id));
create policy base_details_admin on public.base_details for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Las preguntas dejan de ser legibles por todos.
drop policy base_questions_read on public.base_questions;
create policy base_questions_read on public.base_questions for select to authenticated
  using (public.is_admin() or public.is_staff_of_base(base_id));

-- ============================================================
-- Validación de la Carrera: la información ahora vive en base_details
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

-- ============================================================
-- Tiempo real: cambios de las bases (por ejemplo, la foto)
-- ============================================================
alter publication supabase_realtime add table public.bases;
