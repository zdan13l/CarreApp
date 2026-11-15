-- CarreApp · Bloque 1: esquema inicial, reglas de negocio y permisos (RLS)
-- Ejecutar completo en Supabase > SQL Editor.

-- ============================================================
-- Tipos
-- ============================================================
create type public.user_role as enum ('admin', 'base', 'runner');
create type public.score_item as enum ('barra', 'pregunta', 'minijuego');
create type public.match_status as enum ('pending', 'in_progress', 'finished');

-- ============================================================
-- Tablas
-- ============================================================

-- Una "Carrera" (edición). Permite reutilizar la app inducción a inducción.
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default false,
  created_at timestamptz not null default now()
);
-- Solo puede haber una Carrera activa a la vez.
create unique index events_single_active on public.events (is_active) where is_active;

-- Perfil de cada usuario (inductor). Se enlaza con auth.users.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  full_name  text not null check (length(trim(full_name)) > 0),
  role       public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  photo_path  text,                       -- ruta en Storage; se exige al activar la Carrera
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);

create table public.bases (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  location_photo_path text,               -- foto de dónde queda la base
  info                text,               -- información que se da en la base
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  unique (event_id, name)
);

-- Hasta 3 posibles preguntas por base.
create table public.base_questions (
  id        uuid primary key default gen_random_uuid(),
  base_id   uuid not null references public.bases (id) on delete cascade,
  position  smallint not null check (position between 1 and 3),
  question  text not null check (length(trim(question)) > 0),
  unique (base_id, position)
);

-- Inductores que atienden una base (puede haber uno o más).
create table public.base_staff (
  base_id uuid not null references public.bases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (base_id, user_id)
);

-- Corredores de cada grupo (uno o más). Solo uno transmite el GPS.
create table public.team_runners (
  team_id        uuid not null references public.teams (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  is_gps_tracker boolean not null default false,
  primary key (team_id, user_id)
);
create unique index team_single_gps_tracker on public.team_runners (team_id) where is_gps_tracker;

-- Enfrentamientos: en una ronda, en una base, entre dos grupos.
create table public.matches (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  base_id      uuid not null references public.bases (id) on delete cascade,
  round_number int not null check (round_number > 0),
  team_a       uuid not null references public.teams (id) on delete cascade,
  team_b       uuid not null references public.teams (id) on delete cascade,
  status       public.match_status not null default 'pending',
  created_at   timestamptz not null default now(),
  check (team_a <> team_b),
  unique (base_id, round_number)          -- una base atiende un solo cruce por ronda
);
-- Dos grupos nunca se enfrentan más de una vez en la misma Carrera.
create unique index matches_no_repeat_pair
  on public.matches (event_id, least(team_a, team_b), greatest(team_a, team_b));

-- Puntos: 1 por cada ítem (barra, pregunta, minijuego). winner null = empate (nadie suma).
create table public.match_scores (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  item           public.score_item not null,
  winner_team_id uuid references public.teams (id) on delete cascade,
  awarded_by     uuid references public.profiles (id) on delete set null,
  awarded_at     timestamptz not null default now(),
  unique (match_id, item)
);

-- Registro de auditoría de todo lo que se puso, cambió o borró.
create table public.score_audit (
  id         bigint generated always as identity primary key,
  match_id   uuid,
  item       public.score_item,
  action     text not null,               -- insert | update | delete
  old_winner uuid,
  new_winner uuid,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

-- ============================================================
-- Funciones auxiliares de permisos
-- ============================================================
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_staff_of_match(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches m
    join public.base_staff bs on bs.base_id = m.base_id
    where m.id = p_match and bs.user_id = auth.uid()
  );
$$;

-- ============================================================
-- Reglas de negocio (triggers)
-- ============================================================

-- Valida coherencia de un cruce: misma Carrera y ningún grupo en dos bases a la vez.
create function public.validate_match() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.teams where id = new.team_a and event_id = new.event_id)
     or not exists (select 1 from public.teams where id = new.team_b and event_id = new.event_id) then
    raise exception 'Los grupos del cruce deben pertenecer a la misma Carrera.';
  end if;
  if not exists (select 1 from public.bases where id = new.base_id and event_id = new.event_id) then
    raise exception 'La base del cruce debe pertenecer a la misma Carrera.';
  end if;
  if exists (
    select 1 from public.matches m
    where m.event_id = new.event_id
      and m.round_number = new.round_number
      and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
      and (m.team_a in (new.team_a, new.team_b) or m.team_b in (new.team_a, new.team_b))
  ) then
    raise exception 'Un grupo no puede estar en dos bases durante la misma ronda.';
  end if;
  return new;
end;
$$;
create trigger matches_validate before insert or update on public.matches
  for each row execute function public.validate_match();

-- Valida el puntaje: el ganador debe ser uno de los dos grupos del cruce y se registra quién lo puso.
create function public.validate_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  select * into m from public.matches where id = new.match_id;
  if new.winner_team_id is not null and new.winner_team_id not in (m.team_a, m.team_b) then
    raise exception 'El ganador debe ser uno de los dos grupos del enfrentamiento.';
  end if;
  if tg_op = 'INSERT' then
    new.awarded_by := auth.uid();
    new.awarded_at := now();
  end if;
  return new;
end;
$$;
create trigger scores_validate before insert or update on public.match_scores
  for each row execute function public.validate_score();

-- Auditoría + estado del cruce.
create function public.after_score_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_match uuid := coalesce(new.match_id, old.match_id);
  v_count int;
begin
  insert into public.score_audit (match_id, item, action, old_winner, new_winner, changed_by)
  values (
    v_match,
    coalesce(new.item, old.item),
    lower(tg_op),
    old.winner_team_id,
    new.winner_team_id,
    auth.uid()
  );

  select count(*) into v_count from public.match_scores where match_id = v_match;
  update public.matches
     set status = case when v_count >= 3 then 'finished'
                       when v_count >= 1 then 'in_progress'
                       else 'pending' end::public.match_status
   where id = v_match;
  return null;
end;
$$;
create trigger scores_after after insert or update or delete on public.match_scores
  for each row execute function public.after_score_change();

-- ============================================================
-- Ranking
-- ============================================================
create view public.team_standings with (security_invoker = true) as
select
  t.id as team_id,
  t.event_id,
  t.name,
  t.photo_path,
  count(s.id) as points
from public.teams t
left join public.match_scores s on s.winner_team_id = t.id
group by t.id;

-- ============================================================
-- Seguridad a nivel de fila (RLS)
-- ============================================================
alter table public.events         enable row level security;
alter table public.profiles       enable row level security;
alter table public.teams          enable row level security;
alter table public.bases          enable row level security;
alter table public.base_questions enable row level security;
alter table public.base_staff     enable row level security;
alter table public.team_runners   enable row level security;
alter table public.matches        enable row level security;
alter table public.match_scores   enable row level security;
alter table public.score_audit    enable row level security;

-- Perfiles: cada quien ve el suyo; el admin ve y gestiona todos.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Datos de la Carrera: lectura para cualquier usuario autenticado, escritura solo admin.
create policy events_read on public.events for select to authenticated using (true);
create policy events_admin on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy teams_read on public.teams for select to authenticated using (true);
create policy teams_admin on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy bases_read on public.bases for select to authenticated using (true);
create policy bases_admin on public.bases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy base_questions_read on public.base_questions for select to authenticated using (true);
create policy base_questions_admin on public.base_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy base_staff_read on public.base_staff for select to authenticated using (true);
create policy base_staff_admin on public.base_staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy team_runners_read on public.team_runners for select to authenticated using (true);
create policy team_runners_admin on public.team_runners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy matches_read on public.matches for select to authenticated using (true);
create policy matches_admin on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Puntajes: todos leen; la base solo puede INSERTAR en cruces de SU base; solo el admin corrige o borra.
create policy scores_read on public.match_scores for select to authenticated using (true);
create policy scores_base_insert on public.match_scores for insert to authenticated
  with check (public.is_staff_of_match(match_id));
create policy scores_admin on public.match_scores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Auditoría: solo el admin la consulta (se escribe únicamente desde triggers).
create policy audit_admin_read on public.score_audit for select to authenticated
  using (public.is_admin());

-- ============================================================
-- Tiempo real
-- ============================================================
alter publication supabase_realtime add table public.match_scores;
alter publication supabase_realtime add table public.matches;
