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
Probado en Postgres en memoria: rechaza al inductor en dos bases y al corredor en dos grupos, y la validación reporta grupos con menos de 2 corredores. Las filas repetidas que ya existan no se borran: aparecen como pendiente en el Resumen para corregirlas a mano.

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

## Plantilla para nuevos registros

```
## 000X — Título (AAAA-MM-DD)
**Qué cambia** …
**Por qué** …
**Verificación** …
**Cómo revertir** …
```
