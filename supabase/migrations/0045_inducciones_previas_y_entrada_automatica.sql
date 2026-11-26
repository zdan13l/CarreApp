-- CarreApp · migración 0045: las inducciones que cada persona ya llevaba y la entrada automática a cada carrera nueva.
--  * passports.prior_inductions: cuántas inducciones llevaba la persona ANTES de CarreApp (o antes de la carrera en que se registra). Un inductor
--    nuevo empieza en 0; uno veterano se registra con 3, 4 u 8 y ese número queda fijo: solo el coordi lo cambia.
--  * passport_inductions (vista, redefinida): las inducciones que lleva = prior_inductions + los semestres en que tiene un registro que NO está
--    deshabilitado (la regla de la 0044 sigue igual). Ahora hay una fila por cada persona, también para quien aún no ha entrado a ninguna carrera.
--  * career_culture(tema, carrera): la subtemática que le toca a una carrera en una temática (la misma regla que usa la pantalla: el nombre de la
--    carrera, completo o contenido, busca su grupo, y el grupo su cultura).
--  * enroll_active_inductors(carrera): mete en la carrera a todo inductor ACTIVO (no ancestro ni deshabilitado) que tenga carrera y que aún no esté,
--    como corredor y con la subtemática de su carrera en la temática de ESA carrera. Quien no tiene carrera, o cuya carrera no tiene subtemática,
--    se queda fuera y se agrega a mano. Devuelve cuántos entraron. create_event() la llama al crear la carrera.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passports add column if not exists prior_inductions int not null default 0 check (prior_inductions between 0 and 40);

-- Cuántas inducciones lleva cada persona. security_invoker: las políticas de passports y passport_records mandan (cada quien la suya, el coordi todas).
create or replace view public.passport_inductions with (security_invoker = true) as
  select p.id as passport_id,
         (p.prior_inductions + coalesce((
           select count(distinct pr.term_id) from public.passport_records pr where pr.passport_id = p.id and not pr.disabled
         ), 0))::int as inductions
    from public.passports p;
grant select on public.passport_inductions to authenticated;

-- La subtemática de una carrera en una temática; null si la temática no tiene regla para ella.
create or replace function public.career_culture(p_theme text, p_career text) returns text
language sql stable set search_path = public as $$
  with want as (select translate(lower(trim(coalesce(p_career, ''))), 'áéíóúüñ', 'aeiouun') as c),
       cand as (select gc.culture_key, translate(lower(ca.name), 'áéíóúüñ', 'aeiouun') as n
                  from public.careers ca
                  join public.group_cultures gc on gc.group_id = ca.group_id and gc.theme_key = p_theme)
  select cand.culture_key
    from cand cross join want
   where length(want.c) >= 2
     and (cand.n = want.c or position(cand.n in want.c) > 0 or position(want.c in cand.n) > 0)
   order by (cand.n = want.c) desc, length(cand.n) desc
   limit 1
$$;
revoke all on function public.career_culture(text, text) from public, anon;
grant execute on function public.career_culture(text, text) to authenticated;

-- Todo inductor activo entra a la carrera (la que ya está no se toca). Devuelve cuántos entraron.
create or replace function public.enroll_active_inductors(p_event uuid) returns int
language plpgsql security definer set search_path = public as $$
declare t uuid; th text; n int;
begin
  if not public.is_admin() then raise exception 'Solo el coordi puede agregar inductores a una carrera.'; end if;
  select term_id into t from public.events where id = p_event;
  if t is null then raise exception 'Esa carrera no tiene semestre.'; end if;
  select theme into th from public.terms where id = t;
  insert into public.passport_records (passport_id, term_id, role, career, culture)
    select p.id, t, 'runner', p.career, c.culture
      from public.passports p
      cross join lateral (select public.career_culture(th, p.career) as culture) c
     where p.status = 'active' and p.career is not null and c.culture is not null
       and not exists (select 1 from public.passport_records r where r.passport_id = p.id and r.term_id = t)
  on conflict (passport_id, term_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.enroll_active_inductors(uuid) from public, anon;
grant execute on function public.enroll_active_inductors(uuid) to authenticated;

-- Crear una carrera (como en la 0037) y meter en ella a los inductores activos.
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
  perform public.enroll_active_inductors(e);
  return e;
end;
$$;
revoke all on function public.create_event(text) from public, anon;
grant execute on function public.create_event(text) to authenticated;
