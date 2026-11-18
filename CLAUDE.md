# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CarreApp is a Spanish-language PWA that runs the live "Carrera" (a points race between groups) of the Pontificia Universidad Javeriana's induction week. Groups of first-years ("neos", who never use the app) move through campus "bases"; at each base two groups compete in 3 items (barra, pregunta, minijuego), 1 point each. Three roles use the app: **admin** (the coordinator), **base** (inductors who staff a base and score it) and **runner** (corredores who walk with a group). UI text is Spanish; code, comments and identifiers are English. The maintainer talks to Claude in Spanish.

Domain vocabulary: Carrera = edition (`events`), grupo = team, base = base, cruce = match, ronda = round, corredor = runner, inductor = base staff, coordinador = admin, neos = the first-years.

## Commands

```bash
npm run dev                      # Vite, frontend only (http://localhost:5173)
npx vercel dev                   # frontend + the /api/* serverless functions
npm run build                    # tsc -b && vite build (also emits the service worker)
npm run lint                     # oxlint (not ESLint). Only errors matter: the repo has many known
                                 # react(set-state-in-effect) / only-export-components warnings
npx tsc -p api/tsconfig.json     # type-check api/*.ts — `tsc -b` does NOT cover api/ or src/sw.ts
npm test                         # Vitest, ~430 tests, ~20 s (see "Tests" below)
npm run test:race                # the simulated Carrera, verbose narrative
npx vitest run tests/db/rules.test.ts -t "tie"   # one file / one test
npm run check                    # tsc -b + lint + api tsc + tests + build
```

There is no CLI migration tooling: SQL is applied by hand in the Supabase SQL Editor (see Conventions).

**Verifying UI without logging in:** `npm run dev` serves a dev-only `/preview/<screen>` page that renders the real components with sample data (`runner`, `runner-ruta`, `runner-top`, `runner-alertas`, `base`, `base-info`, `admin` = En vivo, `admin-carrera`, `admin-forms`, `map`, `logos` = the logo options gallery, plus `base-resultados`, `dialogs`, `sin-carrera`, `sin-carrera-base`). Check at 390 px and 1280 px. `src/pages/Preview.tsx` imports components with concrete props, so changing a component's props means updating it too or `tsc -b` breaks. There are no test credentials; never ask for or type the real admin password.

## Architecture

### The database is the rule engine
Business rules live in Postgres (`supabase/migrations/0001…0020`, applied in order; all applied in production as of 2026-11-18) and are enforced with triggers, constraints and RLS; the client-side checks only exist for UX. Read `docs/wiki/Modelo-de-datos.md` and `Roles-y-permisos.md` before changing behaviour. The rules that shape the code:

- **Scoring:** `match_scores` has one row per (match, item). A winner is required, or `voided = true` (admin only, "item not played"); there are no ties. A base may only INSERT scores for its own matches, in round order (`validate_score`), and cannot edit afterwards; only the admin edits/deletes (every change goes to `score_audit`). Triggers maintain `matches.status` and `finished_at`; `team_standings` is a view that counts points.
- **Schedule:** unique index on the unordered team pair (no repeated matchups per Carrera), a team plays once per round, a base hosts one match per round (`validate_match`, `unique(base_id, round_number)`).
- **Staffing:** one inductor per base and one runner per team per Carrera (0003), one GPS tracker per team, min. 2 runners per team to activate. Activating a Carrera runs `event_problems()` (photos, info, 3 questions, runners…) — only one Carrera is active at a time.
- **Carreras and privacy (0014, 0019, 0020):** only one Carrera is active (`events_single_active`); only a deactivated one can be deleted (`events_delete_guard`); **deactivating resets its progress** (`reset_event_progress`: scores, audit, alerts, locations, arrivals; keeps teams, bases, users, schedule). Each runner/inductor belongs to ONE Carrera (`profiles.event_id`, `my_event_id()`) and reads only that Carrera's rows; **scores (and the `team_standings` view) are readable only by the admin, that base's inductor and the runners of that match** — phones never get other groups' points. A group needs at least 1 user (a pair may share one). Inductors act only on the ACTIVE Carrera (`is_staff_of_match`). `alerts.target` is `groups` or `base` (admin → base alerts ring the inductors; a base cannot target itself; 20 s limit per base).
- **Privacy:** a base's `info` and questions are in `base_details` / `base_questions`, readable only by the admin and that base's inductors (0008). Runners get only name, photo and lat/lng of bases. `team_locations` (GPS) is readable only by the admin and, for its own row, the designated tracker.
- RLS helpers are SECURITY DEFINER functions (`is_admin()`, `is_staff_of_match()`, `is_staff_of_base()`); base arrival goes through the `confirm_arrival()` RPC instead of table writes.

### Roles and routing
`App.tsx` routes `/admin/*` (nested pages inside `AdminLayout`, which provides the `useAdmin()` context: current Carrera, `selectEvent`, `reload`), `/base` and `/corredor`, each wrapped in `RequireRole`. The role comes from `public.profiles`. Login is username + password; `src/lib/username.ts` maps `username` → synthetic email `username@carreapp.test` (never change that domain; typing the full email also works). Users are created/reset/deleted only through `api/users.ts` (service-role key, admin-only). The admin panel has two modes (`AdminLayout` keeps `mode`, follows whether a Carrera is running): **En carrera** (`/admin` = En vivo, Puntajes, Mapa — nothing to create) and **Preparación** (`/admin/carrera` opens with the ordered steps; Grupos, Bases, Usuarios, Cruces — the schedule is hand-made, there is no generator); `docs/wiki/Pantallas.md` records where each piece of information lives and why — update it when moving things.

### Tests
`tests/db/` runs every migration unmodified in in-memory Postgres (PGlite) over Supabase stand-ins (`harness.ts`, `seed.ts`; roles via `asUser`/`asAnon`). `tests/db/race.test.ts` simulates a full Carrera. `tests/static/` parses the client code against the real schema (contract), design rules and docs (every migration must have a `## NNNN — ` section in `Registro-SQL.md`; every env var in `.env.example`). `tests/db/simulacro.test.ts` replays the whole test Carrera (`public/plantillas/carrera-de-prueba.xlsx`) end to end. `TEST_MUTATION_SQL` injects SQL after the migrations to prove a rule's tests fail when it is broken. A new rule → a migration + a test + a Registro-SQL entry. The `carreapp-tester` agent (`.claude/agents/`, tracked in git) runs all of it, invents extra cases, reviews screens and writes `docs/wiki/Informe-de-pruebas.md`.

### Data flow on the client
Pages query Supabase directly with PostgREST embedded selects (e.g. `matches(… bases(…), match_scores(…))`), filtering "my team/base in the active Carrera" with `!inner` embeds. Live updates go through `useRealtimeReload(tables, load)` (`src/lib/realtime.ts`): Realtime events + 20 s polling + refresh on focus/online, because iOS suspends sockets when the phone locks. Tables used with it must be in the `supabase_realtime` publication. One-to-one embeds (`base_details`) may arrive as an object or an array — use `infoOf()`.

### Delay alerts (computed twice — keep both in sync)
A group is "late" when its previous match finished more than the allowed minutes ago and the base has not confirmed arrival for the next one. The allowed time is per leg (`base_travel_times`, from-base → to-base) with `events.max_travel_minutes` as fallback.
- Client: `src/lib/delays.ts` (`lateTeams`) drives the banners and the in-app sound (`src/lib/alerts.ts`, repeats every 30 s; iOS audio needs a tap to unlock).
- Server: `check_delays()` (pg_cron every 30 s, scheduled by `supabase/push_setup.sql`) → `push_send()` → `net.http_post` to `api/push.ts` (secret header) → `web-push` → `src/sw.ts` (custom service worker, `injectManifest`). Only **runners** get sound/push; the admin and bases *send* alerts (`alerts` table; `alerts_push` trigger).
- Delay-related thresholds are duplicated in `lateTeams` and `check_delays()`.

### Other pieces worth knowing
- **Maps:** Mapbox GL is lazy-loaded (`LazyMap` → `MapView`) and excluded from the service-worker precache. The token is URL-restricted, so basemap tiles do not load on localhost (markers still do).
- **Photos:** Supabase Storage bucket `photos`; images are resized to 1000 px in the browser before upload (`src/lib/image.ts`, `storage.ts`).
- **Bulk upload:** `src/lib/bulk.ts` is a pure parser/validator (Word via `mammoth` → HTML tables, Excel via `read-excel-file`, CSV); tables are recognised by their column titles and every section is optional. `pages/admin/BulkImport.tsx` executes it; templates live in `public/plantillas/`.
- **Design system ("Marcador nocturno"):** all colours are CSS variables in `src/index.css` (`:root` dark, `:root[data-theme='light']` light; both must define the same variables; text pairs are contrast-tested); no emojis (Lucide icons, `Crest`/`Avatar` show initials without a photo). Theme in `src/lib/theme.ts` (`ThemeToggle`, saved in localStorage). Logo options in `src/components/logos.tsx` (in use: `brujula`, switch via `LOGO_VARIANT`; icons in `public/` are generated, see Diseno.md). **Pop-ups never use `window.confirm/prompt`**: use `confirmDialog` / `promptDialog` (`src/lib/dialog.ts`, drawn by `DialogHost`). Suggested passwords are silly leet-speak words (`src/lib/password.ts`). See `docs/wiki/Diseno.md`.
- **Phone screens by role:** runner = Ronda / (Ubicación only for the designated GPS user: fixed, non-interactive map) / Ruta / Top (own points + every team by name only); base = Ronda / Resultados (teams by photo+name, no points; history of what it scored with the winner of each item) / Mi base (guide, questions, photo, location; the map only opens to change it). `NoActiveCarrera` is the empty state. Top bars use `AccountMenu` (avatar + name + @user; light/dark and sign out).
- **Notifications:** `src/sw.ts` closes previous notifications and shows each push with a unique tag (so every alert rings); in-app alerts (`useManualAlerts`) show only the newest, ring at once, and remember dismissed ids in localStorage so a reload does not bring them back.
- **Server clock:** delay alerts use `serverNow()` (`src/lib/clock.ts`, `server_now()` RPC), not the phone clock.

### Environment variables
Client (`.env.local`, gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_VAPID_PUBLIC_KEY`. Server only (Vercel): `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_SECRET`. Vercel redeploys on every push to `main` (~15 s); env var changes need a manual Redeploy.

## Conventions that are easy to miss

- **Migrations:** never edit an applied script — add the next `00NN_name.sql` and a row + section in `docs/wiki/Registro-SQL.md` (what changes, why, verification, how to revert). The user applies it by hand, so when pushing code that depends on a new migration, say so: the deploy lands in ~15 s and the app breaks until the SQL runs. If the SQL Editor reports permission/RLS errors, the session role was changed: run `reset role;` first.
- **Commits:** conventional messages (`feat(db):`, `feat:`, `fix:`, `docs(wiki):`, `chore:`), several focused commits per change, and **never add a Co-Authored-By or any attribution line**. Do not commit or push until the user asks.
- **Resume point:** read `docs/wiki/Estado-y-pendientes.md` first (current state, pending list, conventions, environment traps).
- **Third-party skills** (`.claude/skills/`, `.claude/agents/impeccable-*`) are installed but gitignored.
- **Docs:** after each block of work update `docs/wiki/` (`Bitacora.md`, `Registro-SQL.md`, `Home.md` status, and `Roles-y-permisos.md` / `Modelo-de-datos.md` / `Diseno.md` when relevant). The GitHub wiki is published by copying `docs/wiki/*.md` into a clone of `https://github.com/zdan13l/CarreApp.wiki.git` (branch `master`) and pushing. `README.md`'s roadmap is stale; the wiki is the source of truth.
- Developed on Windows with Git Bash: `.gitattributes` forces LF, so CRLF warnings on `git add` are expected.
