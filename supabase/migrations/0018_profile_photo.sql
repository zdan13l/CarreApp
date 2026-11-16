-- CarreApp · Foto de cada usuario.
--  * profiles.photo_path: la foto de la persona (carpeta users/ del bucket photos). El coordinador la sube desde
--    Usuarios; se ve en lugar de la inicial en la cabecera de la persona y en la lista de usuarios.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.profiles add column photo_path text;
