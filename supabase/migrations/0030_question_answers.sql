-- CarreApp · migración 0030: cada base tiene mínimo 5 preguntas, cada una con su respuesta.
--  * base_questions.answer: la respuesta de cada pregunta, para que el inductor la tenga a la mano (la ve solo el coordinador y su base, como la pregunta).
--  * La posición de una pregunta puede llegar a 10 (antes 3): son 5 como mínimo y se pueden agregar más.
--  * Al activar una Carrera (event_problems) cada base debe tener al menos 5 preguntas con su respuesta.
-- Las Carreras ya activas siguen funcionando; la regla se aplica la próxima vez que se active una.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.base_questions add column answer text check (answer is null or length(answer) <= 600);
alter table public.base_questions drop constraint if exists base_questions_position_check;
alter table public.base_questions add constraint base_questions_position_check check (position between 1 and 10);

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
           (select count(*) from base_questions q
             where q.base_id = b.id and length(trim(q.question)) > 0 and length(trim(coalesce(q.answer, ''))) > 0) as questions
    from bases b where b.event_id = p_event order by b.sort_order, b.name
  loop
    if r.location_photo_path is null then
      problems := array_append(problems, format('La base "%s" no tiene foto del lugar.', r.name));
    end if;
    if r.info is null or length(trim(r.info)) = 0 then
      problems := array_append(problems, format('La base "%s" no tiene la información que se da.', r.name));
    end if;
    if r.questions < 5 then
      problems := array_append(problems, format('La base "%s" tiene %s de 5 preguntas con su respuesta (mínimo).', r.name, r.questions));
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
