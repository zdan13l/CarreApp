# Informe de pruebas

> **Después de la tercera ejecución se corrigieron los hallazgos P0 1, 2 y 3** (perfil con mala red, alerta por descanso con la migración `0016`, confirmación al activar/desactivar). Después se corrigieron también los P1 y P2 (migración `0017`, ver [Bitácora](Bitacora)). No se tocó: las contraseñas de mínimo 6 caracteres (lo exige Supabase Auth y las plantillas), un límite de intentos en `/api/users` (se apoya en Supabase Auth) y las etiquetas del mapa que se encimen. Queda el simulacro con teléfonos reales y la regla de **no publicar en `main` durante la Carrera** (el mapa no está en el precaché y un teléfono con la versión vieja puede fallar al abrirlo tras una publicación).

Tercera ejecución, 2026-11-15 (revisión crítica antes de la Carrera real: pantallas, código, rendimiento, privacidad). Cada vez que se use el agente `carreapp-tester` este informe se actualiza con la fecha. Las ejecuciones anteriores están resumidas al final.

## Qué se probó
- Puertas estáticas: `npx tsc -b`, `npx tsc -p api/tsconfig.json`, `npm run build` sin errores; `npm run lint` solo con las 8 advertencias conocidas (`set-state-in-effect`), 0 errores.
- **306 pruebas automáticas** (`npm test`, 20 archivos: 290 anteriores + 16 nuevas) y `npm run test:race` (14 pruebas; la Carrera de ensayo cuadra con el conteo independiente).
- Seis roturas deliberadas (`TEST_MUTATION_SQL`), todas **detectadas**: quitar `scores_validate`, `events_validate_activation`, `bases_restrict_staff_update` y `score_audit_event`; abrir `alerts_base_insert`; quitar el requisito de Carrera activa de `is_staff_of_match`.
- **Revisión visual con el navegador** (`/preview/*`, 390 px y 1280 px): `runner`, `runner-ruta`, `runner-top`, `runner-alertas`, `base`, `base-info`, `admin`, `admin-carrera`, `admin-forms`, `map`. Sin desbordamiento horizontal y sin errores de consola salvo el de Mapbox en localhost (esperado: token por URL). Botones, tamaño de letra y contraste medidos con un script.
- Lectura del código de las tres áreas (coordinador, corredor, base), `api/users.ts`, `api/push.ts`, `src/sw.ts`, `realtime.ts`, `auth.tsx` y las políticas de las migraciones 0010 a 0015.
- No se probó con teléfonos reales, ni con credenciales, ni contra Supabase real (no hay credenciales de prueba).

## Pruebas nuevas (16, todas pasan)
- `tests/db/edge.test.ts` (14):
  - un inductor borrado conserva sus puntajes (pero el borrado escribe 3 filas "Corrigió" de ruido en el registro);
  - relevo de inductor y de corredor a mitad de la Carrera (el push va al corredor nuevo);
  - un grupo puede quedar con menos de 2 corredores después de activar (solo lo avisa la lista de pendientes);
  - cambiar de Carrera a mitad de un cruce congela la base; volver permite terminar sin perder datos;
  - bajar o subir el tiempo de traslado en vivo cambia el siguiente `check_delays`;
  - un grupo con demora recibe el push en **cada** revisión (cada 30 s, mismo `tag`);
  - borrar un grupo borra los puntos que sus rivales ganaron contra él;
  - 5 grupos y 2 bases: cada ronda descansa uno y los puntos suman 3 por cruce jugado;
  - los avisos los lee cualquier usuario, incluso de otra Carrera; una base puede poner cualquier `event_id` y mandar 15 avisos seguidos sin límite; una base de una Carrera apagada no puede avisar;
  - **un grupo que descansa una ronda recibe una alarma de demora falsa** (hallazgo 2).
- `tests/unit/delays-edge.test.ts` (2): un teléfono con el reloj 4 min adelantado da una alarma falsa y uno 4 min atrasado esconde una real; el grupo que descansa aparece como "tarde".
- Varias son *caracterizaciones*: documentan lo que pasa hoy; si se mejora a propósito, se actualizan.

## Lo que está bien
- La base de datos impone las reglas (cruces, orden de calificación, una Carrera activa, usuarios por Carrera, auditoría) y las pruebas notan las roturas.
- Visual: nada se desborda a 390 px; los botones principales miden 44 a 56 px; la barra inferior del corredor y de la base es clara; el aviso de demora tiene `role="alert"` y hay foco visible; el mapa se carga bajo demanda.
- Privacidad: la información y las preguntas de las bases, el GPS y la configuración de push están cerrados por RLS; `api/users.ts` valida el rol del llamador en el servidor, revierte el usuario si falla el perfil y no deja eliminarse a uno mismo.
- Tiempo real con red de seguridad (sondeo de 20 s, al volver a primer plano y al reconectar) y un error de red en la primera consulta ya no borra el grupo en `RunnerHome` / `BaseHome`.

## Lo que falló
Ninguna prueba falló. Hallazgos nuevos (los marcados "leído" salen de leer el código; no se pudieron reproducir sin teléfono ni credenciales):

| # | Hallazgo | Dónde | Efecto |
|---|---|---|---|
| 1 | **Si falla la lectura del perfil, el usuario queda sin perfil y no se reintenta** (leído) | `src/lib/auth.tsx` (`fetchProfile` devuelve `null` ante cualquier error y `apply` lo guarda), `RequireRole.tsx` | supabase-js vuelve a emitir `SIGNED_IN` al regresar la app a primer plano. Con mala red el corredor ve "Sin perfil... Avísale al coordinador" y solo puede cerrar sesión; no se corrige solo |
| 2 | **Alarma de demora falsa para el grupo que descansa una ronda** (reproducido: prueba en cliente y en servidor) | `src/lib/delays.ts` y `check_delays()` | El descanso cuenta como caminata: el grupo y sus corredores reciben sonido y push cada 30 s mientras los demás juegan. Pasa con número impar de grupos o con más grupos que 2 × bases |
| 3 | Activar y Desactivar la Carrera no piden confirmación; activar apaga la activa | `Carrera.tsx` (`activate`, `deactivate`) | Un toque mal puesto oculta la Carrera a todos los teléfonos hasta reactivarla |
| 4 | **Tormenta de recargas en En vivo y Mapa por el GPS** | `EnVivo.tsx` y `Mapa.tsx` escuchan `team_locations` y ejecutan la recarga completa (6 y 4 consultas) | ~20 corredores GPS cada 10 s = ~2 eventos/s; con el debounce de 250 ms son unas 20 a 30 consultas por segundo solo del coordinador, el doble con dos pestañas |
| 5 | El reloj del teléfono decide la alarma en pantalla | `lateTeams(…, Date.now())` | Reloj desajustado 4 min = alarma falsa o ausente (prueba). El servidor usa su reloj, así que pantalla y push pueden discrepar |
| 6 | Sin indicador de "sin conexión" ni de "última actualización"; si falla la consulta de `matches` o `team_standings` la lista queda vacía ("El coordinador aún no ha programado tus cruces"); si falla la primera carga se dice "no estás en un grupo" | `RunnerHome.tsx`, `BaseHome.tsx` (`m.data ?? []`, `finally` de la primera carga) | Con mala red el usuario no sabe si ve datos viejos o ninguno |
| 7 | Cerrar sesión es un icono de un toque, sin confirmación, junto a la campana; la suscripción push no se quita al cerrar sesión | `AppShell.tsx`, `lib/push.ts` | Un corredor que se sale sin querer debe escribir usuario y contraseña en plena calle; quien deja el teléfono sigue recibiendo avisos |
| 8 | "Usuario o contraseña incorrectos" también cuando no hay red | `auth.tsx` (`signIn`) | Falso diagnóstico en el campus |
| 9 | Todos los teléfonos recargan a la vez ante cada cambio | `realtime.ts` (debounce fijo de 250 ms) | 60 teléfonos × 3 a 4 consultas en el mismo segundo por cada puntaje; aceptable, pero el pico se puede suavizar con un retraso aleatorio |
| 10 | Avisos: `alerts_read using (true)` (cualquier usuario los lee), una base puede poner cualquier `event_id`, sin límite de envío | `0010`, `0012` (pruebas de caracterización) | Un inductor puede inundar de push a sus corredores; riesgo bajo con personas conocidas |
| 11 | Borrar un usuario que ya calificó escribe filas "Corrigió" falsas en el registro (el `on delete set null` de `awarded_by` se audita) | trigger de `score_audit`, `0001` | Ruido que puede leerse como una corrección del coordinador |
| 12 | Puntajes cambia o borra un puntaje con solo elegir en el `<select>`, sin confirmar | `Puntajes.tsx` (`setScore`) | Un roce corrige un resultado; queda en el registro, pero el ranking se mueve en vivo |
| 13 | `api/push.ts` compara el secreto con `!==` (no en tiempo constante); `api/users.ts` sin límite de intentos y con contraseña mínima de 6 | `api/*.ts` | Riesgo bajo (el secreto es largo y las contraseñas las genera la app); fácil de endurecer |
| 14 | Texto pequeño: 10 px (barra del coordinador, "PUESTO / PTS"), 10.9 px en el menú lateral, 11.5 px en la barra inferior y en el mapa; contraste 4.3:1 en "Por jugar", "VS" y los títulos del menú; etiquetas del mapa que se encimen si dos puntos están cerca; casilla de 22 px | `index.css`, `BottomNav`, `AdminNav`, `MapView` | Difícil de leer al sol; nada bloquea el uso |
| 15 | `/preview/base-info` muestra las preguntas en "Mi base", pero la pantalla real las tiene en la guía de *Ronda* | `Preview.tsx` | La vista previa engaña al revisar |
| 16 | Publicar en pleno evento: `skipWaiting` + `clientsClaim` + `autoUpdate`, y el mapa (`MapView-*`) no está en el precaché | `sw.ts`, `vite.config.ts` | Teléfonos con la versión vieja abierta pueden fallar al abrir el mapa por primera vez (leído; confirmar en un simulacro) |

## Ubicación de la información
- **Mantener:** En vivo / Carrera, las demoras en un solo lugar, la guía de la base en *Ronda*, el registro plegable en Puntajes, el menú móvil de 4 pestañas.
- **Mover / aclarar:** en el menú del coordinador "Preparar" esconde cinco pantallas con un nombre que no dice que ahí están Grupos, Bases, Cruces y Usuarios. En *Carrera*, la carga masiva (se usa una vez) va antes que los tiempos de alerta (se usan en vivo): conviene plegarla cuando la Carrera ya está activa. Mostrar la hora de la última actualización en corredor y base.
- **Nueva sección:** no hace falta. Un buscador en *Usuarios* sí (con 60 o más personas la lista es larga).

## Riesgos para la Carrera real (no los cubre la automatización)
- Sonido y push en iPhone con el teléfono bloqueado (la app no suena en segundo plano; solo el push).
- GPS: iOS suspende la app con la pantalla bloqueada; el corredor designado debe dejarla encendida.
- Red del campus con 60 teléfonos: probar con `/diagnostico` y un simulacro.
- Mapbox con token por URL: probar en el dominio real.
- No publicar en `main` durante la Carrera (se redespliega en 15 s y reemplaza el service worker de todos los teléfonos).
- Plan gratuito de Supabase: conexiones Realtime (límite de 200) y consultas pico; mirar el panel durante el simulacro.

## Recomendaciones
**P0** (antes del día)
- Hallazgo 1: no borrar el perfil si falla la lectura; reintentar y guardar el último perfil en `localStorage`. **S**
- Hallazgo 2: medir la demora solo para el *siguiente* cruce del grupo y desde que terminó la ronda anterior (cliente `delays.ts` + migración `0016` para `check_delays`; las pruebas de caracterización pasan a pruebas de regla). **M**
- Hallazgo 3: confirmación al activar (nombrando la Carrera que se apaga) y al desactivar. **S**
- Simulacro con teléfonos reales (un corredor, una base, un coordinador) con red mala y pantalla bloqueada.

**P1**
- Hallazgo 4: en En vivo y Mapa actualizar solo `positions` con el *payload* de `team_locations`. **S–M**
- Hallazgos 6 y 8: franja "Sin conexión · datos de las 10:32", conservar la lista ante un error, distinguir red de contraseña. **S–M**
- Hallazgo 7: confirmar al cerrar sesión y quitar la suscripción push. **S**
- Hallazgo 5: usar la hora del servidor (cabecera `Date` de la respuesta o un `rpc`) para la demora en pantalla. **S–M**
- Hallazgo 16: congelar los despliegues durante la Carrera y probar el mapa tras una publicación. **S** (proceso)

**P2**
- Hallazgos 9 a 15: retraso aleatorio de 0 a 1.5 s en `useRealtimeReload`; limitar `alerts` a su cruce y a N por minuto (migración); no auditar el `set null` de `awarded_by`; confirmación en Puntajes; `timingSafeEqual`; letra mínima de 12 px; arreglar la vista previa. **S cada uno**
- Buscador en Usuarios; bajar las 8 advertencias del lint con un hook `useLoad` compartido. **M**
- Actualizar el roadmap del `README.md`.

## Segunda ejecución (2026-11-15)
286 pruebas. Usuarios por Carrera (`0014`), cambiar de Carrera, registro de cambios por Carrera. Cuatro roturas deliberadas detectadas. Corregido después: registro de puntajes por Carrera y calificación solo en la Carrera activa (`0015`), el panel del coordinador escucha `events`, un error de red ya no se muestra como "sin Carrera activa", mensaje claro al repetir un usuario, Pantallas.md y la prueba movida a `tests/unit/`. Queda por diseño: los nombres de usuario son únicos entre Carreras. No se revisó el navegador.

## Primera ejecución (Bloque 9, 2026-11-16)
263 pruebas y siete roturas deliberadas; revisión visual de las pantallas y de la ubicación de la información. Se corrigieron: alertas de demora falsas cuando un grupo juega dos rondas seguidas en la misma base (`0013`, ya aplicada), un hueco en la prueba del GPS (INSERT simple), un mapa por tarjeta en Bases (ahora bajo demanda), colores fijos en la ruta del mapa (`cssColor`) y `.env.example` incompleto. Se dividió el panel del coordinador en *En vivo* y *Carrera*, las demoras quedaron en un solo lugar, el corredor movió sus ajustes a la campana y la base unió *Top* y *Terminados* en *Resultados*.
