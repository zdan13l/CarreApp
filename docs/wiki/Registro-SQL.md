# Registro SQL

Historial de **todos los scripts SQL aplicados** en el proyecto de Supabase. Cada cambio de base de datos se agrega aquí **en orden**, con fecha, motivo y cómo revertirlo.

**Regla de oro:** nunca se edita un script ya aplicado. Si hay que cambiar algo, se crea un script nuevo (`0002_…`, `0003_…`) en `supabase/migrations/` y se agrega una fila a esta tabla.

## Cómo aplicar un script
1. Supabase > **SQL Editor** > New query.
2. Pegar el contenido del archivo completo y pulsar **Run**.
3. Verificar que diga *Success* y registrar aquí la fecha.

## Historial

| # | Archivo | Aplicado | Resumen |
|---|---|---|---|
| 0001 | [`0001_initial_schema.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0001_initial_schema.sql) | 2026-11-15 | Esquema inicial: tipos, 10 tablas, vista de ranking, funciones, triggers, RLS y tiempo real |
| 0002 | [`0002_storage_and_event_validation.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0002_storage_and_event_validation.sql) | 2026-11-15 | Bucket de fotos, políticas de Storage y validación para activar la Carrera |
| 0003 | [`0003_staff_rules.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0003_staff_rules.sql) | 2026-11-15 | Un inductor por base y un corredor por grupo; mínimo 2 corredores por grupo para activar |
| 0004 | [`0004_no_ties.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0004_no_ties.sql) | 2026-11-15 | El puntaje siempre exige un ganador (sin empates por ítem) |
| 0005 | [`0005_scoring_order.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0005_scoring_order.sql) | 2026-11-15 | Una base califica sus rondas en orden |
| 0006 | [`0006_void_items.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0006_void_items.sql) | 2026-11-15 | Ítems invalidados por el coordinador |
| 0007 | [`0007_arrival_and_base_photo.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0007_arrival_and_base_photo.sql) | 2026-11-15 | Llegada de los grupos y foto de la base editable por sus inductores |
| 0008 | [`0008_private_base_info.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0008_private_base_info.sql) | _pendiente_ | Información y preguntas de la base privadas; bases en tiempo real |
| 0009 | [`0009_map_and_gps.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0009_map_and_gps.sql) | 2026-11-15 | Ubicación de las bases y última ubicación de cada grupo (GPS) |
| 0010 | [`0010_delay_alerts.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0010_delay_alerts.sql) | _pendiente_ | Tiempo máximo de traslado, hora de término de cada cruce y avisos manuales |
| 0011 | [`0011_push_and_travel_times.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0011_push_and_travel_times.sql) | _pendiente_ | Tiempo de traslado por tramo, suscripciones push y revisión de demoras en el servidor |
| 0012 | [`0012_runner_only_push.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0012_runner_only_push.sql) | _pendiente_ | Las notificaciones push son solo para corredores; la base también puede mandar avisos |
| 0013 | [`0013_no_delay_same_base.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0013_no_delay_same_base.sql) | 2026-11-15 | Un grupo que juega de nuevo en la misma base no cuenta como "en demora" |
| 0014 | [`0014_users_per_event.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0014_users_per_event.sql) | 2026-11-15 | Cada corredor/inductor pertenece a una Carrera; `events` entra a Realtime |
| 0015 | [`0015_audit_event_and_active_scoring.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0015_audit_event_and_active_scoring.sql) | 2026-11-15 | El registro de cambios guarda su Carrera; los inductores solo actúan en la Carrera activa |
| 0016 | [`0016_no_delay_when_resting.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0016_no_delay_when_resting.sql) | 2026-11-15 | Un grupo que descansa una ronda no recibe alerta de demora |
| 0017 | [`0017_hardening.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0017_hardening.sql) | 2026-11-15 | Hora del servidor, avisos con alcance y límite, auditoría sin ruido |
| 0018 | [`0018_profile_photo.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0018_profile_photo.sql) | 2026-11-17 | Foto de cada usuario (`profiles.photo_path`) |
| 0019 | [`0019_clean_delete_privacy_and_base_alerts.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0019_clean_delete_privacy_and_base_alerts.sql) | 2026-11-17 | Borrado limpio, solo se elimina una Carrera desactivada, privacidad entre Carreras y de los puntajes, un usuario por grupo basta, avisos a la base |
| 0020 | [`0020_reset_on_deactivate.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0020_reset_on_deactivate.sql) | 2026-11-18 | Desactivar una Carrera reinicia todo su avance |
| 0021 | [`0021_team_contacts.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0021_team_contacts.sql) | 2026-11-19 | `team_contacts()`: el @ de los corredores de cada grupo de la propia Carrera |
| 0022 | [`0022_score_needs_arrival.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0022_score_needs_arrival.sql) | 2026-11-19 | Una base solo puede calificar si ya confirmó la llegada de los dos grupos |
| 0023 | [`0023_passports.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0023_passports.sql) | 2026-11-19 | Pasaporte personal del inductor: semestres con temática, un registro por persona y semestre, sellos guardados para siempre |
| 0024 | [`0024_passport_identity.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0024_passport_identity.sql) | 2026-11-19 | Identidad del pasaporte: comité (y su coordinador), generación, ingreso, apodo y símbolo |
| 0025 | [`0025_passport_pages.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0025_passport_pages.sql) | 2026-11-20 | Palabras de los coordinadores y de cada comité por inducción, foto de la base en el pasaporte, apodo y símbolo solo del coordinador |
| 0026 | [`0026_committee_coordinators.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0026_committee_coordinators.sql) | 2026-11-20 | Un comité puede tener más de un coordinador (Caos tiene dos) |
| 0027 | [`0027_more_committees.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0027_more_committees.sql) | 2026-11-21 | Una persona puede estar en más de un comité (los comités extra y cuáles coordina) |
| 0028 | [`0028_event_archives.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0028_event_archives.sql) | 2026-11-22 | Historial de puntajes: al desactivar una Carrera se guarda su tabla final y cada punto antes del reinicio |
| 0029 | [`0029_round_rotations.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0029_round_rotations.sql) | 2026-11-22 | Rotación de las bases: el coordinador avisa «ya pueden rotar» por ronda y cada base confirma que dejó ir a sus grupos |
| 0030 | [`0030_question_answers.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0030_question_answers.sql) | 2026-11-22 | Cada base tiene mínimo 5 preguntas, cada una con su respuesta (hasta 10) |
| 0031 | [`0031_targeted_alerts.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0031_targeted_alerts.sql) | 2026-11-22 | El aviso «apúrense» puede ir a un solo grupo del cruce (`alerts.team_id`) |
| 0032 | [`0032_event_phases.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0032_event_phases.sql) | 2026-11-22 | Los cuatro estados de la Carrera (`events.phase`), `event_action()`, las bases solo actúan con la Carrera Iniciada y el reloj de demora cuenta desde el aviso de rotación |
| 0033 | [`0033_alert_rate_and_title.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0033_alert_rate_and_title.sql) | 2026-11-22 | Límite de 15 s entre avisos de una base y la notificación dice «Aviso del coordi» |
| 0034 | [`0034_custom_seals.sql`](https://github.com/zdan13/CarreApp/blob/main/supabase/migrations/0034_custom_seals.sql) | 2026-11-22 | Sellos propios (`custom_seals`) y una carrera no puede tener más bases que sellos |
| 0035 | [`0035_inductor_admin.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0035_inductor_admin.sql) | 2026-11-22 | Ancestros, comités, grupos de carreras y temáticas manejados desde el panel |
| 0036 | [`0036_carreras_ciclo.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/migrations/0036_carreras_ciclo.sql) | 2026-11-22 | Código de carrera (2710, 2730, 2810…), carrera de prueba permanente, estado Finalizada, sin eliminar carreras e insignias globales |
| 0037 | [`0037_carrera_propia.sql`](https://github.com/zdan13/CarreApp/blob/main/supabase/migrations/0037_carrera_propia.sql) | _pendiente_ | Temática y subtemáticas propias de cada carrera, comités y coordi por carrera y sellos propios con reglas de unicidad |
| — | [`push_setup.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/push_setup.sql) | _pendiente_ | Guarda la clave del envío y programa la revisión cada 10 s (se corre una vez, con tu clave) |
| — | [`seed_admin.sql`](https://github.com/zdan13l/CarreApp/blob/main/supabase/seed_admin.sql) | 2026-11-15 | Crea el primer administrador y la Carrera inicial (no es una migración; se corre una vez) |

---

## 0001 — Esquema inicial (2026-11-15)

**Qué crea**

- **Tipos:** `user_role` (admin, base, runner), `score_item` (barra, pregunta, minijuego), `match_status` (pending, in_progress, finished).
- **Tablas:** `events`, `profiles`, `teams`, `bases`, `base_questions`, `base_staff`, `team_runners`, `matches`, `match_scores`, `score_audit`.
- **Vista:** `team_standings` (ranking, con `security_invoker`).
- **Funciones de permisos:** `is_admin()`, `is_staff_of_match(match)`.
- **Triggers:**
  - `matches_validate` → `validate_match()`: coherencia de Carrera y un grupo por base por ronda.
  - `scores_validate` → `validate_score()`: ganador del cruce y quién puntuó.
  - `scores_after` → `after_score_change()`: auditoría y estado del cruce.
- **RLS:** activado en todas las tablas (20 políticas). Lectura para usuarios autenticados, escritura solo admin, salvo que la base puede **insertar** puntajes de sus cruces. La auditoría solo la lee el admin.
- **Tiempo real:** `match_scores` y `matches` en la publicación `supabase_realtime`.

**Por qué**
Ver [Modelo de datos](Modelo-de-datos) y [Roles y permisos](Roles-y-permisos).

**Verificación realizada**
- Probado antes de aplicar en un Postgres en memoria (PGlite): cruces repetidos (también con los grupos invertidos), grupo en dos bases en la misma ronda, base que puntúa cruce ajeno, base que edita un puntaje enviado, ganador que no pertenece al cruce, corrección por el admin con su rastro en la auditoría, y aislamiento de lectura de perfiles y auditoría.
- Aplicado en Supabase: respuesta *Success*; verificación posterior: 11 tablas/vistas en `public`, 20 políticas, 2 tablas en tiempo real.

**Cómo revertir (solo en desarrollo, borra todos los datos)**
```sql
drop view if exists public.team_standings;
drop table if exists public.score_audit, public.match_scores, public.matches,
  public.team_runners, public.base_staff, public.base_questions,
  public.bases, public.teams, public.profiles, public.events cascade;
drop function if exists public.is_admin(), public.is_staff_of_match(uuid),
  public.validate_match(), public.validate_score(), public.after_score_change();
drop type if exists public.user_role, public.score_item, public.match_status;
```

## 0002 — Fotos y validación de la Carrera (2026-11-15)

**Qué crea**
- **Storage:** bucket público `photos` (máx. 2 MB, solo JPG/PNG/WebP) y 4 políticas en `storage.objects`: solo el admin sube, reemplaza o borra.
- **Función** `event_problems(evento)`: lista lo que impide activar la Carrera (menos de 2 grupos o 1 base, grupo o base sin foto, base sin información o con menos de 3 preguntas).
- **Trigger** `events_validate_activation`: rechaza activar una Carrera incompleta. La regla vive en la base de datos, no solo en la pantalla.

**Por qué**
El admin sube fotos de grupos y bases, y la Carrera no debe poder activarse con datos a medias.

**Cómo aplicar**
Supabase > SQL Editor, con el rol por defecto `postgres`, pegar el archivo completo y Run. Si dice *must be owner* o falla RLS, ejecutar `reset role;` en la misma consulta.

**Cómo revertir**
```sql
drop trigger if exists events_validate_activation on public.events;
drop function if exists public.validate_event_activation(), public.event_problems(uuid);
drop policy if exists photos_admin_select on storage.objects;
drop policy if exists photos_admin_insert on storage.objects;
drop policy if exists photos_admin_update on storage.objects;
drop policy if exists photos_admin_delete on storage.objects;
-- el bucket se vacía y borra desde Storage en el panel
```

## 0003 — Reglas de personal (2026-11-15)

**Qué cambia**
- Trigger `base_staff_validate`: un inductor solo puede atender **una base por Carrera**.
- Trigger `team_runners_validate`: un corredor solo puede estar en **un grupo por Carrera**.
- `event_problems()` ahora exige **mínimo 2 corredores por grupo** y avisa de asignaciones repetidas que ya existieran.

**Por qué**
Se detectó que un inductor podía quedar asignado a dos bases a la vez. La regla vive en la base de datos, no solo en la pantalla.

**Verificación**
Probado en Postgres en memoria: rechaza al inductor en dos bases y al corredor en dos grupos, y la validación reporta grupos con menos de 2 corredores. Las filas repetidas que ya existan no se borran: aparecen como pendiente en la pestaña Carrera para corregirlas a mano.

**Cómo revertir**
```sql
drop trigger if exists base_staff_validate on public.base_staff;
drop trigger if exists team_runners_validate on public.team_runners;
drop function if exists public.validate_base_staff(), public.validate_team_runner();
-- event_problems() vuelve a su versión de 0002 volviendo a ejecutar esa función
```

## 0004 — Sin empates por ítem (2026-11-15)

**Qué cambia** Restricción `match_scores_winner_required`: `winner_team_id` no puede ser nulo. Es `NOT VALID`, así que rige para puntajes nuevos o editados y no falla por filas de prueba antiguas.

**Por qué** En la Carrera nunca hay empate en un ítem; la pantalla ya no lo ofrece y la base de datos lo garantiza.

**Cómo revertir**
```sql
alter table public.match_scores drop constraint match_scores_winner_required;
```

## 0005 — Calificar en orden (2026-11-15)

**Qué cambia** `validate_score()` rechaza el puntaje de un inductor de base si su misma base tiene una ronda anterior sin terminar (sin los 3 ítems). El coordinador no tiene esta restricción.

**Por qué** La base solo debe calificar la ronda en curso; el orden se garantiza también en la base de datos.

**Verificación** Probado en Postgres en memoria: la ronda 2 se rechaza mientras la 1 esté incompleta, se acepta al terminar la 1, y el admin puede puntuar fuera de orden.

**Cómo revertir** Volver a ejecutar `validate_score()` de `0001` (sin el bloque de la ronda anterior).

## 0006 — Ítems invalidados (2026-11-15)

**Qué cambia**
- `match_scores.voided`: el coordinador puede marcar un ítem (barra, pregunta o minijuego) como **invalidado** cuando no se alcanza a jugar. Nadie suma por ese ítem.
- Restricción `match_scores_winner_or_void` (reemplaza a `match_scores_winner_required`): un puntaje tiene ganador, o está invalidado y no tiene ganador. Sigue sin haber empates.
- `validate_score()`: solo el admin puede invalidar. Una base no puede puntuar un ítem invalidado (ya existe la fila del ítem).
- `after_score_change()`: un ítem invalidado cuenta como resuelto, así que el cruce termina cuando sus 3 ítems están puntuados o invalidados.
- `score_audit.old_voided` / `new_voided`: el registro de cambios muestra las invalidaciones.

**Por qué**
Por falta de tiempo puede no jugarse una barra o un minijuego. El coordinador invalida el ítem (incluso antes de que llegue la ronda) y la base solo califica lo que queda; si se invalidan los 3, la base pasa a la siguiente ronda.

**Verificación** Probado en Postgres en memoria: la base no puede invalidar ni puntuar un ítem invalidado; con 2 ítems invalidados el cruce termina al calificar el tercero; el ranking no cuenta los invalidados; la auditoría los registra.

**Cómo revertir**
```sql
alter table public.match_scores drop constraint match_scores_winner_or_void;
delete from public.match_scores where voided;
alter table public.match_scores drop column voided;
alter table public.score_audit drop column old_voided, drop column new_voided;
-- y volver a ejecutar validate_score() y after_score_change() de 0005 / 0001
```

## 0007 — Llegada de los grupos y foto de la base (2026-11-15)

**Qué cambia**
- `matches.arrived_at` y la función `confirm_arrival(cruce)`: la base confirma que **llegaron ambos grupos**; el cruce pasa a *en juego* y queda la hora. Solo la base de ese cruce (o el admin) puede llamarla; la base no recibe permiso general de escritura sobre `matches`.
- `after_score_change()`: un cruce con llegada confirmada sigue *en juego* aunque se borren sus puntajes.
- Política `bases_staff_update` y trigger `bases_restrict_staff_update`: un inductor puede cambiar **solo la foto** de su base (por ejemplo si se mueve por lluvia); cambiar nombre, información u otro dato lo rechaza el trigger.
- Storage: los inductores de base pueden subir fotos a la carpeta `bases/`.

**Verificación** Probado en Postgres en memoria: otra base no puede confirmar la llegada; el estado pasa a en juego y se mantiene; el inductor cambia la foto de su base pero no el nombre ni la foto de otra base. Las políticas de Storage no se pueden probar ahí y se validan al aplicarlas.

**Cómo revertir**
```sql
drop policy if exists photos_staff_insert on storage.objects;
drop policy if exists photos_staff_select on storage.objects;
drop trigger if exists bases_restrict_staff_update on public.bases;
drop function if exists public.restrict_base_staff_update();
drop policy if exists bases_staff_update on public.bases;
drop function if exists public.confirm_arrival(uuid);
alter table public.matches drop column arrived_at;
-- y volver a ejecutar after_score_change() de 0006
```

## 0008 — Información de la base privada (pendiente de aplicar)

**Qué cambia**
- Nueva tabla `base_details` (`base_id`, `info`): la información que se da en la base sale de `bases` (columna `info` eliminada, datos copiados) y solo la leen el **admin y los inductores de esa base**; solo el admin escribe.
- `base_questions`: la lectura pasa de "todos" a **admin e inductores de esa base**.
- Función `is_staff_of_base(base)`.
- `event_problems()` y `restrict_base_staff_update()` se actualizan al nuevo lugar de la información.
- `bases` entra a la publicación de tiempo real, para que los corredores vean al instante el cambio de foto de una base.

**Por qué**
Los corredores solo deben ver el nombre y la foto de la base. Ocultarlo en la pantalla no basta: aquí lo impide la base de datos.

**Verificación** Probado en Postgres en memoria: un corredor no lee ni la información ni las preguntas pero sí el nombre y la foto de las bases; un inductor ve solo lo de su base; el admin ve todo y escribe; la información existente se copia sin pérdida.

**Importante** El código de esta versión ya usa `base_details`: aplicar el SQL justo después del despliegue.

**Cómo revertir**
```sql
alter table public.bases add column info text;
update public.bases b set info = d.info from public.base_details d where d.base_id = b.id;
drop table public.base_details;
drop policy base_questions_read on public.base_questions;
create policy base_questions_read on public.base_questions for select to authenticated using (true);
drop function public.is_staff_of_base(uuid);
alter publication supabase_realtime drop table public.bases;
-- y volver a ejecutar event_problems() de 0003 y restrict_base_staff_update() de 0007
```

## 0009 — Mapa y GPS (2026-11-15)

**Qué cambia**
- `bases.lat` / `bases.lng`: ubicación de cada base. La fija el coordinador, o la propia base si se mueve (el trigger de `0007` ya le permite cambiar solo foto y ubicación).
- Tabla `team_locations` (una fila por grupo con su **última** ubicación: lat, lng, precisión, rumbo, velocidad, hora). El servidor pone quién la envió y la hora (trigger `team_locations_stamp`).
- RLS: **solo el corredor designado para el GPS de ese grupo** escribe su fila; lo lee el coordinador (todas) y ese corredor (solo la de su grupo, necesario para el *upsert*). Las demás bases y corredores no ven la ubicación de nadie.
- `team_locations` entra a la publicación de tiempo real (mueve los marcadores del mapa del coordinador al instante).

**Por qué**
Mapa en vivo del coordinador (Bloque 6). Un solo corredor por grupo transmite; la ubicación es privada.

**Verificación** Probado en Postgres en memoria: el designado sube y actualiza la ubicación de su grupo, no la de otro; un corredor no designado no escribe ni lee; la base no lee ubicaciones y sí fija la ubicación de su base; el admin lee todo; el servidor sella quién y cuándo; coordenadas fuera de rango se rechazan.

**Cómo revertir**
```sql
drop table public.team_locations;
drop function public.stamp_team_location();
alter table public.bases drop column lat, drop column lng;
```

## 0010 — Alertas de demora (pendiente de aplicar)

**Qué cambia**
- `events.max_travel_minutes` (1 a 120, por defecto 10): el tiempo máximo de traslado entre bases lo configura el coordinador.
- `matches.finished_at`: hora en que un cruce terminó (sus 3 ítems puntuados o invalidados). `after_score_change()` la guarda y la borra si el cruce deja de estar terminado. Los cruces ya terminados toman la hora de su último puntaje.
- Tabla `alerts` (aviso manual del coordinador para un cruce): la leen los usuarios autenticados y **solo el coordinador** crea o borra. Entra a tiempo real.

**Por qué**
Avisar a los corredores y a la base cuando un grupo tarda demasiado entre bases. Cuánto lleva un grupo en camino se calcula como "ahora menos la hora en que terminó su cruce anterior", mientras la base no confirme que llegaron ambos.

**Verificación** Probado en Postgres en memoria: la hora de término se guarda y se limpia con el estado del cruce; el máximo fuera de rango se rechaza; el admin crea avisos, el corredor y la base solo los leen y no los crean; un mensaje vacío se rechaza.

**Importante** El código de esta versión ya lee `max_travel_minutes`: aplicar el SQL justo después del despliegue.

**Cómo revertir**
```sql
drop table public.alerts;
alter table public.matches drop column finished_at;
alter table public.events drop column max_travel_minutes;
-- y volver a ejecutar after_score_change() de 0007
```

## 0011 — Traslado por tramo y notificaciones push (pendiente de aplicar)

**Qué cambia**
- `base_travel_times`: tiempo máximo de cada **tramo** (de una base a otra). Un tramo sin tiempo propio usa el general de la Carrera (`events.max_travel_minutes`). Lo lee cualquiera, solo el admin lo escribe.
- `push_subscriptions`: una fila por teléfono suscrito a notificaciones. Se guardan y quitan con las funciones `save_push_subscription` / `remove_push_subscription` (si el teléfono lo usó otra persona, pasa a quien entró ahora).
- `push_config`: dirección y clave del envío; ningún usuario de la app puede leerla.
- `push_send()`: llama a `/api/push` en Vercel con la clave. Solo la usan las funciones de abajo.
- `check_delays()`: revisa, **cada 10 segundos**, qué grupos superaron el tiempo de su tramo sin que la base confirme la llegada, y manda la notificación al corredor, a la base y al coordinador. Solo llama a Vercel si hay alguna demora.
- Trigger en `alerts`: el aviso manual del coordinador también sale como notificación.

**Cómo activar las notificaciones (una vez)**
1. En Vercel agregar `VAPID_PUBLIC_KEY`, `VITE_VAPID_PUBLIC_KEY` (la misma), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `PUSH_SECRET`, y hacer *Redeploy*. Las claves VAPID se generan con `npx web-push generate-vapid-keys`.
2. Ejecutar `0011` y después `supabase/push_setup.sql` (poniendo en él el mismo valor de `PUSH_SECRET`).

**Verificación** Probado en Postgres en memoria (con el envío simulado): sin configuración o con la Carrera inactiva no se llama a nadie; con una demora se manda una sola llamada con la clave y tres avisos (corredor, base, coordinador); el tiempo del tramo cambia el umbral; si la base confirma la llegada, deja de avisar; el aviso manual llega a los tres destinatarios correctos; un corredor no puede ejecutar la revisión ni escribir tiempos. El envío real y el programador (`pg_cron`) se validan al activarlos.

**Cómo revertir**
```sql
select cron.unschedule(jobid) from cron.job where jobname = 'check-delays';
drop trigger alerts_after_insert on public.alerts;
drop function public.alerts_push(), public.check_delays(), public.push_send(jsonb),
  public.save_push_subscription(text, text, text), public.remove_push_subscription(text);
drop table public.push_config, public.push_subscriptions, public.base_travel_times;
```

## 0012 — Notificaciones solo para corredores (pendiente de aplicar)

**Qué cambia**
- `check_delays()` y el aviso manual mandan la notificación **solo a los corredores** de los grupos implicados (antes también a la base y al coordinador).
- Política `alerts_base_insert`: la base puede mandar avisos a los grupos de **sus propios cruces** (antes solo el coordinador).

**Por qué**
Quienes tienen que apurarse son los corredores; el coordinador y la base son quienes mandan los avisos.

**Verificación** Probado en Postgres en memoria (envío simulado): una demora genera un solo aviso para los corredores del grupo; el aviso manual llega a los corredores de los dos grupos y a nadie más; la base del cruce puede enviar avisos, otra base o un corredor no.

**Cómo revertir** Volver a ejecutar `check_delays()` y `alerts_push()` de `0011` y `drop policy alerts_base_insert on public.alerts;`.

## 0013 — Sin demora si el grupo no camina

**Qué cambia** `check_delays()` ignora a un grupo cuya siguiente base es **la misma** donde ya está (`p.base_id <> m.base_id`). La versión de la app (`lateTeams` en `src/lib/delays.ts`) tiene la misma regla.

**Por qué** Lo encontró la suite de pruebas: con pocas bases es normal que un grupo juegue dos rondas seguidas en la misma base. Ese grupo recibía "Llevas N min en el traslado" y la notificación cada 30 s sin haberse movido, solo porque su rival tardaba en llegar. Ahora solo avisan los grupos que de verdad tienen que caminar a otra base.

**Verificación** `tests/db/alerts.test.ts` ("does NOT warn a group whose next match is at the same base…"), `tests/unit/delays.test.ts` y la prueba de paridad cliente/servidor.

**Cómo revertir** Volver a ejecutar `check_delays()` de `0012_runner_only_push.sql`.

## 0014 — Usuarios por Carrera

**Qué cambia** `profiles.event_id` (la Carrera del corredor o inductor; el coordinador no tiene). Los usuarios existentes se asignan a la Carrera donde ya trabajan (la más reciente si estaban en varias). `validate_team_runner()` y `validate_base_staff()` rechazan asignar a alguien de otra Carrera ("Ese usuario pertenece a otra Carrera.") y adoptan para la Carrera a quien aún no tenía. `events` entra a la publicación de Realtime.

**Por qué** Los usuarios se compartían entre Carreras: todas las listas de corredores e inductores mostraban a todos. Ahora cada Carrera tiene los suyos (Usuarios, Grupos y Bases solo listan los de la Carrera elegida; los usuarios creados antes y sin asignación aparecen en "Sin Carrera asignada" para adoptarlos o eliminarlos). Con `events` en Realtime, activar o desactivar la Carrera llega de inmediato a corredores y bases.

**Verificación** `tests/db/rules.test.ts` ("keeps users inside their own Carrera…"). En Supabase: `select count(*) from public.profiles where role <> 'admin' and event_id is null;` → usuarios sin Carrera (deberían ser solo los que nunca fueron asignados).

**Cómo revertir** `alter table public.profiles drop column event_id;`, volver a ejecutar las dos funciones de `0003_staff_rules.sql` y `alter publication supabase_realtime drop table public.events;`.

## 0015 — Registro por Carrera y calificación solo en la activa

**Qué cambia** `score_audit.event_id` (se llena solo con un trigger, también en las filas anteriores y las de cruces borrados quedan sin Carrera solo si ya estaban huérfanas). `is_staff_of_match()` exige que la Carrera del cruce sea la activa: un inductor no puede calificar, confirmar llegada ni enviar avisos en una Carrera apagada. El coordinador no cambia: puede corregir cualquier Carrera.

**Por qué** La pantalla de Puntajes pedía el registro de todas las Carreras (últimas 500 filas) y filtraba en el navegador: una Carrera antigua podía verse vacía y los cruces borrados perdían su rastro. Y nada impedía a un inductor de una Carrera apagada calificar llamando a la API.

**Verificación** `tests/db/carreras.test.ts` ("what a switched-off Carrera allows" y "score audit log per Carrera"). En Supabase: `select count(*) from public.score_audit where event_id is null;` (solo deberían quedar filas de cruces ya borrados antes de esta migración).

**Cómo revertir** `alter table public.score_audit drop column event_id;`, `drop trigger score_audit_event on public.score_audit; drop function public.audit_set_event();` y volver a crear `is_staff_of_match()` como en `0001_initial_schema.sql`.

## 0016 — Sin demora si el grupo descansa

**Qué cambia** `check_delays()` solo considera a un grupo cuyo último cruce fue en la ronda **inmediatamente anterior** (`p.round_number = m.round_number - 1`). `lateTeams` (`src/lib/delays.ts`) tiene la misma regla.

**Por qué** Lo encontró la tercera ejecución del agente de pruebas: con número impar de grupos, o más grupos que el doble de bases, un grupo descansa una ronda y su tiempo de descanso contaba como traslado: sus corredores recibían sonido y notificación cada 30 s sin estar tarde. Si hace falta apurar a alguien en ese caso, el coordinador o la base avisan a mano.

**Verificación** `tests/db/alerts.test.ts`, `tests/db/edge.test.ts` ("does not push the runners of a group that rests…"), `tests/unit/delays-edge.test.ts` y la prueba de paridad cliente/servidor.

**Cómo revertir** Volver a ejecutar `check_delays()` de `0013_no_delay_same_base.sql`.

## 0017 — Endurecimiento

**Qué cambia**
- `server_now()`: la hora del servidor. La app corrige el reloj del teléfono con ella (`src/lib/clock.ts`) para las alertas de demora.
- **Avisos** (`alerts`): los lee solo el coordinador, los corredores de ese cruce y el inductor de su base (antes cualquier usuario); una base solo puede avisar con el `event_id` de su propio cruce; y una base no puede enviar más de un aviso cada 20 s al mismo cruce (el coordinador no tiene límite).
- **Auditoría**: si solo cambia "quién calificó" (por ejemplo, se elimina a un inductor), `after_score_change()` ya no escribe filas "Corrigió".

**Por qué** Tercera ejecución del agente de pruebas: un reloj de teléfono desajustado daba alarmas falsas (o escondía una real); cualquier usuario leía todos los avisos y una base podía inundar de notificaciones a sus corredores; y eliminar a un inductor llenaba el registro de correcciones falsas.

**Verificación** `tests/db/edge.test.ts` ("hides the alerts…", "refuses an alert whose event_id…", "limits a base…", "server clock", "deleting an inductor…").

**Cómo revertir** `drop function public.server_now();` y `drop trigger alerts_rate_limit on public.alerts; drop function public.alerts_rate_limit();`; recrear las políticas `alerts_read` (`using (true)`) y `alerts_base_insert` como en `0012_runner_only_push.sql`; `drop function public.is_runner_of_match(uuid);` y volver a ejecutar `after_score_change()` de `0010_delay_alerts.sql`.

## 0018 — Foto de cada usuario

**Qué cambia** `profiles.photo_path` (texto, opcional): la foto de la persona, en la carpeta `users/` del bucket `photos`. El coordinador la sube desde *Usuarios* (botón de cámara en cada persona) y se ve en lugar de la inicial en la cabecera de la persona y en la lista.

**Por qué** Personalizar la app: cada corredor e inductor ve su propia foto junto a su nombre.

**Verificación** `tests/db/profile-photo.test.ts`. La app sigue funcionando sin esta migración (entrar y listar usuarios leen el perfil sin la foto si la columna no existe), pero subir fotos falla hasta aplicarla.

**Cómo revertir** `alter table public.profiles drop column photo_path;` (las imágenes quedan en el almacenamiento).

## 0019 — Borrado limpio, privacidad y avisos a la base

**Qué cambia**
- **Borrado limpio:** `after_score_change()` ya no audita el borrado de un puntaje cuando su cruce ya no existe (el caso de eliminar toda una Carrera); y se borran las filas de `score_audit` sin Carrera que ya habían quedado. Eliminar una Carrera no deja nada.
- **Solo se elimina una Carrera desactivada:** el trigger `events_delete_guard` lo exige en la base de datos ("Desactiva la Carrera antes de eliminarla.").
- **Privacidad entre Carreras:** `events`, `teams`, `bases`, `matches` y `base_travel_times` solo los lee el coordinador o quien pertenece a esa Carrera (`my_event_id()`); `team_runners` y `base_staff` solo los ve cada persona (su propia fila).
- **Nadie sabe quién va ganando:** `match_scores` (y por tanto `team_standings`, que respeta esas políticas) solo lo leen el coordinador, el inductor de esa base y los corredores de ese cruce.
- **Un usuario por grupo basta:** `event_problems()` exige al menos 1 corredor (antes 2), para que la pareja comparta un solo usuario.
- **Avisos a la base:** `alerts.target` (`groups` por defecto, o `base`). Con `base` llegan como notificación a los inductores de la base del cruce; los corredores no los ven y una base no puede mandarlos.

**Por qué** Eliminar una Carrera dejaba 45 filas huérfanas; la privacidad entre Carreras era solo un filtro del teléfono; los puntajes eran legibles por todos aunque la app no los mostrara; el coordinador necesita apurar a una base que se demora en un juego.

**Verificación** `tests/db/privacy-0019.test.ts`, `tests/db/simulacro.test.ts` (sección 5: eliminar la Carrera no deja nada ni siquiera en el registro) y las pruebas de permisos. En Supabase: `select count(*) from public.score_audit where event_id is null;` debe dar 0.

**Cómo revertir** Recrear las políticas `*_read` con `using (true)` (como en `0001` y `0011`), `scores_read` con `using (true)`, `drop trigger events_delete_guard on public.events;`, `alter table public.alerts drop column target;`, restaurar `alerts_push()` de `0012`, `alerts_read`/`alerts_base_insert` de `0017`, `event_problems()` de `0008` y `after_score_change()` de `0017`; `drop function public.my_event_id();`.

## 0020 — Desactivar reinicia el avance

**Qué cambia** Al pasar una Carrera de activa a desactivada, el trigger `events_reset_on_deactivate` llama a `reset_event_progress()`: borra los puntajes, el registro de cambios, los avisos y las ubicaciones de los grupos, y cada cruce vuelve a "pendiente" sin llegada confirmada. **Se conserva** lo que se preparó: grupos, bases, usuarios, fotos, tiempos de traslado y el cronograma.

**Por qué** Al desactivar y volver a activar una Carrera, seguía "como si nada" (con los puntajes y llegadas de antes). Ahora se reinicia por completo y arranca desde cero.

**Verificación** `tests/db/carreras.test.ts` ("deactivating a Carrera resets its whole progress"), `tests/db/simulacro.test.ts` (sección 5) y `tests/db/edge.test.ts`. En Supabase, tras desactivar una Carrera: `select count(*) from public.match_scores where match_id in (select id from public.matches where event_id = '<id de la Carrera>');` debe dar 0.

**Cómo revertir** `drop trigger events_reset_on_deactivate on public.events; drop function public.events_reset_on_deactivate(); drop function public.reset_event_progress(uuid);` (lo ya reiniciado no se recupera).

## 0021 — El @ de los demás equipos (2026-11-19)

**Qué cambia** Función `public.team_contacts()` (`security definer`, solo `authenticated`) que devuelve `(team_id, username)` de los corredores de los grupos de la Carrera de quien la llama. La pueden llamar los corredores (solo ven su propia Carrera) y el coordinador (ve todo); los inductores reciben una lista vacía y el rol anónimo no tiene permiso.

**Por qué** La pantalla *Top* del corredor abre una ficha de cada equipo (foto grande y @ de su corredor) para poder encontrarlo en la Carrera. Un corredor solo veía su propia fila de `team_runners` y su propio perfil, así que no había forma de saber el @ de los demás sin abrir esas tablas. La función entrega únicamente el usuario: ni nombre, ni foto, ni puntos.

**Verificación** `tests/db/team-contacts-0021.test.ts` (lista los grupos de la propia Carrera, no los de otra, no sirve a la base ni a anónimos, el coordinador ve todo). Sin la migración la app sigue funcionando: la ficha del equipo sale sin @.

**Aplicada en producción el 2026-11-19** (a mano en el SQL Editor de Supabase, confirmado por el mantenedor).

**Cómo revertir** `drop function public.team_contacts();`

## 0022 — Calificar exige la llegada confirmada (2026-11-19)

**Qué cambia** `validate_score()` (el disparador de `match_scores`) rechaza el INSERT de una base si `matches.arrived_at` está vacío: *"Primero confirma que llegaron los dos grupos a tu base."* El coordinador no está obligado (puede cargar o corregir resultados a mano). El resto de la función es idéntico a la de `0006` (ganador dentro del cruce, solo el coordinador invalida, orden de rondas).

**Por qué** La sexta ejecución del tester (`qa-visa-privacy.test.ts`) mostró que la base de datos aceptaba un puntaje sin llegada confirmada: el primer puntaje pasaba el cruce a *en juego* con `arrived_at` vacío, así que las demoras, el registro de operaciones y la hora de llegada quedaban incompletos. Solo la pantalla escondía los botones. La pantalla de la base ahora también exige `arrived_at` para mostrar las etapas.

**Verificación** `tests/db/qa-visa-privacy.test.ts` (*0022*: la base es rechazada antes de confirmar y el rechazo no cambia el cruce; confirma y califica; el coordinador califica sin llegada). Las demás pruebas (`playMatch` confirma la llegada antes de calificar) siguen pasando sin cambios.

**Aplicada en producción el 2026-11-19** (a mano en el SQL Editor de Supabase, confirmado por el mantenedor).

**Cómo revertir** Volver a crear `validate_score()` con el cuerpo de `0006_void_items.sql`.

## 0023 — El pasaporte personal del inductor

**Qué cambia**
- Tabla `terms` (semestre: `name` único, `theme` = la temática, p. ej. `mitologias`, y `is_current`; **un solo semestre vigente** por índice único parcial). `events.term_id` (columna nueva): cada Carrera nueva queda en el semestre vigente (trigger `events_default_term`).
- Tabla `passports` (la persona: `id` = su usuario en `auth.users`, `username`, `full_name`, `photo_path`). **No tiene fila en `profiles`**: el usuario personal no es corredor, base ni coordinador de la operación en vivo, así que ninguna política le da filas de grupos, bases, cruces ni puntajes.
- Tabla `passport_records` (el registro de **un semestre**: `role` corredor / base / coordinador, `career`, `culture`, `team_id` si corre, `base_id` si es base). Único por `(passport_id, term_id)`; solo un corredor tiene grupo y solo una base tiene base (`check`); un grupo tiene **como máximo dos personas** y el grupo o la base deben ser de una Carrera **del mismo semestre** (trigger `validate_passport_record`).
- Tabla `passport_stamps` (los sellos que se guardan para siempre: `kind` visited / hosted / coordinated, nombre de la Carrera y de la base, ronda y hora). `archive_event_stamps(evento)` los escribe y **corre antes** de que la desactivación reinicie la Carrera (`events_archive_stamps` va antes que `events_reset_on_deactivate` porque los disparadores se ejecutan en orden alfabético): corredores reciben un sello por cada cruce que su grupo terminó, bases por cada cruce terminado en su base y coordinadores del semestre uno por la Carrera, solo si se jugó algo. Volver a activar y terminar la misma Carrera no duplica sellos.
- RLS: cada persona lee solo **su** pasaporte, sus registros y sus sellos; `terms` lo lee cualquier usuario autenticado; el coordinador lo gestiona todo.
- `my_passport_context()` (mi grupo con el nombre de con quién corro, mi base y mi Carrera) y `my_live_stamps()` (los sellos que ya gané en la Carrera activa): solo nombres y cruces terminados, ni puntos ni el cruce.
- No toca el enum `user_role` ni `profiles`.

**Por qué** El coordinador de cada semestre sube el Excel de inductores (nombre y carrera) y la app crea un usuario personal por persona. Ese @ abre un pasaporte propio con su carrera, su cultura según la temática del semestre y los sellos de su paso por la Carrera, que debe seguir ahí semestre tras semestre aunque el avance de cada Carrera se reinicie al desactivarla. Cada persona puede correr en un semestre y ser base en otro, por eso el registro es por semestre. El usuario del grupo (el que entra a la operación) sigue siendo aparte.

**Verificación** `tests/db/passports-0023.test.ts` (20 pruebas: semestre vigente único, privacidad entre personas y frente a la operación, un registro por semestre, máximo dos por grupo, mismo semestre, archivado antes del reinicio, sin duplicados, sin sellos si no se jugó, sellos que sobreviven al borrar la Carrera, contexto y sellos en vivo). En Supabase: `select count(*) from public.terms;` debe responder (0 al inicio).

**Aplicada en producción el 2026-11-19** (a mano en el SQL Editor de Supabase, confirmado por el mantenedor).

**Cómo revertir** `drop trigger events_archive_stamps on public.events; drop trigger events_default_term on public.events; alter table public.events drop column term_id; drop function public.my_live_stamps(); drop function public.my_passport_context(); drop function public.events_archive_stamps(); drop function public.archive_event_stamps(uuid); drop function public.events_default_term(); drop table public.passport_stamps, public.passport_records, public.passports, public.terms cascade; drop function public.validate_passport_record();` (se pierden los pasaportes y sus sellos).

## 0024 — La identidad del pasaporte personal

**Qué cambia**
- `passport_records.committee` (uno de los cinco comités de la inducción: la app guarda la clave, p. ej. `clausura`) y `committee_lead` (el coordinador del comité, que recibe el sello dorado). Un comité tiene **un solo coordinador por semestre** (índice único parcial en `(term_id, committee)`) y solo alguien con comité puede coordinarlo (`check`).
- `passports.generation` y `passports.joined_term` (generación y cuándo entró a la inducción: los pone el coordinador) y `passports.nickname`, `symbol`, `symbol_label` (apodo y símbolo: los pone cada persona). Todos con límite de largo y, el símbolo, de formato (`^[a-z0-9-]{2,24}$`).
- Una política nueva (`passports_self_update`) deja a cada persona actualizar **su** fila de `passports`, y el disparador `passports_guard` solo le deja tocar el apodo y el símbolo: el nombre, el @, la foto, la generación y el ingreso siguen siendo del coordinador (que puede cambiar todo). El servidor, con la llave de servicio (sin usuario), cambia el @ cuando la persona lo pide con su contraseña (`api/account.ts`). Los registros por semestre (rol, comité…) siguen siendo solo del coordinador.

**Por qué** El pasaporte personal necesita decir a qué comité pertenece cada inductor (cinco comités, cada uno con su coordinador y su sello), de qué generación es, cuándo entró a la inducción y dejar que cada quien ponga su apodo y su símbolo. Sin esta migración la app sigue funcionando (el pasaporte abre sin esos datos y *Inductores* avisa que falta).

**Verificación** `tests/db/passport-identity-0024.test.ts` (comité y coordinador únicos por semestre, la persona no puede tomar comité ni coordinar, qué edita cada lado, límites) y `tests/api/account.test.ts` (cambio de @ y contraseña).

**Cómo revertir** `drop trigger passports_guard on public.passports; drop function public.passports_guard(); drop policy passports_self_update on public.passports; drop index public.passport_records_committee_lead; alter table public.passport_records drop column committee_lead, drop column committee; alter table public.passports drop column nickname, drop column symbol, drop column symbol_label, drop column generation, drop column joined_term;` (se pierden esos datos).

## 0025 — Las páginas del pasaporte

**Qué cambia**
- `terms.welcome`: las palabras de los coordinadores a sus inductores **en esa inducción** (salen en la página de la inducción de cada pasaporte).
- Tabla `term_committees` (`term_id`, `committee`, `message`): las palabras de cada comité, por inducción. Las lee cualquier usuario con sesión y solo las escribe el coordinador. Se borran con su inducción.
- `my_passport_context()` también devuelve `base_photo_path` (la foto de la base de quien la atiende: es su sello dorado).
- El apodo, el símbolo y su nombre **se ponen una sola vez y no se vuelven a cambiar**: se quita la política `passports_self_update` de 0024, así que nadie edita su propia fila y solo el coordinador (o el servidor) los pone o corrige.

**Por qué** El pasaporte es el de toda la vida de la persona en la inducción: la cubierta y la página de identidad son generales (sin temática, comité, papel ni pareja) y cada inducción trae sus propias páginas, con su temática (Mitologías solo es la de la 2710). Esas páginas necesitan las palabras de los coordinadores y de cada comité, y el sello dorado con la foto necesita la de la base. Sin esta migración el pasaporte abre igual, sin esas palabras, y *Inductores* avisa que falta.

**Verificación** `tests/db/passport-pages-0025.test.ts` (palabras de la inducción y de los comités, límites, quién lee y quién escribe, nadie edita su pasaporte, foto de la base en el contexto).

**Cómo revertir** `drop function public.my_passport_context(); drop table public.term_committees; alter table public.terms drop column welcome;` y volver a crear `my_passport_context()` y la política `passports_self_update` de 0023 / 0024.

## 0026 — Más de un coordinador por comité

**Qué cambia** Se quita el índice único `passport_records_committee_lead` de 0024: un comité puede tener varios coordinadores (Caos tiene dos) y todos reciben el sello dorado.

**Por qué** La regla de "un solo coordinador por comité" no era cierta en la inducción real.

**Verificación** `tests/db/passport-identity-0024.test.ts` (dos coordinadores del mismo comité) y `tests/static/passports.test.ts`.

**Cómo revertir** `create unique index passport_records_committee_lead on public.passport_records (term_id, committee) where committee_lead;` (falla si ya hay dos coordinadores en un comité).

## 0027 — Más de un comité por persona

**Qué cambia** `passport_records.extra_committees` (los demás comités de la persona) y `extra_leads` (los de esos que coordina, con sello dorado). El comité principal sigue en `committee` / `committee_lead`. Dos `check`: cada comité es una clave en minúsculas y los que coordina están entre los que tiene.

**Por qué** Hay quien coordina dos comités (Caos y Meraki) o es miembro de uno y además del de Bienvenida. Sin esta migración el pasaporte abre igual pero solo con el comité principal, e *Inductores* avisa que falta.

**Verificación** `tests/db/passport-more-committees-0027.test.ts`.

**Cómo revertir** `alter table public.passport_records drop column extra_committees, drop column extra_leads;` (se pierden esos datos).

## 0028 — El historial de puntajes

**Qué cambia** Tabla `event_archives` (`event_name`, `term_name`, `archived_at`, `matches_played`, `standings` y `results` en `jsonb`) y el disparador `events_archive_scores`. Al desactivar una Carrera que ya tuvo puntos, antes del reinicio de la 0020, se guarda la tabla final de los grupos y cada punto de cada cruce, con los nombres del grupo y de la base escritos tal cual. Cada vez que se desactiva después de jugarse de nuevo, se guarda otra copia. Si la Carrera nunca se jugó, no guarda nada. Si luego se borra la Carrera, el historial queda (`event_id` pasa a nulo). Solo el coordinador la lee y la borra (RLS); la función no la puede llamar la app. El nombre del disparador va antes de `events_archive_stamps` y de `events_reset_on_deactivate`.

**Por qué** Las Carreras no se eliminan: quedan desactivadas como historial del coordinador, pero desactivar reinicia sus puntajes. Con esto el historial conserva también quién ganó cada cruce. La pantalla *Historial* del panel lo muestra.

**Verificación** `tests/db/event-archives-0028.test.ts` (copia antes del reinicio, nada si no se jugó, una copia por desactivación, sobrevive al borrado, solo el coordinador).

**Cómo revertir** `drop trigger events_archive_scores on public.events; drop function public.events_archive_scores(); drop function public.archive_event_scores(uuid); drop table public.event_archives;` (se pierde el historial guardado).

## 0029 — La rotación entre rondas

**Qué cambia** Tablas `round_rotations` (una fila por Carrera y ronda: el coordinador avisa que ya pueden rotar) y `rotation_acks` (una fila por rotación y base: la base confirma que dejó ir a sus dos grupos), ambas en Realtime. Solo el coordinador avisa; cada pantalla lee las rotaciones de su Carrera; una base solo confirma por sí misma, una vez y mientras su Carrera está activa. `reset_event_progress` también borra las rotaciones al desactivar la Carrera (las confirmaciones se van en cascada).

**Por qué** Para cuadrar las bases a una distancia parecida, nadie se va hasta que todas terminan: el coordinador avisa y cada base confirma. Sin esta migración las pantallas siguen funcionando, sin la tarjeta de rotación, y *En vivo* avisa que falta.

**Verificación** `tests/db/round-rotations-0029.test.ts` (quién avisa, quién lee, una confirmación por base, reinicio al desactivar).

**Cómo revertir** `drop table public.rotation_acks; drop table public.round_rotations;` y volver a crear `reset_event_progress` como en la 0020.

## 0030 — Cinco preguntas con su respuesta

**Qué cambia** `base_questions.answer` (la respuesta, hasta 600 caracteres), la posición de una pregunta sube de 3 a 10 y `event_problems` exige, para activar una Carrera, que cada base tenga **al menos 5 preguntas con su respuesta** (las que no tienen respuesta no cuentan). Las respuestas se leen igual que las preguntas: solo el coordinador y la base. Las Carreras que ya están activas siguen funcionando; la regla se aplica la próxima vez que se active una.

**Por qué** El inductor necesita tener a la mano la respuesta de cada pregunta que puede hacer. Las bases de la Carrera de prueba tienen 3 preguntas sin respuesta: hay que completarlas en *Bases* antes de volver a activarla (el *seed* nuevo ya trae 5 con respuesta).

**Verificación** `tests/db/question-answers-0030.test.ts` (una Carrera completa no tiene problemas, con menos de 5 o sin respuestas no se activa y dice cuántas tiene, hasta 10 preguntas) y las pruebas de la base y de la Carrera de prueba, que ahora crean 5 preguntas con respuesta.

**Cómo revertir** `alter table public.base_questions drop column answer;`, volver a poner `check (position between 1 and 3)` (falla si hay preguntas 4 a 10) y recrear `event_problems` como en la 0019.

## 0031 — Avisos a un solo grupo

**Qué cambia** `alerts.team_id` (opcional): si está, el aviso «apúrense» es solo para los corredores de ese grupo; sin él va a los dos grupos del cruce, como antes. El grupo tiene que jugar ese cruce (`alerts_team_check`), un corredor solo lee los avisos de su cruce que son para los dos grupos o para el suyo (`alerts_read`, con el ayudante `is_runner_of_team`), `alerts_push` notifica solo a los corredores del grupo elegido y el límite de 20 s entre avisos de una base cuenta por destinatario (apurar al grupo A y enseguida al B se puede).

**Por qué** A veces uno de los dos grupos ya llegó a la base y el aviso le llega igual. La base ahora elige: a ambos o a un grupo en concreto. Sin esta migración todo sigue funcionando, pero apurar a un solo grupo falla (el aviso a los dos no).

**Verificación** `tests/db/targeted-alerts-0031.test.ts` (sin grupo llega a los dos, con grupo solo a ese, el grupo debe jugar el cruce, cada corredor lee lo suyo, el límite cuenta por destinatario).

**Cómo revertir** `alter table public.alerts drop column team_id;` y volver a crear `alerts_read`, `alerts_push` y `alerts_rate_limit` como en la 0019, y `drop function public.alerts_team_check() cascade; drop function public.is_runner_of_team(uuid);`.

## 0032 — Los estados de la Carrera y el reloj desde la rotación

**Qué cambia** `events.phase` (`disabled`, `enabled`, `started`, `finished`), `started_at` y `finished_at`. `is_active` sigue existiendo y siempre es «la fase no es `disabled`» (el trigger `events_a_sync_phase` los mantiene iguales y solo deja hacer los pasos válidos; poner `is_active = true` equivale a Iniciada, así que lo anterior sigue funcionando). `event_action(event, acción)` es la única puerta del coordinador: `enable` (valida la lista de pendientes y que no haya otra Carrera activa), `start`, `finish`, `disable` (desde Habilitada o Terminada: guarda el historial y reinicia el avance como siempre) y `reset` (solo desde Terminada: borra el avance SIN historial y deja la Carrera Habilitada). Los tres triggers que reaccionan a desactivar (`events_reset_on_deactivate`, `events_archive_stamps`, `events_archive_scores`) ahora escuchan también `phase`. Una base solo actúa (`staff_can_act`: confirmar llegada, calificar, avisar, confirmar la rotación) con la Carrera Iniciada; leer sigue igual y el coordinador corrige en cualquier estado. `check_delays()` solo corre con la Carrera Iniciada y cuenta desde el aviso de rotación de la ronda anterior (o desde que terminó el cruce, si no hubo aviso o es más tarde).

**Por qué** El coordinador quiere abrir la Carrera a las bases antes del día (Habilitada: ven todo con los botones desactivados y un tutorial), iniciar el reloj en el momento exacto, bloquear al terminar para validar, y poder repetir pruebas (Reiniciar). El reloj debe empezar cuando los grupos pueden salir, no cuando terminó su cruce. Las Carreras activas al aplicarla quedan Iniciadas.

**Verificación** `tests/db/event-phases-0032.test.ts` (transiciones y quién las hace, bloqueo de las bases por estado, reiniciar sin historial, deshabilitar con historial, reloj desde la rotación).

**Cómo revertir** Recrear `scores_base_insert`, `alerts_base_insert` (0019), `confirm_arrival` (0007), `acks_insert` (0029) y `check_delays` (0016) con `is_staff_of_match` / `e.is_active`; recrear los tres triggers con `after update of is_active`; `drop function public.event_action(uuid, text), public.staff_can_act(uuid); drop trigger events_a_sync_phase on public.events; alter table public.events drop column phase, drop column started_at, drop column finished_at;`.

## 0033 — Avisos de 15 s y nombre corto

**Qué cambia** El límite entre dos avisos de una base al mismo destinatario baja de 20 s a 15 s (`alerts_rate_limit`) y la notificación al inductor se titula «Aviso del coordi» (`alerts_push`).

**Por qué** El botón de apurar descansa 16 s en la app; con el límite de 20 s el aviso enviado justo después fallaba con «No se pudo enviar el aviso».

**Verificación** `tests/db/alert-rate-0033.test.ts`.

**Cómo revertir** Volver a crear `alerts_rate_limit` y `alerts_push` como en la 0031.

## 0034 — Sellos propios y límite de bases

**Qué cambia** Tabla `custom_seals` (nombre, mitología, color en hex y la imagen ya convertida a tinta en el bucket `photos`, carpeta `seals/`): la leen todos los usuarios con sesión y solo la escribe el coordinador. `seal_capacity()` = 15 sellos de la app + los subidos. El trigger `bases_seal_limit` impide crear una base si la carrera ya tiene tantas bases como sellos («Hay N sellos… primero hay que corregir los sellos») y `custom_seals_keep` impide borrar un sello que alguna carrera necesita.

**Por qué** Cada base lleva un sello distinto y no hay más de 15 en la app. Con más de 15 bases habría sellos repetidos: ahora se avisa y se pide subir más sellos en la pestaña *Sellos*.

**Verificación** `tests/db/custom-seals-0034.test.ts` (la base 16 se rechaza con la explicación, un sello nuevo hace espacio, no se borra el que hace falta, solo el coordinador sube sellos).

**Cómo revertir** `drop trigger bases_seal_limit on public.bases; drop trigger custom_seals_keep on public.custom_seals; drop function public.bases_seal_limit(), public.custom_seals_keep(), public.seal_capacity(); drop table public.custom_seals;`

## 0035 — El catálogo vivo de la inducción

**Qué cambia** `passports.status` (`active`, `ancestor`, `disabled`), `ancestor_at` y `disable_at`: un inductor que «cuelga el saco» pasa a ancestro, su pasaporte sigue abriendo hasta `disable_at` (por defecto 6 meses) y después queda deshabilitado (`passport_active()` en las políticas de lectura de `passports`, `passport_records` y `passport_stamps`); el coordi lo puede reactivar o deshabilitar ya. `committees` (clave, nombre, frase, tinta, activo): los seis comités de siempre, que ahora se agregan, renombran y desactivan desde el panel. `career_groups` y `careers` (Tronicas, Sistemas, Industrial, Biomec y Civil con sus carreras), `themes` (siempre existe una **global**, que no se puede borrar ni duplicar), `theme_cultures` (las culturas de cada temática) y `group_cultures` (la cultura que le toca a cada grupo de carreras en cada temática; sembrada con mitologías). Todos leen; solo el coordi escribe. El coordi de cada comité en cada semestre sigue siendo la marca `committee_lead` del registro de ese semestre (0026).

**Por qué** Para que CarreApp perdure sin tocar el código: los inductores nuevos, los comités, las carreras y las temáticas cambian con el tiempo.

**Verificación** `tests/db/inductor-admin-0035.test.ts` (ancestro vigente, vencido y deshabilitado, quién edita el catálogo, la temática global, un grupo con carreras no se borra, la cultura debe existir en la temática).

**Cómo revertir** Volver a crear las políticas de lectura de 0023, `alter table public.passports drop column status, drop column ancestor_at, drop column disable_at;` y `drop table public.group_cultures, public.theme_cultures, public.themes, public.careers, public.career_groups, public.committees;` (más `drop function public.passport_active(uuid), public.themes_keep_global() cascade;`).

## 0036 — Carreras con código, carrera de prueba y Finalizada

**Qué cambia** `events.code` (2710, 2730, 2810, 2830, 2910…: año de dos cifras + 10 primer semestre o 30 segundo; `next_event_code()` y `create_event()` los generan, el coordi no escribe el código) y `events.is_test` (UNA carrera de prueba, índice único, que no se puede eliminar ni dejar de serlo). Nuevo estado `archived` (**Finalizada**): `event_action(..., 'archive')` desde Terminada cierra la carrera y la manda al historial **conservando todos sus datos** (no reinicia el avance; sí guarda la copia legible de 0028); `'reopen'` la devuelve a Terminada. Deshabilitar sigue siendo volver a la configuración (copia + reinicio) y no se puede desde Finalizada; la carrera de prueba se puede reiniciar también desde Habilitada o Iniciada. Las carreras **no se eliminan** desde la app (trigger `events_protect_test`: solo con acceso directo a la base de datos, y nunca la de prueba). `create_event()` crea la carrera vacía con su propio semestre (término con el mismo código). La carrera que se llamaba «Carrera 2710» (con los datos de prueba) pasa a ser la **carrera de prueba** y se crea la **2710 real**, vacía. `badges`: las **insignias** (el logo de cada grupo de carreras) como catálogo global: nombre, descripción, grupo de carreras, imagen, disponible sí/no (se siembran las cinco de los grupos).

**Por qué** Cada edición semestral es una instancia independiente con su identificador consecutivo, siempre hay una carrera de prueba para probar sin riesgo, y cerrar una carrera no debe perder nada.

**Verificación** `tests/db/carreras-ciclo-0036.test.ts` (una sola carrera de prueba y la 2710 real vacía, la secuencia 2730→2810→2830→2910, la carrera nueva no hereda nada, solo el coordi crea, la de prueba no se elimina, Finalizada conserva puntajes y llegadas, reabrir, deshabilitar sigue reiniciando, reiniciar solo desde Terminada).

**Cómo revertir** Quitar el estado archived de las carreras (`update public.events set phase = 'finished' where phase = 'archived'`), recrear `events_sync_phase`, `events_reset_on_deactivate` y `event_action` como en 0032, `drop trigger events_protect_test on public.events; drop function public.events_protect_test(), public.next_event_code(), public.create_event(); drop table public.badges;` y `alter table public.events drop column code, drop column is_test;` (la carrera de prueba queda como una carrera normal).

## 0037 — Lo propio de cada carrera (Fase B)

**Qué cambia** `themes.term_id` y `template_of`: la temática de una carrera es una **copia** de una plantilla (`copy_theme_for_term`), con sus subtemáticas (`theme_cultures`) y la subtemática de cada grupo de carreras (`group_cultures`); `create_event(p_theme)` la copia al crear la carrera y la migración da su propia copia a cada semestre existente, así que editarla no toca otras carreras ni la plantilla. `event_committees`: los comités asignados a cada carrera (al crearla se asignan los activos). `events.coordinator_id`: el coordi de la carrera. `event_seals`: los sellos de cada carrera (temática, subtemática, grupo, comité y coordi) con forma, color e imagen; un elemento tiene un solo sello, dos elementos del mismo tipo no comparten diseño dentro de la carrera (`event_seals_unique_design`) y al elegir al coordi un trigger le pone el **sello dorado** (y lo mueve al cambiar de coordi). Los inductores de una carrera siguen siendo los registros del semestre de esa carrera.

**Por qué** Cada edición debe ser independiente: su temática, sus subtemáticas, sus comités, su coordi y sus sellos no se heredan. Sin la migración el panel sigue funcionando, pero las pestañas Temática, Sellos y Coordi y comités de una carrera avisan que falta aplicarla.

**Verificación** `tests/db/carrera-propia-0037.test.ts` (copia de la temática por carrera y sin tocar la plantilla, plantilla inexistente, los comités asignados son de la carrera, unicidad de sellos, mismo diseño permitido en otra carrera, el sello dorado se crea y se mueve, formas y colores válidos).

**Cómo revertir** `drop table public.event_seals, public.event_committees;` `alter table public.events drop column coordinator_id;` `drop function public.events_coordinator_seal() cascade, public.event_seals_unique_design() cascade, public.copy_theme_for_term(uuid, text);` recrear `create_event()` como en 0036 y `alter table public.themes drop column term_id, drop column template_of;` (borra antes las temáticas copiadas: `delete from public.themes where term_id is not null` y vuelve a apuntar `terms.theme` a la plantilla).

## Plantilla para nuevos registros

```
## 000X — Título (AAAA-MM-DD)
**Qué cambia** …
**Por qué** …
**Verificación** …
**Cómo revertir** …
```
