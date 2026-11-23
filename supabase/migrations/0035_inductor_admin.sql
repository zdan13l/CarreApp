-- CarreApp · migración 0035: el catálogo vivo de la inducción (para que CarreApp perdure sin tocar el código).
--  * Ancestros: un inductor que "cuelga el saco" pasa a `ancestor`: sigue entrando unos meses y luego su perfil queda deshabilitado
--    (passports.status, disable_at). El coordinador puede reactivarlo o deshabilitarlo ya.
--  * Comités (public.committees): se agregan, se renombran y se desactivan desde el panel. El coordi de cada comité en cada semestre sigue
--    siendo la marca committee_lead de los registros (0026): cambia de un semestre a otro.
--  * Grupos de carreras (career_groups) y carreras (careers): Tronicas, Sistemas, Industrial, Biomec y Civil; una carrera pertenece a un grupo.
--  * Temáticas (themes) con su cultura por grupo: siempre existe una temática global (sin cultura propia) y cada semestre usa una específica
--    (mitologías). theme_cultures son las culturas de la temática y group_cultures dice qué cultura le toca a cada grupo de carreras en ella.
-- Ejecutar completo en Supabase > SQL Editor.

-- ============================================================ ancestros
alter table public.passports
  add column if not exists status text not null default 'active' check (status in ('active', 'ancestor', 'disabled')),
  add column if not exists ancestor_at timestamptz,
  add column if not exists disable_at timestamptz;

-- active, or an ancestor whose time has not run out
create or replace function public.passport_active(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.passports p
    where p.id = p_id and (p.status = 'active' or (p.status = 'ancestor' and (p.disable_at is null or p.disable_at > now())))
  );
$$;
revoke all on function public.passport_active(uuid) from public, anon;
grant execute on function public.passport_active(uuid) to authenticated;

drop policy if exists passports_select on public.passports;
create policy passports_select on public.passports for select to authenticated
  using ((id = auth.uid() and public.passport_active(id)) or public.is_admin());

drop policy if exists passport_records_select on public.passport_records;
create policy passport_records_select on public.passport_records for select to authenticated
  using ((passport_id = auth.uid() and public.passport_active(passport_id)) or public.is_admin());

drop policy if exists passport_stamps_select on public.passport_stamps;
create policy passport_stamps_select on public.passport_stamps for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.passport_records r where r.id = record_id and r.passport_id = auth.uid() and public.passport_active(r.passport_id)
  ));

-- ============================================================ comités
create table if not exists public.committees (
  key        text primary key check (key ~ '^[a-z]{3,20}$'),
  name       text not null check (length(trim(name)) between 1 and 30),
  tagline    text check (tagline is null or length(tagline) <= 60),
  myth       text check (myth is null or length(myth) <= 200),
  ink        int not null default 1 check (ink between 1 and 5),
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.committees (key, name, tagline, myth, ink, sort_order) values
  ('clausura', 'Clausura', 'La bata de Homero', 'La bata azul con la que Homero recitaba sus poemas.', 1, 1),
  ('meraki', 'Meraki', 'Con el alma, la pasión y el corazón', 'Psique, el alma en forma de mariposa: servir con todo el corazón.', 4, 2),
  ('conzumo', 'Conzumo', 'La copa de Dionisio', 'La copa de vino del dios Dionisio.', 2, 3),
  ('carrera', 'Carrera', 'Las olimpiadas', 'Los juegos de la Grecia antigua: el corredor y la corona de laurel.', 3, 4),
  ('caos', 'Caos', 'El fuego de Prometeo', 'Prometeo amaba tanto a los humanos que les regaló el fuego: el fuego que enciende otros fuegos.', 5, 5),
  ('bienvenida', 'Bienvenida', 'Quien te recibe', 'El chaleco de quien da la bienvenida: la primera cara que ven los neos.', 1, 6)
on conflict (key) do nothing;
alter table public.committees enable row level security;
drop policy if exists committees_read on public.committees;
create policy committees_read on public.committees for select to authenticated using (true);
drop policy if exists committees_admin on public.committees;
create policy committees_admin on public.committees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================ grupos de carreras y carreras
create table if not exists public.career_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) between 1 and 40),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.careers (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique check (length(trim(name)) between 1 and 60),
  group_id uuid not null references public.career_groups (id) on delete restrict
);
create index if not exists careers_group_idx on public.careers (group_id);

-- ============================================================ temáticas
create table if not exists public.themes (
  key        text primary key check (key ~ '^[a-z0-9_-]{2,30}$'),
  name       text not null check (length(trim(name)) between 1 and 40),
  is_global  boolean not null default false,
  created_at timestamptz not null default now()
);
-- there is always ONE global theme
create unique index if not exists themes_one_global on public.themes (is_global) where is_global;

create table if not exists public.theme_cultures (
  theme_key  text not null references public.themes (key) on delete cascade,
  key        text not null check (key ~ '^[a-z_]{2,20}$'),
  name       text not null check (length(trim(name)) between 1 and 30),
  myth       text check (myth is null or length(myth) <= 160),
  ink        int not null default 1 check (ink between 1 and 5),
  ornament   text not null default 'plain' check (ornament in ('runes', 'meander', 'steps', 'clouds', 'lotus', 'plain')),
  emblem     text not null default 'Estrella' check (length(emblem) between 1 and 30),
  sort_order int not null default 0,
  primary key (theme_key, key)
);
create table if not exists public.group_cultures (
  theme_key   text not null,
  group_id    uuid not null references public.career_groups (id) on delete cascade,
  culture_key text not null,
  primary key (theme_key, group_id),
  foreign key (theme_key, culture_key) references public.theme_cultures (theme_key, key) on delete cascade
);

-- the global theme can be neither deleted nor stop being the global one
create or replace function public.themes_keep_global() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.is_global then raise exception 'La temática global no se puede borrar.'; end if;
    return old;
  end if;
  if old.is_global and not new.is_global then raise exception 'Siempre debe existir una temática global.'; end if;
  return new;
end;
$$;
drop trigger if exists themes_keep_global on public.themes;
create trigger themes_keep_global before update or delete on public.themes
  for each row execute function public.themes_keep_global();

-- seeds: what the app already did with its code
insert into public.themes (key, name, is_global) values ('global', 'Global', true), ('mitologias', 'Mitologías', false) on conflict (key) do nothing;
insert into public.theme_cultures (theme_key, key, name, myth, ink, ornament, emblem, sort_order) values
  ('global', 'general', 'Tu grupo', 'Tu lugar en esta inducción', 1, 'plain', 'Estrella', 1),
  ('mitologias', 'nordica', 'Nórdica', 'Runas, martillos y el árbol del mundo', 4, 'runes', 'Drakkar', 1),
  ('mitologias', 'griega', 'Griega', 'Dioses del Olimpo, héroes y monstruos', 1, 'meander', 'Templo', 2),
  ('mitologias', 'mexicana', 'Mexicana', 'El quinto sol y la serpiente emplumada', 3, 'steps', 'Pirámide', 3),
  ('mitologias', 'china', 'China', 'Dragones, fénix y el equilibrio del yin y el yang', 2, 'clouds', 'Pagoda', 4),
  ('mitologias', 'egipcia', 'Egipcia', 'Ra, Horus y el viaje al más allá', 5, 'lotus', 'Pirámides', 5)
on conflict (theme_key, key) do nothing;
insert into public.career_groups (name, sort_order) values ('Tronicas', 1), ('Sistemas', 2), ('Industrial', 3), ('Biomec', 4), ('Civil', 5) on conflict (name) do nothing;
insert into public.careers (name, group_id)
  select c.name, g.id from (values
    ('Electrónica', 'Tronicas'), ('Mecatrónica', 'Tronicas'), ('Redes', 'Tronicas'), ('Sistemas', 'Sistemas'), ('Industrial', 'Industrial'),
    ('Bioingeniería', 'Biomec'), ('Mecánica', 'Biomec'), ('Civil', 'Civil')
  ) as c(name, grp) join public.career_groups g on g.name = c.grp
  on conflict (name) do nothing;
insert into public.group_cultures (theme_key, group_id, culture_key)
  select 'mitologias', g.id, m.culture from (values
    ('Tronicas', 'griega'), ('Sistemas', 'nordica'), ('Industrial', 'mexicana'), ('Biomec', 'china'), ('Civil', 'egipcia')
  ) as m(grp, culture) join public.career_groups g on g.name = m.grp
  on conflict (theme_key, group_id) do nothing;

-- ============================================================ permisos: todos leen el catálogo, solo el coordi lo escribe
alter table public.career_groups  enable row level security;
alter table public.careers        enable row level security;
alter table public.themes         enable row level security;
alter table public.theme_cultures enable row level security;
alter table public.group_cultures enable row level security;
do $$
declare t text;
begin
  foreach t in array array['career_groups', 'careers', 'themes', 'theme_cultures', 'group_cultures'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;
