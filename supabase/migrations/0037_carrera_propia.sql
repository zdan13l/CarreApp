-- CarreApp · migración 0037 (Fase B del rediseño del panel): lo que es propio de cada carrera.
--  * Temática propia: al crear una carrera se COPIA una temática plantilla (themes sin dueño) a una temática de ese semestre (themes.term_id), con
--    sus subtemáticas (theme_cultures) y la subtemática de cada grupo de carreras (group_cultures). Editarla no toca otras carreras.
--  * event_committees: los comités asignados a cada carrera (los comités existen en el catálogo global; su participación es de la edición).
--  * events.coordinator_id: el coordi de la carrera (cambia cada semestre y no se hereda).
--  * event_seals: los sellos propios de cada carrera (temática, subtemáticas, grupos, comités y el sello dorado del coordi): forma, color e imagen.
--    Dentro de una carrera, un elemento tiene un solo sello y dos elementos del mismo tipo no comparten el mismo diseño.
-- Los inductores participantes de una carrera siguen siendo los registros (passport_records) del semestre de esa carrera.
-- Ejecutar completo en Supabase > SQL Editor.

-- ============================================================ temática propia
alter table public.themes
  add column if not exists term_id uuid references public.terms (id) on delete cascade,
  add column if not exists template_of text;

-- the copy of a template for one semester; returns the key of the new theme
create or replace function public.copy_theme_for_term(p_term uuid, p_template text) returns text
language plpgsql security definer set search_path = public as $$
declare k text; n int := 0; base text; tname text; src record;
begin
  select * into src from public.themes where key = p_template and term_id is null;
  if not found then return null; end if;
  select 'c' || regexp_replace(lower(name), '[^a-z0-9]', '', 'g') into base from public.terms where id = p_term;
  if base is null or length(base) < 2 then base := 'c' || substr(replace(p_term::text, '-', ''), 1, 8); end if;
  k := substr(base, 1, 30);
  while exists (select 1 from public.themes where key = k) loop
    n := n + 1;
    k := substr(base, 1, 26) || '-' || n;
  end loop;
  insert into public.themes (key, name, is_global, term_id, template_of) values (k, src.name, false, p_term, p_template);
  insert into public.theme_cultures (theme_key, key, name, myth, ink, ornament, emblem, sort_order)
    select k, key, name, myth, ink, ornament, emblem, sort_order from public.theme_cultures where theme_key = p_template;
  insert into public.group_cultures (theme_key, group_id, culture_key)
    select k, group_id, culture_key from public.group_cultures where theme_key = p_template;
  update public.terms set theme = k where id = p_term;
  return k;
end;
$$;
revoke all on function public.copy_theme_for_term(uuid, text) from public, anon, authenticated;

-- every semester that still points to a template gets its own copy
do $$
declare t record;
begin
  for t in
    select tm.id, tm.theme from public.terms tm
    join public.themes th on th.key = tm.theme and th.term_id is null and not th.is_global
  loop
    perform public.copy_theme_for_term(t.id, t.theme);
  end loop;
end $$;

-- ============================================================ comités asignados y coordi de la carrera
create table if not exists public.event_committees (
  event_id      uuid not null references public.events (id) on delete cascade,
  committee_key text not null references public.committees (key) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (event_id, committee_key)
);
insert into public.event_committees (event_id, committee_key)
  select e.id, c.key from public.events e cross join public.committees c where c.active
  on conflict do nothing;
alter table public.event_committees enable row level security;
drop policy if exists event_committees_read on public.event_committees;
create policy event_committees_read on public.event_committees for select to authenticated using (true);
drop policy if exists event_committees_admin on public.event_committees;
create policy event_committees_admin on public.event_committees for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.events add column if not exists coordinator_id uuid references public.passports (id) on delete set null;

-- ============================================================ sellos propios de la carrera
create table if not exists public.event_seals (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  kind       text not null check (kind in ('theme', 'subtheme', 'team', 'committee', 'coordinator')),
  ref        text not null check (length(ref) between 1 and 80),   -- the theme key, the subtheme key, the group id, the committee key, the coordi id
  shape      text not null default 'circle' check (shape in ('circle', 'hexagon', 'octagon', 'pentagon', 'shield', 'arch', 'roundsq', 'tablet', 'oval', 'wide', 'scallop')),
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  image_path text check (image_path is null or length(image_path) <= 200),
  created_at timestamptz not null default now(),
  unique (event_id, kind, ref)
);
-- one coordi seal per carrera
create unique index if not exists event_seals_one_coordinator on public.event_seals (event_id) where kind = 'coordinator';
create unique index if not exists event_seals_design on public.event_seals (event_id, kind, shape, lower(color), coalesce(image_path, ''));

create or replace function public.event_seals_unique_design() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.event_seals s
    where s.event_id = new.event_id and s.kind = new.kind and s.id <> new.id
      and s.shape = new.shape and lower(s.color) = lower(new.color) and coalesce(s.image_path, '') = coalesce(new.image_path, '')
  ) then
    raise exception 'Ese sello (forma, color e imagen) ya lo usa otro elemento del mismo tipo en esta carrera: cambia el color, la forma o la imagen.';
  end if;
  return new;
end;
$$;
drop trigger if exists event_seals_unique_design on public.event_seals;
create trigger event_seals_unique_design before insert or update on public.event_seals
  for each row execute function public.event_seals_unique_design();

alter table public.event_seals enable row level security;
drop policy if exists event_seals_read on public.event_seals;
create policy event_seals_read on public.event_seals for select to authenticated using (true);
drop policy if exists event_seals_admin on public.event_seals;
create policy event_seals_admin on public.event_seals for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- the coordi of a carrera always has the golden seal (kind coordinator; the color is the gold marker of the app)
create or replace function public.events_coordinator_seal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.event_seals where event_id = new.id and kind = 'coordinator';
  if new.coordinator_id is not null then
    insert into public.event_seals (event_id, kind, ref, shape, color) values (new.id, 'coordinator', new.coordinator_id::text, 'circle', '#c9a227');
  end if;
  return null;
end;
$$;
revoke all on function public.events_coordinator_seal() from public, anon, authenticated;
drop trigger if exists events_coordinator_seal on public.events;
create trigger events_coordinator_seal after update of coordinator_id on public.events
  for each row when (old.coordinator_id is distinct from new.coordinator_id)
  execute function public.events_coordinator_seal();

-- ============================================================ crear una carrera: su temática, sus comités
drop function if exists public.create_event();
create or replace function public.create_event(p_theme text default 'mitologias') returns uuid
language plpgsql security definer set search_path = public as $$
declare c text; t uuid; e uuid;
begin
  if not public.is_admin() then raise exception 'Solo el coordi puede crear carreras.'; end if;
  if not exists (select 1 from public.themes where key = p_theme and term_id is null) then
    raise exception 'Esa temática no existe.';
  end if;
  c := public.next_event_code();
  select id into t from public.terms where name = c;
  if t is null then
    insert into public.terms (name, theme) values (c, p_theme) returning id into t;
  end if;
  -- its own theme, copied from the template (the semester may already have one)
  if not exists (select 1 from public.themes where term_id = t) then
    perform public.copy_theme_for_term(t, p_theme);
  end if;
  insert into public.events (name, code, term_id) values ('Carrera ' || c, c, t) returning id into e;
  insert into public.event_committees (event_id, committee_key) select e, key from public.committees where active;
  return e;
end;
$$;
revoke all on function public.create_event(text) from public, anon;
grant execute on function public.create_event(text) to authenticated;
