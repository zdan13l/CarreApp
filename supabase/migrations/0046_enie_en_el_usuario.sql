-- CarreApp · migración 0046: la ñ en el usuario (@).
--  * profiles.username y passports.username aceptan la ñ (muñoz, niño): de 3 a 30 caracteres entre a-z, ñ, 0-9, punto, guion y guion bajo.
--  * El correo interno de acceso (usuario@carreapp.test) sigue siendo ASCII: la ñ viaja en él como «+», que ningún usuario puede llevar.
--    Eso lo hacen la app y el servidor (api/users.ts, api/account.ts); la base de datos solo guarda el usuario tal como se escribe.
-- Ejecutar completo en Supabase > SQL Editor.

do $$
declare c record;
begin
  for c in
    select con.conname, rel.relname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname in ('profiles', 'passports') and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%username%'
  loop
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
  end loop;
end $$;

alter table public.profiles  add constraint profiles_username_check  check (username ~ '^[a-zñ0-9._-]{3,30}$');
alter table public.passports add constraint passports_username_check check (username ~ '^[a-zñ0-9._-]{3,30}$');
