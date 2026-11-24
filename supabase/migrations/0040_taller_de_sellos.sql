-- CarreApp · migración 0040: el taller de sellos (los sellos se crean en UN solo lugar) y reglas para que cada sello pertenezca de verdad a su sección.
--  * Un sello de temática, subtemática, grupo, base, comité o coordi está LIGADO a una inducción (carrera) y solo puede ponerse a un elemento de
--    ESA carrera: la temática de esa carrera, una subtemática de su temática, un grupo o una base suyos, un comité que participa en ella o su coordi.
--    (event_seals_valid_ref). Lo que ya estaba guardado no se revisa; lo nuevo sí.
--  * Si un grupo, una base o un comité deja de pertenecer a la carrera, su sello se va con él (no quedan sellos huérfanos).
--  * Los sellos de las generaciones son globales (tabla generations, 0039): no llevan inducción.
-- Ejecutar completo en Supabase > SQL Editor.

create or replace function public.event_seals_valid_ref() returns trigger
language plpgsql security definer set search_path = public as $$
declare term uuid; ok boolean := false; what text;
begin
  select term_id into term from public.events where id = new.event_id;
  if new.kind = 'theme' then
    what := 'la temática de esa carrera'; ok := term is not null and exists (select 1 from public.themes t where t.key = new.ref and t.term_id = term);
  elsif new.kind = 'subtheme' then
    what := 'una subtemática de la temática de esa carrera'; ok := term is not null and exists (select 1 from public.theme_cultures c join public.themes t on t.key = c.theme_key where c.key = new.ref and t.term_id = term);
  elsif new.kind = 'team' then
    what := 'un grupo de esa carrera'; ok := exists (select 1 from public.teams t where t.id::text = new.ref and t.event_id = new.event_id);
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
drop trigger if exists event_seals_a_valid_ref on public.event_seals; -- named so it fires BEFORE event_seals_unique_design (alphabetical order)
create trigger event_seals_a_valid_ref before insert or update of event_id, kind, ref on public.event_seals
  for each row execute function public.event_seals_valid_ref();

-- the seal goes with its element
create or replace function public.event_seals_drop_with_element() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'teams' then
    delete from public.event_seals where event_id = old.event_id and kind = 'team' and ref = old.id::text;
  elsif tg_table_name = 'bases' then
    delete from public.event_seals where event_id = old.event_id and kind = 'base' and ref = old.id::text;
  elsif tg_table_name = 'event_committees' then
    delete from public.event_seals where event_id = old.event_id and kind = 'committee' and ref = old.committee_key;
  end if;
  return old;
end;
$$;
revoke all on function public.event_seals_drop_with_element() from public, anon, authenticated;
drop trigger if exists teams_drop_seal on public.teams;
create trigger teams_drop_seal after delete on public.teams for each row execute function public.event_seals_drop_with_element();
drop trigger if exists bases_drop_seal on public.bases;
create trigger bases_drop_seal after delete on public.bases for each row execute function public.event_seals_drop_with_element();
drop trigger if exists event_committees_drop_seal on public.event_committees;
create trigger event_committees_drop_seal after delete on public.event_committees for each row execute function public.event_seals_drop_with_element();

-- the seals that were left without their element before this migration
delete from public.event_seals s where s.kind = 'team' and not exists (select 1 from public.teams t where t.id::text = s.ref and t.event_id = s.event_id);
delete from public.event_seals s where s.kind = 'base' and not exists (select 1 from public.bases b where b.id::text = s.ref and b.event_id = s.event_id);
delete from public.event_seals s where s.kind = 'committee' and not exists (select 1 from public.event_committees c where c.event_id = s.event_id and c.committee_key = s.ref);
