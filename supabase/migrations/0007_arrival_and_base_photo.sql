-- CarreApp · Bloque 4: llegada de los grupos y cambio de foto de la base.
--  * La base confirma que llegaron ambos grupos; el cruce pasa a "en juego" y queda la hora.
--  * El inductor de una base puede cambiar la foto de su ubicación (por ejemplo, si la base
--    se mueve por lluvia). No puede cambiar nada más de la base.
-- Ejecutar completo en Supabase > SQL Editor.

-- ============================================================
-- Llegada de los grupos
-- ============================================================
alter table public.matches add column arrived_at timestamptz;

-- La base (o el admin) confirma que ambos grupos llegaron. Función segura: la base no
-- recibe permiso general de escritura sobre matches, solo esta acción.
create function public.confirm_arrival(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_staff_of_match(p_match)) then
    raise exception 'Solo la base de este cruce puede confirmar la llegada.';
  end if;
  update public.matches
     set arrived_at = coalesce(arrived_at, now()),
         status = case when status = 'pending' then 'in_progress' else status end::public.match_status
   where id = p_match;
end;
$$;
grant execute on function public.confirm_arrival(uuid) to authenticated;

-- Un cruce con llegada confirmada sigue "en juego" aunque se borren sus puntajes.
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

  select count(*) into v_count from public.match_scores where match_id = v_match;
  update public.matches m
     set status = case when v_count >= 3 then 'finished'
                       when v_count >= 1 or m.arrived_at is not null then 'in_progress'
                       else 'pending' end::public.match_status
   where m.id = v_match;
  return null;
end;
$$;

-- ============================================================
-- Foto de la base editable por sus inductores
-- ============================================================
create policy bases_staff_update on public.bases for update to authenticated
  using (exists (select 1 from public.base_staff bs where bs.base_id = bases.id and bs.user_id = auth.uid()))
  with check (exists (select 1 from public.base_staff bs where bs.base_id = bases.id and bs.user_id = auth.uid()));

-- RLS no filtra por columna: este trigger deja a un inductor cambiar SOLO la foto.
create function public.restrict_base_staff_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (
    new.name is distinct from old.name
    or new.info is distinct from old.info
    or new.event_id is distinct from old.event_id
    or new.sort_order is distinct from old.sort_order
  ) then
    raise exception 'Una base solo puede cambiar la foto de su ubicación.';
  end if;
  return new;
end;
$$;
create trigger bases_restrict_staff_update before update on public.bases
  for each row execute function public.restrict_base_staff_update();

-- Storage: un inductor de base puede subir fotos a la carpeta bases/.
create policy photos_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'photos');
create policy photos_staff_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and name like 'bases/%'
    and exists (select 1 from public.base_staff bs where bs.user_id = auth.uid())
  );
