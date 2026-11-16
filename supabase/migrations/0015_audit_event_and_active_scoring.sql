-- CarreApp · Registro de cambios por Carrera y calificación solo en la Carrera activa.
--  * score_audit.event_id: cada cambio queda atribuido a su Carrera (se llena solo, también al borrar un cruce).
--  * is_staff_of_match(): un inductor solo actúa sobre cruces de la Carrera ACTIVA. El coordinador no cambia:
--    puede corregir cualquier Carrera.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.score_audit add column event_id uuid references public.events (id) on delete cascade;
create index score_audit_event_idx on public.score_audit (event_id, changed_at desc);

-- Rows written before this migration: the Carrera of their match (rows of deleted matches stay without one).
update public.score_audit a set event_id = m.event_id
from public.matches m where m.id = a.match_id and a.event_id is null;

create function public.audit_set_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.event_id is null then
    select event_id into new.event_id from public.matches where id = new.match_id;
  end if;
  return new;
end;
$$;
create trigger score_audit_event before insert on public.score_audit
  for each row execute function public.audit_set_event();
revoke all on function public.audit_set_event() from public, anon, authenticated;

create or replace function public.is_staff_of_match(p_match uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches m
    join public.base_staff bs on bs.base_id = m.base_id
    join public.events e on e.id = m.event_id
    where m.id = p_match and bs.user_id = auth.uid() and e.is_active
  );
$$;
