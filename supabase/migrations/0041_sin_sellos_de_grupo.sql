-- CarreApp · migración 0041: los grupos no tienen sello; los representa su insignia.
--  * Se borran los sellos de tipo 'team' de event_seals y el tipo deja de existir (el check de kind y la regla event_seals_valid_ref).
--  * Ya no hace falta borrar el sello de un grupo cuando se elimina el grupo (teams_drop_seal).
-- Ejecutar completo en Supabase > SQL Editor.

delete from public.event_seals where kind = 'team';
alter table public.event_seals drop constraint if exists event_seals_kind_check;
alter table public.event_seals add constraint event_seals_kind_check check (kind in ('theme', 'subtheme', 'committee', 'coordinator', 'base'));

drop trigger if exists teams_drop_seal on public.teams;

create or replace function public.event_seals_valid_ref() returns trigger
language plpgsql security definer set search_path = public as $$
declare term uuid; ok boolean := false; what text;
begin
  select term_id into term from public.events where id = new.event_id;
  if new.kind = 'theme' then
    what := 'la temática de esa carrera'; ok := term is not null and exists (select 1 from public.themes t where t.key = new.ref and t.term_id = term);
  elsif new.kind = 'subtheme' then
    what := 'una subtemática de la temática de esa carrera'; ok := term is not null and exists (select 1 from public.theme_cultures c join public.themes t on t.key = c.theme_key where c.key = new.ref and t.term_id = term);
  elsif new.kind = 'base' then
    what := 'una base de esa carrera'; ok := exists (select 1 from public.bases b where b.id::text = new.ref and b.event_id = new.event_id);
  elsif new.kind = 'committee' then
    what := 'un comité que participa en esa carrera'; ok := exists (select 1 from public.event_committees c where c.event_id = new.event_id and c.committee_key = new.ref);
  elsif new.kind = 'coordinator' then
    what := 'el coordi de esa carrera'; ok := exists (select 1 from public.events e where e.id = new.event_id and e.coordinator_id::text = new.ref);
  end if;
  if not ok then
    raise exception 'Ese sello no corresponde a esa carrera: solo puede ser de %.', what;
  end if;
  return new;
end;
$$;
revoke all on function public.event_seals_valid_ref() from public, anon, authenticated;

create or replace function public.event_seals_drop_with_element() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'bases' then
    delete from public.event_seals where event_id = old.event_id and kind = 'base' and ref = old.id::text;
  elsif tg_table_name = 'event_committees' then
    delete from public.event_seals where event_id = old.event_id and kind = 'committee' and ref = old.committee_key;
  end if;
  return old;
end;
$$;
revoke all on function public.event_seals_drop_with_element() from public, anon, authenticated;
