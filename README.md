# CarreApp

Plataforma web para la gestión y seguimiento en tiempo real de la Carrera Javeriana durante las jornadas de inducción. Permite administrar equipos, bases, enfrentamientos, puntuaciones y ubicaciones, ofreciendo un ranking dinámico y actualizado en vivo.

Es una PWA (aplicación web instalable) pensada para que los inductores la usen desde el celular durante la semana de inducción. La interfaz está en español y el código en inglés.

## Tecnologías

Vite + React + TypeScript · vite-plugin-pwa · Supabase (Postgres, Auth, Realtime, Storage) · Vercel.

## Configuración local

```bash
npm install
cp .env.example .env.local   # completa la URL y la anon key de Supabase
npm run dev
```

## Despliegue (Vercel)

Importa el repositorio de GitHub con el preset **Vite** y agrega las variables de entorno
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El archivo `vercel.json` se encarga de las rutas de la SPA.

## Hoja de ruta

| Bloque | Descripción |
|---|---|
| 0–8 | Listos: esqueleto, modelo de datos, panel del coordinador, cronograma, vista de base, ranking y corredor, mapa y GPS, alertas de demora, carga masiva |
| 9 | Pruebas automáticas (`npm test`), agente de pruebas y reorganización de pantallas (listo); falta el simulacro con teléfonos |

El detalle actualizado está en la [wiki](docs/wiki/Home.md).

## Pruebas
`npm test` ejecuta unas 260 pruebas (incluye una Carrera simulada); `npm run check` corre además tipos, lint y build. Ver [Pruebas](docs/wiki/Pruebas.md).

## Base de datos (Supabase)

1. En **SQL Editor** ejecuta completo [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql).
   Crea las tablas, las reglas de negocio (no repetir enfrentamientos, un grupo no puede estar en dos bases
   a la vez, un puntaje por ítem), la auditoría, el ranking y los permisos por rol (RLS).
2. Crea el primer administrador siguiendo [`supabase/seed_admin.sql`](supabase/seed_admin.sql).
3. En Vercel agrega la variable **`SUPABASE_SERVICE_ROLE_KEY`** (solo servidor) para que `api/users.ts`
   pueda crear y eliminar usuarios. Después haz *Redeploy*.

### Inicio de sesión
Los inductores entran con **usuario y contraseña**. Internamente cada usuario es `usuario@carreapp.test`
en Supabase Auth. Solo el coordinador crea, cambia contraseña o elimina usuarios (endpoint `/api/users`).

### Desarrollo local con la API
`npm run dev` solo sirve el frontend. Para probar `/api/users` en local usa `npx vercel dev`.

## Documentación
La documentación completa (arquitectura con diagramas, modelo de datos, registro de SQL, roles y bitácora) está en
[`docs/wiki/`](docs/wiki/Home.md) y se publica en la wiki del repositorio.
