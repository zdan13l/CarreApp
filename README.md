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
| 0 | Prueba de red y esqueleto del proyecto (actual) |
| 1 | Modelo de datos y autenticación |
| 2 | Panel de administrador: grupos, bases (con foto del lugar, información que se da en la base y 3 posibles preguntas), corredores y usuarios |
| 3 | Cronograma, rotación y validación de cruces repetidos |
| 4 | Vista de base (calificar enfrentamientos) |
| 5 | Ranking en vivo y vista de corredor |
| 6 | Mapa y GPS |
| 7 | Alertas de demora |
| 8 | Carga masiva desde plantilla |
| 9 | Pruebas y ensayo |

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
