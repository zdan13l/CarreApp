-- CarreApp · migración 0047: el cumpleaños de cada persona (de él salen el código y la edad del pasaporte).
--  * passports.birth_date: la fecha de nacimiento (opcional). El código del pasaporte es PUJ-DDMMAAAA con esa fecha y la edad se calcula al
--    mostrarla; sin fecha, el pasaporte conserva el número de antes. Solo el coordi la escribe (nadie edita su propio pasaporte, como en la 0025).
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passports add column if not exists birth_date date check (birth_date is null or birth_date between date '1900-01-01' and date '2100-12-31');
