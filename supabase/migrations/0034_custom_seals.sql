-- CarreApp · migración 0034: sellos propios y límite de bases según los sellos.
-- La app trae 15 sellos de bases (cinco mitologías, tres cada una) y cada base necesita uno distinto. El coordinador puede subir más sellos
-- (public.custom_seals: nombre, mitología, color y la imagen ya convertida a tinta, en el bucket "photos", carpeta seals/).
-- Una carrera no puede tener más bases que sellos (15 + los que se hayan subido): crear una base de más da un error que lo explica.
-- Ejecutar completo en Supabase > SQL Editor.

create table if not exists public.custom_seals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 40),
  culture    text not null default 'otra' check (culture in ('egipcia', 'nordica', 'griega', 'mexicana', 'china', 'otra')),
  color      text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  path       text not null check (length(path) between 1 and 200),
  story      text check (story is null or length(story) <= 400),
  created_at timestamptz not null default now()
);

alter table public.custom_seals enable row level security;
drop policy if exists custom_seals_read on public.custom_seals;
create policy custom_seals_read on public.custom_seals for select to authenticated using (true);
drop policy if exists custom_seals_admin on public.custom_seals;
create policy custom_seals_admin on public.custom_seals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- how many bases one Carrera can have: the 15 seals of the app plus the ones uploaded
create or replace function public.seal_capacity() returns int
language sql stable security definer set search_path = public as $$
  select 15 + (select count(*)::int from public.custom_seals);
$$;
revoke all on function public.seal_capacity() from public, anon;
grant execute on function public.seal_capacity() to authenticated;

create or replace function public.bases_seal_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int := public.seal_capacity();
begin
  if (select count(*) from public.bases where event_id = new.event_id) >= cap then
    raise exception 'Hay % sellos y esta carrera ya tiene % bases: primero hay que corregir los sellos (súbelos en la pestaña Sellos) antes de crear otra base.', cap, cap;
  end if;
  return new;
end;
$$;
revoke all on function public.bases_seal_limit() from public, anon, authenticated;
drop trigger if exists bases_seal_limit on public.bases;
create trigger bases_seal_limit before insert on public.bases
  for each row execute function public.bases_seal_limit();

-- a seal that a base needs cannot be deleted
create or replace function public.custom_seals_keep() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from (select count(*) n from public.bases group by event_id) x where x.n > public.seal_capacity() - 1) then
    raise exception 'No puedes borrar este sello: hay una carrera con tantas bases como sellos.';
  end if;
  return old;
end;
$$;
revoke all on function public.custom_seals_keep() from public, anon, authenticated;
drop trigger if exists custom_seals_keep on public.custom_seals;
create trigger custom_seals_keep before delete on public.custom_seals
  for each row execute function public.custom_seals_keep();
