-- CarreApp · migración 0029: la rotación de las bases entre ronda y ronda.
-- Para que los grupos lleguen a la siguiente base más o menos a la misma distancia, nadie se va hasta que todas las bases terminen:
--  * El coordinador avisa "ya pueden rotar" para una ronda (round_rotations: una fila por Carrera y ronda).
--  * Cada base confirma que ya dejó ir a sus dos grupos (rotation_acks: una fila por rotación y base).
-- El coordinador ve cuántas bases ya confirmaron. Al desactivar la Carrera (0020) las rotaciones se reinician con el resto del avance.
-- Ejecutar completo en Supabase > SQL Editor.

create table public.round_rotations (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  round_number int  not null check (round_number > 0),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (event_id, round_number)
);

create table public.rotation_acks (
  rotation_id uuid not null references public.round_rotations (id) on delete cascade,
  base_id     uuid not null references public.bases (id) on delete cascade,
  acked_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  acked_at    timestamptz not null default now(),
  primary key (rotation_id, base_id)
);

alter table public.round_rotations enable row level security;
alter table public.rotation_acks   enable row level security;

-- Cada pantalla ve las rotaciones de SU Carrera; solo el coordinador las crea o las borra.
create policy rotations_read on public.round_rotations for select to authenticated
  using (public.is_admin() or event_id = public.my_event_id());
create policy rotations_admin on public.round_rotations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Una base lee y registra SU confirmación, y solo mientras su Carrera está activa (como todo lo que hace una base).
create policy acks_read on public.rotation_acks for select to authenticated
  using (public.is_admin() or public.is_staff_of_base(base_id));
create policy acks_insert on public.rotation_acks for insert to authenticated
  with check (
    public.is_staff_of_base(base_id)
    and exists (
      select 1
      from public.round_rotations r
      join public.bases b on b.event_id = r.event_id
      join public.events e on e.id = r.event_id
      where r.id = rotation_id and b.id = base_id and e.is_active
    )
  );
create policy acks_admin on public.rotation_acks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.round_rotations;
alter publication supabase_realtime add table public.rotation_acks;

-- Desactivar la Carrera reinicia también las rotaciones (sus confirmaciones se borran en cascada).
create or replace function public.reset_event_progress(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- deleting the scores writes one audit row each (the matches still exist): those rows go too, right below
  delete from public.match_scores where match_id in (select id from public.matches where event_id = p_event);
  delete from public.score_audit where event_id = p_event;
  update public.matches set status = 'pending', arrived_at = null, finished_at = null where event_id = p_event;
  delete from public.alerts where event_id = p_event;
  delete from public.team_locations where team_id in (select id from public.teams where event_id = p_event);
  delete from public.round_rotations where event_id = p_event;
end;
$$;
revoke all on function public.reset_event_progress(uuid) from public, anon, authenticated;
