-- CarreApp · migración 0044: cuántas inducciones lleva cada persona, el perfil deshabilitado en una inducción y el doble programa.
--  * passport_records.disabled: la persona está deshabilitada en ESA inducción (no puede estar presente). Esa inducción no cuenta como suya y
--    queda sin grupo ni base (el disparador los suelta). Solo el coordi lo cambia, dentro de la carrera.
--  * passport_inductions (vista): cuántas inducciones lleva cada persona = en cuántos semestres tiene un registro que NO está deshabilitado.
--    Sube sola cuando la persona entra a una inducción nueva; no se escribe a mano. Cada quien ve la suya y el coordi la de todos.
--  * passports.second_career: la otra carrera de quien hace doble programa (una sola, como la primera: passports.career).
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passport_records add column if not exists disabled boolean not null default false;
alter table public.passports add column if not exists second_career text check (second_career is null or length(trim(second_career)) between 2 and 80);

-- Un perfil deshabilitado en la inducción no corre en ningún grupo ni atiende ninguna base. Se llama «..._clear» para que corra antes que
-- passport_records_validate (los disparadores corren por orden alfabético) y esa validación ya vea el grupo suelto.
create or replace function public.passport_records_clear_when_disabled() returns trigger
language plpgsql as $$
begin
  if new.disabled then
    new.team_id := null;
    new.base_id := null;
  end if;
  return new;
end;
$$;
drop trigger if exists passport_records_clear on public.passport_records;
create trigger passport_records_clear before insert or update on public.passport_records
  for each row execute function public.passport_records_clear_when_disabled();

-- Cuántas inducciones lleva cada persona. security_invoker: las políticas de passport_records mandan (cada quien la suya, el coordi todas).
create or replace view public.passport_inductions with (security_invoker = true) as
  select pr.passport_id, count(distinct pr.term_id)::int as inductions
    from public.passport_records pr
   where not pr.disabled
   group by pr.passport_id;
grant select on public.passport_inductions to authenticated;
