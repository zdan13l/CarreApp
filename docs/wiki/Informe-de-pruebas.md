# Informe de pruebas

Quinta ejecución, 2026-11-18 (panel del coordinador en dos modos, reinicio al desactivar `0020`, notificaciones, ventanas propias, contraseñas chistosas, privacidad de puntajes `0019`, Carrera de prueba con un usuario por grupo). Cada vez que se use el agente `carreapp-tester` este informe se actualiza con la fecha. Las ejecuciones anteriores están resumidas al final.

## Qué se probó
- Puertas estáticas: `npx tsc -b`, `npx tsc -p api/tsconfig.json` y `npm run build` sin errores; `npm run lint`: 0 errores (solo las advertencias conocidas `set-state-in-effect` / `only-export-components`).
- **423 pruebas pasan** (`npm test`, 31 archivos, ~17 s); `npm run test:race`: 14 pruebas, historia correcta (5 rondas, un ítem invalidado, demora de 4 grupos avisada solo a sus corredores, corrección del coordinador, cruce cancelado; ranking final 9-9-7-6-6-4 con empate en el primer puesto y 45 registros de auditoría más 1 corrección).
- **Casos nuevos** en `tests/db/qa-extra.test.ts` (9 pruebas, se conservan): Carrera de 20 grupos y 10 bases (50 cruces, 60 puntos en 20 cruces jugados); un ítem invalidado por el coordinador cambia el ganador y la base no puede invalidar; calificación simultánea del mismo ítem (queda exactamente 1 fila); intentos de subir de rol con sentencias estilo PostgREST (corredor e inductor: cambiar su rol, entrar a una base o un grupo, activar una Carrera, borrar cruces, renombrar grupos, leer auditoría, llamar `reset_event_progress`); 30 avisos simultáneos del coordinador (30 pushes con etiqueta única, cada uno a los 4 corredores); mover un cruce de base a mitad de carrera (el inductor viejo lo pierde, el nuevo lo puede confirmar, la doble reserva se rechaza); finalizar destruye la clasificación final; desactivar una Carrera no toca otra; un usuario nuevo tras el reinicio funciona al reactivar.
- **10 roturas deliberadas** (`TEST_MUTATION_SQL` sobre `tests/db`), todas **detectadas**: quitar el trigger de reinicio `0020` (3 fallos), abrir `scores_read` (1), quitar `events_single_active` (4), quitar `scores_validate` (18), abrir `base_details_read` (6), quitar `events_delete_guard` (3), abrir `alerts_base_insert` (5), quitar `matches_validate` (2), abrir el INSERT del GPS (2) y anular `reset_event_progress` (5). Ninguna regla probada pasa inadvertida.
- **Pantallas**: `npm run dev`, 14 vistas previas (`runner`, `runner-ruta`, `runner-top`, `runner-alertas`, `base`, `base-info`, `base-resultados`, `admin`, `admin-carrera`, `admin-forms`, `map`, `dialogs`, `sin-carrera`, `sin-carrera-base`) a 390 y 1440 px, en claro y oscuro (56 combinaciones, cargadas en iframes y medidas con script: desbordamiento horizontal, elementos fuera del ancho, objetivos táctiles menores de 36 px, tema aplicado) más una captura de `admin` en el visor. Servidor detenido; clave de tema borrada.
- No se probó con teléfonos reales, ni contra Supabase real, ni con credenciales. No se midió contraste real esta vez (lo cubre `tests/static/theme-contrast.test.ts`); tampoco se revisó cada captura a ojo (solo `admin`).

## Lo que está bien
- Todas las reglas de la base de datos de los últimos bloques están cubiertas y las roturas se detectan: un solo activo, borrado solo desactivada, reinicio al desactivar (y solo de esa Carrera), puntajes legibles solo por coordinador / inductor de la base / corredores del cruce, avisos a la base, un usuario por grupo.
- Sin desbordamiento horizontal del documento en ninguna de las 56 combinaciones; el tema (claro/oscuro) se aplica en todas. `admin` (En vivo) se ve ordenado: indicadores, ronda, demoras, top 3.
- La escala grande (20 grupos) y la concurrencia no rompen reglas; el borrado de una Carrera ya no deja filas huérfanas de auditoría (`ORPHAN_AUDIT_ROWS = 0`, `0019`).

## Lo que falló
No hay fallos de reglas ni pantallas rotas. Hallazgos menores:

| # | Hallazgo | Reproducción / causa | Gravedad |
|---|---|---|---|
| 1 | **Finalizar la Carrera borra la clasificación final y no hay forma de exportarla antes** | `tests/db/qa-extra.test.ts` > "finishing the Carrera destroys the final standings". `EnVivo.tsx` `finish()` pide confirmación (bien redactada) pero no ofrece descargar el ranking; en `src/` solo `BulkImport.tsx` tiene descargas | **Corregido el 2026-11-18**: finalizar y desactivar descargan antes un CSV de resultados (`src/lib/results.ts`), y hay *Descargar resultados* en En vivo y Puntajes. P1 (un toque equivocado o un cierre sin captura pierde el resultado oficial; es el diseño de `0020`) |
| 2 | Casillas de verificación de 22x22 px en `admin-carrera` (390 y 1440 px) | Medido con script; solo del coordinador | P2 |
| 3 | `admin-forms` a 390 px: la tabla `data-table` sobrepasa el ancho de la pantalla (el documento no desborda, desplaza dentro de su contenedor) | Medido con script | P2 (solo coordinador) |
| 4 | Enlace "Mapbox" del mapa de 88x23 px | De la librería, `/preview/map` | P2, no es de la app |
| 5 | `CLAUDE.md` dice "~260 tests" (ya son 423) y su lista de vistas previas no incluye `base-resultados`, `dialogs`, `sin-carrera`, `sin-carrera-base` | `CLAUDE.md` | P2 (documentación) |
| 6 | Las tablas `matches`, `teams`, `bases` las lee cualquier usuario autenticado de cualquier Carrera (hallazgo de la ejecución anterior, sin cambios) | prueba de caracterización en `tests/db/permissions.test.ts` | P2, bajo |

## Lo que no convence
- `reset_event_progress` también borra `score_audit` de esa Carrera: tras finalizar no queda rastro de quién corrigió qué.
- El mapa de la vista previa superpone etiquetas si dos grupos están cerca (conocido); las teselas de Mapbox no cargan en localhost (esperado).

## Ubicación de la información
- **En carrera** (En vivo, Puntajes, Mapa) y **Preparación** (pasos, Grupos, Bases, Usuarios, Cruces) separan bien lo que se usa cada minuto de lo que se usa una vez; mantener.
- *Finalizar Carrera* está junto al estado en *En vivo*, que se mira todo el día: es un botón de uso único y destructivo en la zona más consultada. Opción: moverlo al final de *Puntajes*, junto a una exportación del resultado.
- Corredor (Ronda / Ruta / Top) y base (Ronda / Resultados / Mi base): sin cambios necesarios; el Top del corredor muestra solo nombres de los demás, coherente con `0019`.

## Riesgos para la Carrera real (siguen necesitando teléfonos)
- Sonido y push en iPhone con la pantalla bloqueada; varias notificaciones seguidas (cada una con etiqueta única) sin que iOS las agrupe o silencie.
- GPS real del usuario designado (iOS suspende con la pantalla apagada) y precisión en el campus.
- Red de la Javeriana con ~60 teléfonos y Realtime/polling cada 20 s; los 30 avisos simultáneos de la prueba cubren solo la base de datos.
- Mapbox con token por URL y teselas reales, brillo al sol del tema claro, márgenes seguros del iPhone.
- Publicar en `main` durante la Carrera (el mapa no está en el precaché).
- Pulsar "Finalizar" por error o antes de anotar el resultado (hallazgo 1).

## Recomendaciones
**P0:** ninguna nueva; sigue pendiente el simulacro con teléfonos ([Prueba en vivo](Prueba-en-vivo)).

**P1**
- Hallazgo 1: antes de reiniciar, ofrecer "Descargar resultado" (CSV con puesto, grupo y puntos) en el diálogo de *Finalizar* y/o en *Puntajes*; o una migración que conserve un resumen al desactivar. **M**

**P2**
- Casillas y tabla de `admin-carrera` / `admin-forms` (hallazgos 2 y 3). **S**
- Actualizar `CLAUDE.md` (conteo de pruebas y lista de vistas previas). **S**
- Hallazgo 6: acotar la lectura de `matches`/`teams`/`bases` o documentarlo. **M**

## Cuarta ejecución (2026-11-16)
375 pruebas, simulacro en código de la Carrera de prueba, claro/oscuro, Eliminar Carrera y `0017`. Hallazgos entonces: filas huérfanas de auditoría al eliminar una Carrera (corregido en `0019`), contraste del texto de estado verde en claro y de `--text-muted` sobre la opción dorada (lista `KNOWN_BELOW_AA` en `theme-contrast.test.ts`, sigue por revisar), lectura abierta de `matches`/`teams`/`bases`, falta la zona "Eliminar" en la vista previa, error genérico al inductor con la Carrera apagada.

## Tercera ejecución (2026-11-15)
306 pruebas, seis roturas deliberadas detectadas y revisión visual a 390 y 1280 px. Hallazgos corregidos después: perfil con mala red, alerta falsa por descanso (`0016`), confirmación al activar/desactivar y los P1 y P2 (`0017`: `server_now()`, avisos con lectura acotada y límite de 20 s, auditoría sin ruido). No se tocó: contraseñas de mínimo 6 caracteres y un límite de intentos en `/api/users`. Quedó pendiente el simulacro con teléfonos y la regla de no publicar en `main` durante la Carrera.

## Segunda ejecución (2026-11-15)
286 pruebas. Usuarios por Carrera (`0014`), cambiar de Carrera, registro de cambios por Carrera. Cuatro roturas deliberadas detectadas. Corregido después: registro de puntajes por Carrera y calificación solo en la Carrera activa (`0015`), el panel del coordinador escucha `events`, un error de red ya no se muestra como "sin Carrera activa", mensaje claro al repetir un usuario, Pantallas.md y la prueba movida a `tests/unit/`. Queda por diseño: los nombres de usuario son únicos entre Carreras. No se revisó el navegador.

## Primera ejecución (Bloque 9, 2026-11-16)
263 pruebas y siete roturas deliberadas; revisión visual de las pantallas y de la ubicación de la información. Se corrigieron: alertas de demora falsas cuando un grupo juega dos rondas seguidas en la misma base (`0013`, ya aplicada), un hueco en la prueba del GPS (INSERT simple), un mapa por tarjeta en Bases (ahora bajo demanda), colores fijos en la ruta del mapa (`cssColor`) y `.env.example` incompleto. Se dividió el panel del coordinador en *En vivo* y *Carrera*, las demoras quedaron en un solo lugar, el corredor movió sus ajustes a la campana y la base unió *Top* y *Terminados* en *Resultados*.
