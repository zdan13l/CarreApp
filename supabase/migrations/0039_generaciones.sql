-- CarreApp · migración 0039: las generaciones, con su sello, son un catálogo GLOBAL y permanente (no cambian de una inducción a otra).
--  * public.generations: Champiñones, Peluches, Barbies, Minichips y Textiles, cada una con su sello (forma, color e imagen que se pueden editar;
--    mientras no se edite, se usa el dibujo de siempre) y el semestre en que entraron. Se pueden agregar más.
--  * passports.generation ya no es texto libre: cada parte («Barbies / Pendiente») tiene que ser una generación del catálogo; se guarda con el
--    nombre exacto. Una persona puede pertenecer a más de una (entró dos veces). Una generación con personas no se puede borrar ni renombrar.
-- Ejecutar completo en Supabase > SQL Editor.

create or replace function public.generation_plain(p text) returns text
language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(p, '')), 'áéíóúüñ', 'aeiouun'), '[^a-z]', '', 'g');
$$;

create table if not exists public.generations (
  key         text primary key check (key ~ '^[a-z]{3,20}$'),
  name        text not null unique check (length(trim(name)) between 1 and 30),
  term        text check (term is null or term ~ '^[0-9]{4}$'), -- the semester they entered (2X10 first half, 2X30 second half, 2X20 intersemestral)
  sort_order  int not null default 0,
  kind        text check (kind is null or kind in ('arch', 'ticket', 'block', 'spool')), -- the silhouette of the seal the app brings (null: none yet)
  ink         int not null default 1 check (ink between 1 and 5),
  source_file text, -- the picture the app brings for it (public/sellos/…)
  shape       text check (shape is null or shape in ('circle', 'hexagon', 'octagon', 'pentagon', 'shield', 'arch', 'roundsq', 'tablet', 'oval', 'wide', 'scallop')),
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  image_path  text,
  created_at  timestamptz not null default now(),
  check ((shape is null) = (color is null)), -- the edited seal has its shape and its colour, or none (then the app's own seal is used)
  check (key = public.generation_plain(name))
);

insert into public.generations (key, name, term, sort_order, kind, ink, source_file) values
  ('champinones', 'Champiñones', '2510', 1, 'block', 2, 'ink/gen-champinones.png'),
  ('peluches', 'Peluches', '2610', 2, 'arch', 5, 'ink/gen-peluches.png'),
  ('barbies', 'Barbies', '2630', 3, 'ticket', 4, 'ink/gen-barbies.png'),
  ('minichips', 'Minichips', '2710', 4, null, 3, null),
  ('textiles', 'Textiles', null, 5, 'spool', 1, null)
on conflict (key) do nothing;

alter table public.generations enable row level security;
drop policy if exists generations_read on public.generations;
create policy generations_read on public.generations for select to authenticated using (true);
drop policy if exists generations_admin on public.generations;
create policy generations_admin on public.generations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- the keys of a text like «Barbies / Pendiente» (split by / , +), without empty parts
create or replace function public.generation_keys(p text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(k order by ord), '{}')
  from (
    select public.generation_plain(part) as k, ord
    from unnest(regexp_split_to_array(coalesce(p, ''), '[/,+]')) with ordinality as t(part, ord)
  ) s
  where k <> '';
$$;

-- a generation keeps its key and its name for ever, and cannot disappear while somebody belongs to it
create or replace function public.generations_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (new.key is distinct from old.key or new.name is distinct from old.name) then
    raise exception 'El nombre de una generación no se cambia (las personas la guardan por su nombre).';
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.passports where old.key = any (public.generation_keys(generation))) then
      raise exception 'No puedes borrar la generación %: hay personas que pertenecen a ella.', old.name;
    end if;
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.generations_guard() from public, anon, authenticated;
drop trigger if exists generations_guard on public.generations;
create trigger generations_guard before update or delete on public.generations
  for each row execute function public.generations_guard();

-- passports.generation: only generations of the catalog, saved with their exact names (e.g. «Barbies / Minichips»)
alter table public.passports drop constraint if exists passports_generation_check;
alter table public.passports add constraint passports_generation_check check (generation is null or length(trim(generation)) between 1 and 80);

create or replace function public.passports_generation_known() returns trigger
language plpgsql security definer set search_path = public as $$
declare keys text[]; unknown int; names text;
begin
  if new.generation is null or trim(new.generation) = '' then
    new.generation := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.generation is not distinct from old.generation then return new; end if; -- what was already there is not re-checked
  keys := public.generation_keys(new.generation);
  select count(*) into unknown from unnest(keys) k where not exists (select 1 from public.generations g where g.key = k);
  if cardinality(keys) = 0 or unknown > 0 then
    raise exception 'Esa generación no existe: elige una de la lista (Administración global → Generaciones).';
  end if;
  select string_agg(g.name, ' / ' order by k.ord) into names
    from unnest(keys) with ordinality as k(key, ord) join public.generations g on g.key = k.key;
  new.generation := names;
  return new;
end;
$$;
revoke all on function public.passports_generation_known() from public, anon, authenticated;
drop trigger if exists passports_generation_known on public.passports;
create trigger passports_generation_known before insert or update of generation on public.passports
  for each row execute function public.passports_generation_known();
