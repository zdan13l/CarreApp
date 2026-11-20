-- CarreApp · migración 0027: una persona puede estar en más de un comité.
-- Hasta ahora cada registro tenía UN comité (passport_records.committee, con committee_lead si lo coordina). Pero hay quien coordina
-- dos comités (Caos y Meraki) o es miembro de uno y además del de Bienvenida. Se guarda el comité principal como hasta ahora y se
-- añaden los demás en dos listas: los comités extra y, dentro de ellos, los que coordina (sello dorado).
-- Ejecutar completo en Supabase > SQL Editor.

alter table public.passport_records
  add column extra_committees text[] not null default '{}',
  add column extra_leads      text[] not null default '{}',
  add check (array_to_string(extra_committees, ',') ~ '^([a-z]{3,20}(,[a-z]{3,20})*)?$'),
  add check (extra_leads <@ extra_committees);
