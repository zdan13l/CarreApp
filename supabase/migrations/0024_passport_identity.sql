-- CarreApp · La identidad del pasaporte personal.
--  * Comité: cada inductor pertenece a uno de los comités de la inducción (passport_records.committee, por semestre) y cada comité
--    tiene UN coordinador (committee_lead), que recibe el sello dorado. Solo el coordinador de la app los asigna.
--  * Generación y fecha de ingreso a la inducción (passports.generation, passports.joined_term): los pone el coordinador.
--  * Apodo y símbolo (passports.nickname, symbol, symbol_label): los pone cada persona en su pasaporte.
--  * Cada persona puede actualizar SU fila de passports, pero un disparador solo le deja tocar el apodo y el símbolo: el nombre,
--    la foto, el @, la generación y el ingreso siguen siendo del coordinador (el servidor, con la llave de servicio, cambia el @
--    cuando la persona lo pide con su contraseña).
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passports
  add column nickname     text check (nickname is null or length(trim(nickname)) between 1 and 24),
  add column symbol       text check (symbol is null or symbol ~ '^[a-z0-9-]{2,24}$'),
  add column symbol_label text check (symbol_label is null or length(trim(symbol_label)) between 1 and 24),
  add column generation   text check (generation is null or length(trim(generation)) between 1 and 30),
  add column joined_term  text check (joined_term is null or length(trim(joined_term)) between 1 and 20);

alter table public.passport_records
  add column committee      text check (committee is null or committee ~ '^[a-z]{3,20}$'),
  add column committee_lead boolean not null default false,
  add check (not committee_lead or committee is not null);

-- Un comité tiene un solo coordinador por semestre.
create unique index passport_records_committee_lead on public.passport_records (term_id, committee) where committee_lead;

-- Cada persona actualiza su propia fila; el disparador decide qué.
create policy passports_self_update on public.passports for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.passports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- the service role (the server, auth.uid() is null) and the coordinator may change anything
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.username is distinct from old.username
       or new.full_name is distinct from old.full_name
       or new.photo_path is distinct from old.photo_path
       or new.generation is distinct from old.generation
       or new.joined_term is distinct from old.joined_term then
      raise exception 'Eso solo lo puede cambiar el coordinador.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.passports_guard() from public, anon, authenticated;
create trigger passports_guard before update on public.passports
  for each row execute function public.passports_guard();
