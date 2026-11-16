-- CarreApp · Bloque 7: alertas de demora entre bases.
--  * El coordinador configura el tiempo máximo de traslado entre bases (minutos).
--  * Cada cruce guarda la hora en que terminó: de ahí se mide cuánto lleva un grupo en camino.
--  * Avisos manuales: el coordinador manda un mensaje que reciben los grupos y la base de un cruce.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.events
  add column max_travel_minutes int not null default 10
  check (max_travel_minutes between 1 and 120);

alter table public.matches add column finished_at timestamptz;

-- Cruces ya terminados: se toma la hora del último puntaje.
update public.matches m
   set finished_at = (select max(s.awarded_at) from public.match_scores s where s.match_id = m.id)
 where m.status = 'finished';

-- Al terminar un cruce (3 ítems puntuados o invalidados) queda su hora de término.
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
                       else 'pending' end::public.match_status,
         finished_at = case when v_count >= 3 then coalesce(m.finished_at, now()) else null end
   where m.id = v_match;
  return null;
end;
$$;

-- ============================================================
-- Avisos manuales del coordinador
-- ============================================================
create table public.alerts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  match_id   uuid not null references public.matches (id) on delete cascade,
  message    text not null check (length(trim(message)) between 1 and 200),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index alerts_match_created on public.alerts (match_id, created_at desc);

alter table public.alerts enable row level security;
-- Los avisos los leen los usuarios autenticados (cada pantalla filtra los de su cruce);
-- solo el coordinador los crea o borra.
create policy alerts_read on public.alerts for select to authenticated using (true);
create policy alerts_admin on public.alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.alerts;
