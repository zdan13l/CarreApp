-- CarreApp · Bloque 4: no existen empates por ítem (siempre hay un ganador).
-- NOT VALID: se aplica a puntajes nuevos o editados, sin fallar por filas de prueba antiguas.
-- Ejecutar completo en Supabase > SQL Editor.
alter table public.match_scores
  add constraint match_scores_winner_required check (winner_team_id is not null) not valid;
