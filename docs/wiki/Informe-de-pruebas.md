# Informe de pruebas

Cuarta ejecución, 2026-11-16 (simulacro de la Carrera de prueba en código, modo claro/oscuro, Eliminar Carrera, migración `0017`, ocultar posiciones viejas). Cada vez que se use el agente `carreapp-tester` este informe se actualiza con la fecha. Las ejecuciones anteriores están resumidas al final.

## Qué se probó
- Puertas estáticas: `npx tsc -b`, `npx tsc -p api/tsconfig.json` y `npm run build` sin errores; `npm run lint`: 0 errores y 22 advertencias de los mismos tipos de siempre (`set-state-in-effect`, `only-export-components`, `exhaustive-deps`), ninguna en archivos nuevos.
- **375 pruebas automáticas pasan** (`npm test`, 23 archivos) más **1 "fallo esperado"** (`it.fails`, el defecto 1 de abajo); `npm run test:race`: 14 pruebas.
- **Simulacro en código** (`tests/db/simulacro.test.ts`, 39 pruebas; `npx vitest run tests/db/simulacro.test.ts --reporter=verbose` cuenta la historia). Carga el archivo real `public/plantillas/carrera-de-prueba.xlsx` con el mismo código de la app (`readTablesFromFile` + `parseTables` + `validateFile`), repite paso a paso lo que hace `BulkImport.tsx` contra la base en memoria (Carrera, 6 grupos, 3 bases con información, 3 preguntas y coordenadas, 15 usuarios con `event_id` como `api/users.ts`, GPS, asignaciones, 15 cruces, 6 tiempos, 8 min general) y recorre `Prueba-en-vivo.md` como cada rol con RLS:
  - activación bloqueada sin las 9 fotos y con otra Carrera activa; luego activa;
  - 5 rondas con inductores (llegada y 3 ítems), un ítem invalidado por el coordinador (el inductor no puede), una corrección del coordinador (la base no puede), un cruce cancelado;
  - un grupo lento con tiempos por tramo (3 a 5 min contra 8 general): a los 4 min 20 s solo Vikingos y Dioses Nórdicos (tramo de 4 min) reciben push y **solo sus 4 corredores**; con 8 min general nadie; los grupos que repiten base (Samuráis, Guerreros Aztecas) y el que descansa (en una transacción que se revierte) nunca; pantalla (`lateTeams`) y servidor (`check_delays`) coinciden con un modelo escrito a mano;
  - avisos manuales del coordinador (sin límite) y de una base (1 cada 20 s por cruce; el segundo se rechaza y no genera push; otra base no se bloquea);
  - GPS de los 6 corredores designados; ni el segundo corredor ni otro grupo escribe; una posición de 61 min se oculta (`isLocationFresh`, con límites exactos);
  - privacidad (el corredor no lee información, preguntas, GPS ajeno ni auditoría; la llave pública no lee nada), intentos de subir de rol, desactivar a mitad de la Carrera (el inductor no puede confirmar ni calificar, no hay alertas) y reactivar;
  - ranking final contra un conteo independiente (41 puntos = 45 menos 4 invalidados) y 45 filas de auditoría más 1 corrección;
  - **Eliminar Carrera** igual que `DeleteEvent` (listar perfiles, borrar la Carrera, borrar los usuarios): todas las tablas vuelven a su estado previo (salvo el defecto 1), la otra Carrera y el coordinador quedan intactos y el mismo archivo se puede volver a cargar;
  - **cargar el mismo archivo dos veces**: la vista previa marca los 15 usuarios y el botón queda bloqueado; forzando la carga, cada usuario falla con "Ese usuario ya existe", los 15 cruces se rechazan y ninguna tabla cambia.
- 2 roturas deliberadas sobre el simulacro (`TEST_MUTATION_SQL`), ambas **detectadas**: quitar `alerts_rate_limit` y quitar `events_validate_activation` (una tercera tenía el nombre de la política mal escrito y no se aplicó: no cuenta).
- Pruebas nuevas fuera del simulacro: `tests/static/theme-contrast.test.ts` (contraste real de los pares de color, claro y oscuro, incluidas las cajas teñidas con `color-mix`) y `tests/unit/theme.test.ts` (tema por defecto, guardado, valor corrupto, almacenamiento bloqueado).
- **Revisión visual** con `npm run dev` y `/preview/*` más `/login`, a 390 y 1280 px, en tema claro y oscuro (`localStorage 'carreapp.theme'`), con un script que mide desbordamiento, contraste real calculado y objetivos táctiles. Se restauró el visor, se apagó el servidor y se borró la clave del tema.
- No se probó con teléfonos reales, ni contra Supabase real, ni con credenciales.

## Lo que está bien
- El simulacro entero pasa en reglas: carga, activación, rondas, demoras por tramo, avisos, GPS, privacidad, ranking y borrado. El borrado de la Carrera es completo salvo el defecto 1.
- Modo claro: sin desbordamiento horizontal en ninguna pantalla a 390 ni a 1280 px; en oscuro **cero** pares de texto bajo 4.5:1; botones, login y barras se ven bien en ambos temas. El tema se guarda, no falla con el almacenamiento bloqueado, se aplica antes del primer pintado y el mapa lo sigue.
- Las alertas por tramo, repetir base y descansar se comportan igual en pantalla y servidor.

## Lo que falló
| # | Hallazgo | Reproducción / causa | Gravedad |
|---|---|---|---|
| 1 | **Eliminar una Carrera deja 45 filas huérfanas en `score_audit`** (una "delete" por cada puntaje, con `event_id` nulo, que ninguna Carrera puede borrar después) | `tests/db/simulacro.test.ts` > "KNOWN DEFECT" (`it.fails`). El borrado en cascada de `matches` borra `match_scores`; el trigger `after_score_change` escribe una fila "delete" cuando el cruce ya no existe, así que `audit_set_event()` no encuentra la Carrera | P1: solo basura en el registro, pero rompe la promesa "no queda nada" |
| 2 | **Modo claro: el texto de estado verde (`badge ok`, `chip.win`) queda entre 3.7 y 4.4:1 sobre su caja teñida** (`En juego` 3.74, `2–1 Ganaron` 3.90, `Activa` 4.04, `Terminado` 4.34); también las iniciales del `crest` (4.39), `--gold-ink` y `--text-faint` sobre `--surface-3` (4.4) y los avisos teñidos de ok/warn/danger | Medido en el navegador y reproducido en `theme-contrast.test.ts` (lista `KNOWN_BELOW_AA`, 24 pares). Texto de 12 px en negrita | P2 |
| 3 | Modo oscuro: `--text-muted` sobre la opción dorada seleccionada al 22 % da 4.12:1 | `theme-contrast.test.ts` | P2 |
| 4 | Las tablas `matches`, `teams`, `bases`, `match_scores` las lee cualquier usuario autenticado, también de otra Carrera o inactiva (`using (true)`): "dejan de ver la Carrera" es un filtro del teléfono, no de la base de datos | Prueba "a runner sees the Carrera…" (caracterización). Lo privado (información, preguntas, GPS, auditoría, avisos de otras Carreras) sí está cerrado | P2, bajo (nada sensible) |
| 5 | La vista previa `/preview/admin-carrera` no muestra la zona "Eliminar esta Carrera" | `Preview.tsx` | P2: no se pudo revisar visualmente en claro/oscuro |
| 6 | Con la Carrera desactivada, el inductor recibe un error genérico de permisos al confirmar o calificar | Simulacro, "switching the Carrera off mid-race" | P2 |

## Lo que no convence
- `DeleteEvent` solo bloquea borrar una Carrera activa en la pantalla; la base de datos la borraría (caracterizado en el simulacro). Un cliente viejo o un `delete` a mano lo evita.
- El mapa de la vista previa superpone las etiquetas cuando dos grupos están cerca (conocido).
- Los controles de zoom de Mapbox miden 32x48 px (de la librería, no de la app).
- Errores de teselas de Mapbox en la consola en localhost (token por URL): esperado.

## Ubicación de la información
Sin cambios respecto a la tercera ejecución. *Eliminar esta Carrera* al final de *Carrera* (zona de peligro, solo aparece desactivada) está bien ubicada: se usa una vez, al terminar.

## Riesgos para la Carrera real (siguen necesitando teléfonos)
- Sonido y push en iPhone con la pantalla bloqueada, instalación de la PWA y permisos.
- GPS real (iOS suspende con la pantalla apagada) y precisión en el campus.
- Red de la Javeriana con ~60 teléfonos y Realtime en el plan gratuito; 6 corredores GPS cada 10 s.
- Mapbox con token por URL, mapa claro/oscuro con teselas reales y brillo al sol.
- Tema claro al sol: la lectura real de los chips de estado.
- Publicar en `main` durante el evento (service worker).

## Recomendaciones
**P0:** ninguna nueva; falta el simulacro con teléfonos reales ([Prueba en vivo](Prueba-en-vivo)).

**P1**
- Hallazgo 1: migración `0018` que no audite el borrado en cascada (en `after_score_change`: `if tg_op = 'DELETE' and not exists (select 1 from public.matches where id = old.match_id) then return null; end if;`) y borre las filas huérfanas existentes; al arreglarlo, quitar `.fails` y poner `ORPHAN_AUDIT_ROWS = 0` en el simulacro. **S**

**P2**
- Hallazgos 2 y 3: ajustar `--ok`, `--warn`, `--danger`, `--gold-ink`, `--text-faint` (claro) y el 22 % de la opción dorada (oscuro) y vaciar `KNOWN_BELOW_AA`. **S**
- Hallazgo 4: acotar `matches`/`teams`/`bases` a la Carrera activa para quien no es coordinador, o documentarlo en Roles y permisos. **M**
- Hallazgo 5: añadir la zona de eliminar a `/preview/admin-carrera`. **S**
- Hallazgo 6 y `DeleteEvent`: mensaje claro al inductor ("la Carrera no está activa") y un trigger que impida borrar una Carrera activa. **S**

## Tercera ejecución (2026-11-15)
306 pruebas, seis roturas deliberadas detectadas y revisión visual a 390 y 1280 px. Hallazgos corregidos después: perfil con mala red, alerta falsa por descanso (`0016`), confirmación al activar/desactivar y los P1 y P2 (`0017`: `server_now()`, avisos con lectura acotada y límite de 20 s, auditoría sin ruido). No se tocó: contraseñas de mínimo 6 caracteres y un límite de intentos en `/api/users`. Quedó pendiente el simulacro con teléfonos y la regla de no publicar en `main` durante la Carrera.

## Segunda ejecución (2026-11-15)
286 pruebas. Usuarios por Carrera (`0014`), cambiar de Carrera, registro de cambios por Carrera. Cuatro roturas deliberadas detectadas. Corregido después: registro de puntajes por Carrera y calificación solo en la Carrera activa (`0015`), el panel del coordinador escucha `events`, un error de red ya no se muestra como "sin Carrera activa", mensaje claro al repetir un usuario, Pantallas.md y la prueba movida a `tests/unit/`. Queda por diseño: los nombres de usuario son únicos entre Carreras. No se revisó el navegador.

## Primera ejecución (Bloque 9, 2026-11-16)
263 pruebas y siete roturas deliberadas; revisión visual de las pantallas y de la ubicación de la información. Se corrigieron: alertas de demora falsas cuando un grupo juega dos rondas seguidas en la misma base (`0013`, ya aplicada), un hueco en la prueba del GPS (INSERT simple), un mapa por tarjeta en Bases (ahora bajo demanda), colores fijos en la ruta del mapa (`cssColor`) y `.env.example` incompleto. Se dividió el panel del coordinador en *En vivo* y *Carrera*, las demoras quedaron en un solo lugar, el corredor movió sus ajustes a la campana y la base unió *Top* y *Terminados* en *Resultados*.
