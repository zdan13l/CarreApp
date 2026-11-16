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

## Plantilla para nuevos registros

```
## 000X — Título (AAAA-MM-DD)
**Qué cambia** …
**Por qué** …
**Verificación** …
**Cómo revertir** …
```
