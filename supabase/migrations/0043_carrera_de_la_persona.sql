-- CarreApp · migración 0043: la carrera universitaria de cada persona (Sistemas, Civil…) y el ingreso que sale solo de la generación.
--  * passports.career: la carrera de la persona, una sola para toda su vida en la inducción. Se pone al registrarla (Administración global →
--    Inductores) y es la que se usa cuando entra a una carrera (passport_records.career, que sigue guardando la de cada semestre).
--    Las personas que ya existían la reciben de su participación más reciente.
--  * passports.joined_term se llena solo: es el semestre de la generación a la que pertenece (Barbies → 2630). Con dos generaciones, el de la primera.
--    Una generación sin semestre (Textiles) deja el ingreso como estaba.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passports add column if not exists career text check (career is null or length(trim(career)) between 2 and 80);

update public.passports p
   set career = r.career
  from (
    select distinct on (pr.passport_id) pr.passport_id, pr.career
      from public.passport_records pr
      join public.terms t on t.id = pr.term_id
     order by pr.passport_id, t.created_at desc, pr.career
  ) r
 where r.passport_id = p.id and p.career is null;

create or replace function public.passports_joined_from_generation() returns trigger
language plpgsql security definer set search_path = public as $$
declare entry text;
begin
  if new.generation is null then return new; end if;
  if tg_op = 'UPDATE' and new.generation is not distinct from old.generation then return new; end if;
  select g.term into entry
    from unnest(public.generation_keys(new.generation)) with ordinality as k(key, ord)
    join public.generations g on g.key = k.key
   order by k.ord
   limit 1;
  if entry is not null then new.joined_term := entry; end if;
  return new;
end;
$$;
revoke all on function public.passports_joined_from_generation() from public, anon, authenticated;
drop trigger if exists passports_joined_from_generation on public.passports;
create trigger passports_joined_from_generation before insert or update of generation on public.passports
  for each row execute function public.passports_joined_from_generation();
