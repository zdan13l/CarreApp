-- CarreApp · Las páginas del pasaporte: palabras de los coordinadores y de cada comité, foto de la base y apodo/símbolo solo del coordinador.
--  * terms.welcome: las palabras de los coordinadores a sus inductores en ESA inducción (salen en la página de la inducción).
--  * term_committees: las palabras de cada comité (por inducción) a quienes les tocó en él.
--  * my_passport_context() también devuelve la foto de la base (el sello dorado de quien atiende una base).
--  * El apodo, el símbolo y su nombre se ponen una sola vez y no se vuelven a cambiar: dejan de ser de cada persona (se quita la política
--    de 0024) y solo el coordinador los pone o corrige.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.terms add column welcome text check (welcome is null or length(trim(welcome)) between 1 and 700);

create table public.term_committees (
  term_id   uuid not null references public.terms (id) on delete cascade,
  committee text not null check (committee ~ '^[a-z]{3,20}$'),
  message   text not null check (length(trim(message)) between 1 and 700),
  primary key (term_id, committee)
);
alter table public.term_committees enable row level security;
create policy term_committees_read on public.term_committees for select to authenticated using (true);
create policy term_committees_admin on public.term_committees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Nadie edita su propia fila: todo lo del pasaporte lo pone el coordinador (la contraseña y el @ los cambia el servidor).
drop policy passports_self_update on public.passports;
create or replace function public.passports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Eso solo lo puede cambiar el coordinador.';
  end if;
  return new;
end;
$$;
revoke all on function public.passports_guard() from public, anon, authenticated;

drop function public.my_passport_context();
create function public.my_passport_context()
returns table (record_id uuid, team_id uuid, team_name text, team_photo_path text, partners text[],
               base_id uuid, base_name text, base_photo_path text, event_id uuid, event_name text, event_active boolean)
language sql stable security definer set search_path = public as $$
  select r.id, t.id, t.name, t.photo_path,
         coalesce((select array_agg(p.full_name order by p.full_name)
                     from public.passport_records o join public.passports p on p.id = o.passport_id
                    where r.team_id is not null and o.team_id = r.team_id and o.id <> r.id), '{}'),
         b.id, b.name, b.location_photo_path, e.id, e.name, coalesce(e.is_active, false)
    from public.passport_records r
    left join public.teams t on t.id = r.team_id
    left join public.bases b on b.id = r.base_id
    left join public.events e on e.id = coalesce(
           t.event_id, b.event_id,
           (select x.id from public.events x where x.term_id = r.term_id order by x.is_active desc, x.created_at desc limit 1))
   where r.passport_id = auth.uid()
$$;
revoke all on function public.my_passport_context() from public, anon;
grant execute on function public.my_passport_context() to authenticated;
