-- CarreApp · Bloque 2: fotos (Storage) y validación para activar una Carrera.
-- Ejecutar completo en Supabase > SQL Editor (con el rol postgres, el de por defecto).

-- ============================================================
-- Storage: bucket de fotos (grupos y bases)
-- ============================================================
-- Público para lectura (las fotos no son sensibles y así cargan rápido con datos móviles).
-- Solo el admin puede subir, reemplazar o borrar. Límite de 2 MB por foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_admin());
create policy photos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_admin());
create policy photos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());
create policy photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- ============================================================
-- Validación de una Carrera
-- ============================================================
-- Devuelve la lista de problemas que impiden activar la Carrera (vacía = lista).
create function public.event_problems(p_event uuid) returns text[]
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

  for r in select name, photo_path from teams where event_id = p_event order by sort_order, name loop
    if r.photo_path is null then
      problems := array_append(problems, format('El grupo "%s" no tiene foto.', r.name));
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

  return problems;
end;
$$;

-- Bloquea activar una Carrera incompleta (la regla vive en la base de datos, no solo en la app).
create function public.validate_event_activation() returns trigger
language plpgsql set search_path = public as $$
declare problems text[];
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    problems := public.event_problems(new.id);
    if array_length(problems, 1) > 0 then
      raise exception 'No se puede activar la Carrera: %', array_to_string(problems, ' ');
    end if;
  end if;
  return new;
end;
$$;
create trigger events_validate_activation before insert or update on public.events
  for each row execute function public.validate_event_activation();
