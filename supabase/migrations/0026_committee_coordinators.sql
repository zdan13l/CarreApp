-- CarreApp · migración 0026: un comité puede tener más de un coordinador.
-- Antes (0024) solo uno por comité y semestre recibía el sello dorado; el comité de Caos tiene dos coordinadores y ambos lo reciben.
-- Ejecutar completo en Supabase > SQL Editor.

drop index if exists public.passport_records_committee_lead;
