-- CarreApp · migración 0049: la temática es única por carrera.
--  * Una carrera tiene UNA sola temática propia (themes.term_id es único): la copia de la plantilla que se eligió al crearla.
--  * Una plantilla de temática se usa UNA sola vez: cuando una carrera ya la tomó, no se puede elegir para otra carrera nueva (hay que agregar una
--    temática nueva en Carreras y temáticas). La carrera de prueba, que es permanente y sirve para probar, no gasta ninguna.
--  * theme_template_user(plantilla) dice qué carrera ya la usa (null = libre) y create_event() la consulta antes de crear nada.
-- Ejecutar completo en Supabase > SQL Editor.

create unique index if not exists themes_one_per_term on public.themes (term_id) where term_id is not null;

create or replace function public.theme_template_user(p_template text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(e.name, t.name)
    from public.themes c
    join public.terms t on t.id = c.term_id
    left join public.events e on e.term_id = c.term_id
   where c.template_of = p_template and not coalesce(e.is_test, false)
   order by coalesce(e.created_at, t.created_at)
   limit 1;
$$;
revoke all on function public.theme_template_user(text) from public, anon;
grant execute on function public.theme_template_user(text) to authenticated;

-- Crear una carrera (como en la 0045): ahora la temática elegida debe estar libre.
create or replace function public.create_event(p_theme text default 'mitologias') returns uuid
language plpgsql security definer set search_path = public as $$
declare c text; t uuid; e uuid; used text; tname text;
begin
  if not public.is_admin() then raise exception 'Solo el coordi puede crear carreras.'; end if;
  select name into tname from public.themes where key = p_theme and term_id is null;
  if tname is null then
    raise exception 'Esa temática no existe.';
  end if;
  used := public.theme_template_user(p_theme);
  if used is not null then
    raise exception 'La temática % ya la usa la %: cada carrera tiene una temática propia. Agrega una temática nueva en Carreras y temáticas.', tname, used;
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
  perform public.enroll_active_inductors(e);
  return e;
end;
$$;
revoke all on function public.create_event(text) from public, anon;
grant execute on function public.create_event(text) to authenticated;
