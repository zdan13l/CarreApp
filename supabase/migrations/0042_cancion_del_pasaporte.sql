-- CarreApp · migración 0042: la canción de cada persona en su pasaporte (un fragmento de 30 segundos).
--  * passports.song (jsonb): la canción que caracteriza a la persona, tal como la devuelve el buscador de Apple Music / iTunes:
--    {id, title, artist, preview (el audio de 30 s), cover (la carátula), url (la canción completa)}.
--  * Solo se aceptan esos datos y solo de Apple (el audio, la carátula y el enlace tienen que ser de apple.com o mzstatic.com): la canción la
--    elige el coordi (nadie edita su propia fila, 0025) y el pasaporte no puede apuntar a cualquier dirección.
--  * Se reemplaza el símbolo personal: sus columnas (symbol, symbol_label) no se borran para no perder datos, pero la app ya no las usa.
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passports add column if not exists song jsonb;

create or replace function public.passports_song_valid() returns trigger
language plpgsql set search_path = public as $$
declare s jsonb := new.song;
begin
  if s is null then return new; end if;
  if jsonb_typeof(s) <> 'object' then
    raise exception 'La canción tiene que ser un objeto con título, artista y audio.';
  end if;
  if exists (select 1 from jsonb_object_keys(s) k where k not in ('id', 'title', 'artist', 'preview', 'cover', 'url')) then
    raise exception 'La canción solo puede tener id, título, artista, audio, carátula y enlace.';
  end if;
  if coalesce(length(trim(s->>'title')), 0) not between 1 and 150 then
    raise exception 'La canción necesita un título (máximo 150 letras).';
  end if;
  if coalesce(length(trim(s->>'artist')), 0) not between 1 and 150 then
    raise exception 'La canción necesita un artista (máximo 150 letras).';
  end if;
  if coalesce(s->>'preview', '') !~ '^https://[a-z0-9.-]+\.(apple\.com|mzstatic\.com)/[^[:space:]]+$' then
    raise exception 'El audio de la canción tiene que venir de Apple Music (https).';
  end if;
  if s ? 'cover' and s->>'cover' !~ '^https://[a-z0-9.-]+\.(apple\.com|mzstatic\.com)/[^[:space:]]+$' then
    raise exception 'La carátula de la canción tiene que venir de Apple Music (https).';
  end if;
  if s ? 'url' and s->>'url' !~ '^https://[a-z0-9.-]+\.apple\.com/[^[:space:]]+$' then
    raise exception 'El enlace de la canción tiene que ser de Apple Music (https).';
  end if;
  return new;
end;
$$;
revoke all on function public.passports_song_valid() from public, anon, authenticated;
drop trigger if exists passports_song_valid on public.passports;
create trigger passports_song_valid before insert or update of song on public.passports
  for each row execute function public.passports_song_valid();
