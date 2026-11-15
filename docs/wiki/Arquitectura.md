# Arquitectura

## Componentes

```mermaid
flowchart LR
  subgraph Cliente["Celular / computador (PWA instalable)"]
    UI["Vite + React + TypeScript\nvistas: admin · base · corredor"]
    SW["Service worker\n(vite-plugin-pwa)"]
  end

  subgraph Vercel["Vercel (hosting gratuito)"]
    Static["Archivos estáticos\ncarreapp.vercel.app"]
    API["Función serverless\n/api/users"]
  end

  subgraph Supabase["Supabase (plan gratuito)"]
    Auth["Auth\nusuario + contraseña"]
    DB[("Postgres\ntablas + RLS + triggers")]
    RT["Realtime\nranking en vivo"]
    Storage["Storage\nfotos (Bloque 2)"]
  end

  UI -- "carga la app" --> Static
  UI -- "login, consultas, puntajes\n(clave anon + permisos RLS)" --> Auth
  UI --> DB
  RT -- "cambios en vivo" --> UI
  DB --> RT
  UI -- "crear / borrar usuarios\n(token del admin)" --> API
  API -- "clave service_role\n(solo servidor)" --> Auth
  API --> DB
```

## Por qué hay una función serverless
Crear o borrar usuarios requiere la clave **`service_role`** de Supabase, que da acceso total y **nunca debe llegar al navegador**. Por eso esa operación vive en `api/users.ts` (Vercel): la función verifica que quien llama sea **admin** y recién ahí usa la clave.

## Inicio de sesión
Supabase Auth exige correo, pero los inductores entran con **usuario y contraseña**. Cada usuario se guarda como `usuario@carreapp.test` (dominio reservado que no existe) y la app lo convierte automáticamente.

```mermaid
sequenceDiagram
  actor U as Inductor
  participant App as PWA
  participant Auth as Supabase Auth
  participant DB as Postgres (profiles)
  U->>App: usuario + contraseña
  App->>Auth: signIn(usuario@carreapp.test, contraseña)
  Auth-->>App: sesión (JWT)
  App->>DB: select profile where id = auth.uid()
  DB-->>App: rol (admin | base | runner)
  App->>U: redirige a /admin, /base o /corredor
```

## Crear un usuario (solo admin)

```mermaid
sequenceDiagram
  actor A as Coordinador
  participant App as PWA (panel admin)
  participant API as /api/users (Vercel)
  participant Auth as Supabase Auth
  participant DB as Postgres
  A->>App: nuevo usuario (usuario, nombre, rol, contraseña)
  App->>API: POST + token del coordinador
  API->>Auth: ¿el token es válido?
  API->>DB: ¿su perfil tiene rol admin?
  API->>Auth: createUser (service_role)
  API->>DB: insert profile
  alt falla el perfil
    API->>Auth: deleteUser (deshacer)
  end
  API-->>App: usuario creado
```

## Puntuar un enfrentamiento (base)

```mermaid
sequenceDiagram
  actor B as Inductor de base
  participant App as PWA
  participant DB as Postgres
  participant RT as Realtime
  actor R as Corredores
  B->>App: ganador de "barra" / "pregunta" / "minijuego"
  App->>DB: insert match_scores
  DB->>DB: RLS: ¿es base de ESTE cruce?
  DB->>DB: trigger: ¿ganador es uno de los dos grupos?
  DB->>DB: trigger: auditoría + estado del cruce
  DB->>RT: cambio
  RT-->>R: ranking actualizado
```

## Estructura del repositorio

```
api/                      Funciones serverless (Vercel)
  users.ts                Crear / cambiar contraseña / eliminar usuarios
src/
  lib/                    Cliente Supabase, autenticación, utilidades
  components/             RequireRole (guard de rutas), AppShell
  pages/                  Login, AdminHome, BaseHome, RunnerHome, NetworkCheck
supabase/
  migrations/             Scripts SQL numerados (ver Registro SQL)
  seed_admin.sql          Crea el primer administrador
docs/wiki/                Fuente de esta wiki (se sincroniza con la wiki de GitHub)
```
