# Informe de pruebas

Segunda ejecución, 2026-11-15 (después de los usuarios por Carrera, migración `0014`). Cada vez que se use el agente `carreapp-tester` este informe se actualiza con la fecha.

## Qué se probó
- Puertas estáticas: `npx tsc -b`, `npx tsc -p api/tsconfig.json`, `npm run build` sin errores; `npm run lint` solo con las advertencias conocidas.
- **286 pruebas automáticas** (`npm test`, 18 archivos) y `npm run test:race` (Carrera simulada de 6 grupos, 3 bases, 5 rondas: ranking final cuadra con el conteo independiente, 45 registros de puntaje y 1 corrección). Son 20 pruebas nuevas.
- Enfoque de esta ejecución:
  1. Usuarios por Carrera (`profiles.event_id`) en Usuarios, Grupos, Bases, Carga masiva y `api/users.ts`.
  2. Cambiar de Carrera y activar / desactivar: qué ve el coordinador, el corredor y la base, y Realtime sobre `events`.
  3. Registro de cambios de puntajes por Carrera.
  4. Ubicación de la información contra [Pantallas](Pantallas).
- Roturas deliberadas (`TEST_MUTATION_SQL`): quitar el trigger de corredores, abrir una política de `profiles`, abrir la lectura de `score_audit`, sacar `events` de la publicación Realtime. Las cuatro fueron detectadas.
- No se abrió el navegador (revisión estática y por pruebas): las pantallas a 390 px / 1280 px **no se revisaron en esta ejecución**.

## Pruebas nuevas
- `tests/db/carreras.test.ts` (13): un usuario conserva su Carrera al salir de un grupo; al borrar una Carrera sus usuarios quedan libres y otra los adopta; un corredor o inductor no puede cambiar su propia Carrera ni su rol; cada persona ve solo su perfil; "Asignar aquí" del coordinador; solo una Carrera activa; quién ve qué según la Carrera activa (A, ninguna, B); `events` legible y en Realtime; los datos de una Carrera apagada se conservan; el registro de cambios es una tabla global pero cada fila se atribuye a una sola Carrera y es solo del coordinador; las filas de un cruce borrado sobreviven sin cruce.
- `tests/static/carreras.test.ts` (7): Grupos, Bases, Usuarios, Carga masiva y `api/users.ts` se quedan dentro de la Carrera; corredor y base recargan con `events` y piden solo la Carrera activa; Puntajes filtra el registro.

## Lo que está bien
- **La regla de Carrera la impone la base de datos** (triggers de `0014`), no la pantalla: no se puede asignar a alguien de otra Carrera ni siquiera después de sacarlo de un grupo, y asignar a alguien libre lo adopta.
- Las políticas de `profiles` impiden que un corredor se cambie de Carrera o de rol.
- Al activar, desactivar o cambiar de Carrera, el corredor y la base ven su grupo / base solo mientras su Carrera es la activa; con todas apagadas no ven nada. Ambos pantallas escuchan `events` por Realtime (además del sondeo de 20 s).
- Los datos de una Carrera desactivada no cambian y el coordinador los sigue viendo.
- Usuarios muestra los de la Carrera elegida más los coordinadores, y separa a los "Sin Carrera asignada" con *Asignar aquí* / eliminar.
- Las pruebas **detectan** las roturas deliberadas.

## Lo que falló
No hay fallos de las pruebas. Hallazgos de revisión. **Corregidos después de esta ejecución:** 1, 2, 3, 4, 8 y 9 (migración `0015`, `Usuarios.tsx`, `Puntajes.tsx`, `Pantallas.md`, la prueba movida a `tests/unit/`). Quedan 5, 6 y 7.

| # | Hallazgo | Dónde | Efecto |
|---|---|---|---|
| 1 | El registro de cambios pide `score_audit` **global** con `limit(500)` y filtra en el cliente por los cruces de la Carrera | `src/pages/admin/Puntajes.tsx` (`load`) | Al mirar una Carrera **antigua**, si las 500 filas más recientes son de otra Carrera, su registro sale vacío o incompleto. Una Carrera de ensayo con muchas correcciones puede esconder el de la Carrera real |
| 2 | Las filas de auditoría de un cruce borrado se descartan | mismo filtro; `score_audit.match_id` no tiene clave foránea ni Carrera | Al reprogramar (borrar y recrear cruces) se pierde el rastro en pantalla, aunque sigue en la tabla |
| 3 | Nada en la base de datos liga la calificación a `events.is_active` | `validate_score` / `is_staff_of_match` | Un inductor de una Carrera **apagada** podría calificar llamando a la API (la pantalla no se lo ofrece). Documentado con una prueba que describe el comportamiento actual |
| 4 | Usuarios deja crear corredores / inductores cuando no hay ninguna Carrera: nacen "sin Carrera" | `Usuarios.tsx` (`onCreate`, `eventId` nulo) | Aparecen en "Sin Carrera asignada"; confuso pero recuperable |
| 5 | `AdminLayout` carga las Carreras una vez y no escucha `events` | `src/pages/admin/AdminLayout.tsx` | Si hay dos sesiones de coordinador, la otra no ve la activación hasta recargar |
| 6 | El corredor / la base tratan un error de red como "no hay Carrera activa" (`maybeSingle` ignora `error`) | `RunnerHome.tsx`, `BaseHome.tsx` (`load`) | Parpadeo de "sin Carrera" con mala red, que se corrige en el siguiente sondeo |
| 7 | Los nombres de usuario son globales entre Carreras (restricción de Auth) | `BulkImport.tsx` (`loadExisting`) | Reutilizar `corredor1` en una segunda Carrera falla como "ya existe"; hay que usar prefijos |
| 8 | [Pantallas](Pantallas) dice de Usuarios solo "Crear, cambiar contraseña y eliminar" | `docs/wiki/Pantallas.md` | Falta decir que los usuarios son de la Carrera elegida y que existe la sección "Sin Carrera asignada" |
| 9 | `tests/tmp/probe.test.ts` está versionada con un nombre de borrador | `tests/tmp/` | Es útil (lee las plantillas con los lectores del navegador), pero conviene moverla a `tests/unit/` |

## Ubicación de la información
- **Mantener:** la división En vivo / Carrera, las demoras en un solo lugar, la guía de la base dentro de *Ronda*, el registro plegable en Puntajes.
- **Mover / aclarar:** en *Usuarios* mostrar el nombre de la Carrera junto al título (hoy solo en el texto) y, mejor, un aviso si no hay Carrera. La sección "Sin Carrera asignada" es transitoria: cuando ya no queden, no estorba (se oculta sola).
- **Nueva sección:** no hace falta. Cambiar de Carrera vive en el selector del coordinador y afecta a todas las pantallas por igual (comprobado en el código: Grupos, Bases, Puntajes y Carga masiva filtran por `event_id`).

## Riesgos para la Carrera real (no los cubre la automatización)
- Sonido y notificaciones en iPhone con el teléfono bloqueado.
- Precisión del GPS y red del campus; Mapbox con el token restringido por URL (probar en el dominio real).
- Realtime sobre `events` en teléfonos reales: confirmar que al activar la Carrera aparece el grupo sin recargar.
- Datos de ensayo: borrar o dejar desactivadas las Carreras de prueba, y revisar la sección "Sin Carrera asignada" antes del día.
- Pantallas a 390 px / 1280 px no revisadas en esta ejecución.

## Recomendaciones
**P0**
- Simulacro con teléfonos reales (un corredor y una base) activando y desactivando la Carrera para confirmar la actualización inmediata.
- Antes del día: Carrera real activa, ensayo desactivada, y ningún usuario "Sin Carrera".

**P1**
- Hallazgo 1: pedir el registro filtrado en el servidor (o guardar `event_id` en `score_audit`, migración nueva `0015`).
- Hallazgo 3: decidir si calificar en una Carrera apagada debe estar prohibido por la base de datos.
- Hallazgo 4: bloquear la creación de corredores / inductores sin Carrera elegida.

**P2**
- Hallazgos 5, 6, 8 y 9.
- Actualizar el roadmap del `README.md` y volver a correr el agente después de cada bloque.

## Primera ejecución (Bloque 9, 2026-11-16)
263 pruebas y siete roturas deliberadas; revisión visual de las pantallas y de la ubicación de la información. Se corrigieron: alertas de demora falsas cuando un grupo juega dos rondas seguidas en la misma base (`0013`, ya aplicada), un hueco en la prueba del GPS (INSERT simple), un mapa por tarjeta en Bases (ahora bajo demanda), colores fijos en la ruta del mapa (`cssColor`) y `.env.example` incompleto. Se dividió el panel del coordinador en *En vivo* y *Carrera*, las demoras quedaron en un solo lugar, el corredor movió sus ajustes a la campana y la base unió *Top* y *Terminados* en *Resultados*.
