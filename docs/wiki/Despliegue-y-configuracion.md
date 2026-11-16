# Despliegue y configuración

## Servicios
| Servicio | Para qué | Plan | Dónde |
|---|---|---|---|
| GitHub | Código y wiki | Gratis | `zdan13l/CarreApp` |
| Vercel | Hosting de la PWA y de `/api/users` | Gratis (Hobby) | Proyecto `carreapp` · https://carreapp.vercel.app |
| Supabase | Base de datos, login, tiempo real y fotos | Gratis | Proyecto `CarrerApp` |

Costo total: **$0**. Límites relevantes del plan gratuito de Supabase: la base se **pausa tras 7 días sin actividad** (se reactiva con un clic en el panel) y hay un tope de conexiones de tiempo real simultáneas, muy por encima de los ~60 inductores.

## Despliegue
**Automático:** cada `push` a la rama `main` despliega en Vercel (unos 15 segundos). No hay pasos manuales.

## Variables de entorno
| Variable | Dónde | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel y `.env.local` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Vercel y `.env.local` | Clave pública (protegida por RLS) |
| `VITE_MAPBOX_TOKEN` | Vercel y `.env.local` | Token **público** de Mapbox (`pk.*`) para el mapa 3D y las rutas a pie. En Mapbox > Access tokens, restringirlo a la URL de la app |
| `VITE_VAPID_PUBLIC_KEY` | Vercel y `.env.local` | Clave **pública** de las notificaciones push (la app la usa para suscribir cada teléfono) |
| `VAPID_PUBLIC_KEY` | **Solo Vercel** | La misma clave pública, para el envío |
| `VAPID_PRIVATE_KEY` | **Solo Vercel** | Clave **secreta** de las notificaciones push. Nunca en el repo ni en el chat |
| `VAPID_SUBJECT` | **Solo Vercel** | Contacto del envío: la dirección de la app (`https://carreapp.vercel.app`) |
| `PUSH_SECRET` | **Solo Vercel** | Clave inventada que comparten Vercel y la base de datos para autorizar los envíos |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo Vercel** | Clave secreta para `/api/users` (crear/eliminar usuarios) |

> Después de cambiar variables en Vercel hay que hacer **Redeploy** para que apliquen.

## Preparar una Carrera nueva (resumen para el próximo coordinador)
1. Entrar a la app como admin.
2. Crear la Carrera (edición) y marcarla como activa.
3. Cargar usuarios con la **plantilla de Word o Excel** (Usuarios > Cargar desde un archivo), que también crea los grupos y bases con sus asignaciones; después, a cada grupo agregarle la foto y a cada base la foto, la información y las 3 preguntas.
4. Armar los cruces; la app avisa si algo se repite o choca (Bloque 3).
5. Hacer un simulacro antes del evento (Bloque 9).

## Primer arranque desde cero (ya hecho, para referencia)
1. Crear proyecto en Supabase y ejecutar [`0001_initial_schema.sql`](Registro-SQL).
2. En Supabase > Authentication > Users, crear `admin@carreapp.test` con contraseña y *Auto Confirm User*, y ejecutar `supabase/seed_admin.sql`.
3. Importar el repo en Vercel (preset Vite) con las variables de entorno.

## Desarrollo local
```bash
npm install
cp .env.example .env.local     # completar URL y anon key
npm run dev                    # solo el frontend
npx vercel dev                 # frontend + /api/users
npm run build && npm run lint
```

## Instalación en iPhone (para los inductores)
1. Abrir la URL en **Safari** (no Chrome).
2. Compartir → **Agregar a pantalla de inicio**.
3. Abrir CarreApp desde el icono. Las notificaciones solo funcionan con la app instalada (iOS 16.4+).
4. El corredor designado debe dejar la app abierta con la pantalla activa para transmitir el GPS.

## Pruebas de red
La ruta `/diagnostico` comprueba conectividad con el hosting, Supabase y el mapa, y permite probar instalación, notificaciones y ubicación. Se usó para confirmar que la red de la Javeriana (wifi y datos móviles) alcanza todos los servicios.

## Activar las notificaciones push
Para que las alertas lleguen con el teléfono bloqueado o la app cerrada (una sola vez por Carrera):
1. Generar las claves: `npx web-push generate-vapid-keys` (imprime una clave pública y una privada).
2. En Vercel > Settings > Environment Variables agregar: `VAPID_PUBLIC_KEY` y `VITE_VAPID_PUBLIC_KEY` (la pública, las dos iguales), `VAPID_PRIVATE_KEY` (la privada), `VAPID_SUBJECT` (`https://carreapp.vercel.app`) y `PUSH_SECRET` (cualquier texto largo inventado). Luego **Redeploy**.
3. En Supabase > SQL Editor ejecutar [`0011_push_and_travel_times.sql`](Registro-SQL) y después `supabase/push_setup.sql`, cambiando en este último `REEMPLAZA-POR-TU-CLAVE` por el valor de `PUSH_SECRET`.
4. Solo los **corredores** abren la app, entran y pulsan **Activar notificaciones** (en iPhone, desde la app instalada en la pantalla de inicio).

Para apagarlas: `select cron.unschedule(jobid) from cron.job where jobname = 'check-delays';`
