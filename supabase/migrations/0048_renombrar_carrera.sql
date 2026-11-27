-- CarreApp · migración 0048: cambiar el nombre de una carrera sin perder a nadie.
--  * rename_career(carrera, nombre nuevo) (solo el coordi): cambia el nombre en el catálogo (careers) y, en el mismo paso, en todos los lugares
--    donde una persona lo guarda como texto: su carrera (passports.career), su otra carrera (passports.second_career) y la carrera de cada
--    inducción en que participó (passport_records.career). Así nadie queda con una carrera que ya no existe.
-- Ejecutar completo en Supabase > SQL Editor.

create or replace function public.rename_career(p_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare old_name text; new_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if not public.is_admin() then raise exception 'Solo el coordi puede cambiar una carrera.'; end if;
  select name into old_name from public.careers where id = p_id;
  if old_name is null then raise exception 'Esa carrera no existe.'; end if;
  if length(new_name) not between 2 and 60 then raise exception 'El nombre de la carrera debe tener de 2 a 60 letras.'; end if;
  if new_name = old_name then return; end if;
  update public.careers set name = new_name where id = p_id;  -- unique(name): otro nombre igual lo rechaza
  update public.passports set career = new_name where career = old_name;
  update public.passports set second_career = new_name where second_career = old_name;
  update public.passport_records set career = new_name where career = old_name;
end;
$$;
revoke all on function public.rename_career(uuid, text) from public, anon;
grant execute on function public.rename_career(uuid, text) to authenticated;
