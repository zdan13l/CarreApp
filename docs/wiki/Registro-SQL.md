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
| 0001 | [`0001_initial_schema.sql`](https://github.com/zdan13l/CarrerApp/blob/main/supabase/migrations/0001_initial_schema.sql) | 2026-11-15 | Esquema inicial: tipos, 10 tablas, vista de ranking, funciones, triggers, RLS y tiempo real |
| 0002 | [`0002_storage_and_event_validation.sql`](https://github.com/zdan13l/CarrerApp/blob/main/supabase/migrations/0002_storage_and_event_validation.sql) | _pendiente_ | Bucket de fotos, políticas de Storage y validación para activar la Carrera |
| — | [`seed_admin.sql`](https://github.com/zdan13l/CarrerApp/blob/main/supabase/seed_admin.sql) | 2026-11-15 | Crea el primer administrador y la Carrera inicial (no es una migración; se corre una vez) |

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

## 0002 — Fotos y validación de la Carrera (pendiente de aplicar)

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

## Plantilla para nuevos registros

```
## 000X — Título (AAAA-MM-DD)
**Qué cambia** …
**Por qué** …
**Verificación** …
**Cómo revertir** …
```
