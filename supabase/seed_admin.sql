-- CarreApp · crear el PRIMER administrador (coordinador).
-- Antes: en Supabase > Authentication > Users > Add user > Create new user
--   Email:    admin@carreapp.test      (el usuario "admin" entra con ese nombre en la app)
--   Password: la que quieras
--   Marca "Auto Confirm User".
-- Después ejecuta esto en SQL Editor (ajusta username y nombre si quieres):

insert into public.profiles (id, username, full_name, role)
select id, 'admin', 'Coordinador', 'admin'
from auth.users
where email = 'admin@carreapp.test'
on conflict (id) do update set role = 'admin';

-- Carrera inicial (opcional, se podrá crear desde el panel en el Bloque 2):
insert into public.events (name, is_active) values ('Carrera 2027-1', true);
