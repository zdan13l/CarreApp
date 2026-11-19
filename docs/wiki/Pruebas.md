# Pruebas

CarreApp tiene una suite de pruebas automáticas que **simula una Carrera completa** y revisa las reglas, los permisos, las funciones del servidor y la coherencia entre la app y la base de datos. Cada cambio debería dejarla en verde antes de publicarse.

## Cómo correrla
```bash
npm test                     # todo (unos 12 segundos)
npm run test:race            # la Carrera simulada, contando lo que pasa ronda por ronda
npx vitest run tests/db/rules.test.ts -t "tie"    # un archivo o una prueba
npm run check                # tsc + lint + funciones del servidor + pruebas + build
```

## Qué cubre
| Carpeta | Qué prueba |
|---|---|
| `tests/db/` | Una base **Postgres en memoria** (PGlite) con **todas las migraciones sin tocar**, usada igual que Supabase: como superusuario, como usuario autenticado (con RLS) y como clave pública. |
| `tests/db/rules` | Lo que debe ser imposible: cruces repetidos, un grupo en dos bases, ganador fuera del cruce, empates, ítems duplicados, activar una Carrera incompleta, calificar fuera de orden… |
| `tests/db/permissions` | Quién lee y escribe qué (la matriz de [Roles y permisos](Roles-y-permisos)): privacidad de la información de las bases, GPS, avisos, suscripciones, fotos. |
| `tests/db/alerts` | Las alertas de demora en el servidor (`check_delays`, avisos manuales) y su **paridad con el cálculo de la app**. |
| `tests/db/generator` | El generador de cronograma acepta cualquier tamaño (2 a 20 grupos) y respeta todas las reglas. |
| `tests/db/race` | **La Carrera de ensayo**: 6 grupos, 3 bases, 5 rondas, con ítems invalidados, una corrección, un cruce cancelado, una demora, avisos y GPS; al final compara el ranking con un conteo independiente. |
| `tests/db/simulacro` | **El simulacro en código** de [Prueba en vivo](Prueba-en-vivo): carga el archivo real `carrera-de-prueba.xlsx` con el mismo código de la app, repite lo que hace *Cargar la Carrera desde un archivo* y recorre la lista de comprobación como cada rol (activación con fotos, 5 rondas, demora por tramo, avisos con límite de 20 s, GPS, privacidad), borra la Carrera como *Eliminar esta Carrera* y comprueba que no queda nada; también que cargar el mismo archivo dos veces falla sin dañar nada. Cuenta la historia con `npx vitest run tests/db/simulacro.test.ts --reporter=verbose`. |
| `tests/db/edge` | Casos de un día real: personas que salen o se reemplazan, cambiar de Carrera a mitad de un cruce, subir o bajar el tiempo de traslado en vivo, borrar un grupo, número impar de grupos, grupos que descansan una ronda, y la privacidad / abuso de la tabla de avisos. Varias son *caracterizaciones* (documentan lo que pasa hoy). |
| `tests/api/` | Las funciones del servidor (`/api/users`, `/api/push`): autorización, validación, reversas y errores legibles. |
| `tests/db/qa-extra` y `tests/db/qa-visa-privacy` | Casos que inventa el tester: Carrera de 20 grupos, calificación simultánea, escalada de rol, 30 avisos a la vez, base movida a mitad de carrera, reinicio al desactivar; y, en la sexta ejecución, `team_contacts()` para usuarios sin Carrera o con usuario compartido, lo que un inductor lee de *otra* base de su misma Carrera, quién confirma la llegada (idempotente), el orden de rondas con ítems invalidados y 5 grupos (número impar). |
| `tests/unit/` | Lógica pura: cronograma, demoras (incluye reloj del teléfono y grupo que descansa en `delays-edge`), lectura de plantillas Word/Excel/CSV, usuarios y contraseñas. |
| `tests/unit/base-desk` | Los estados de la pantalla de la base (*ventanilla de visado*) dibujados en el servidor con datos de ejemplo: cruce pendiente, en juego, con un ítem invalidado, cerrada, y las demoras vistas desde la base. |
| `tests/static/` | El contraste real de los colores en modo claro y oscuro (`theme-contrast`), el **contrato** entre la app y el esquema (cada tabla, columna, relación, `rpc` y canal en tiempo real que usa el código existe), las reglas de diseño (sin emojis, colores solo de variables, botones con nombre accesible) y la documentación al día (SQL registrado, variables de entorno). |

## ¿Las pruebas detectan fallos?
La base de pruebas acepta `TEST_MUTATION_SQL`, un SQL que **rompe una regla a propósito** después de las migraciones. Las pruebas de esa regla deben fallar:
```bash
TEST_MUTATION_SQL="drop trigger matches_validate on public.matches;" npx vitest run tests/db
```
Se comprobaron 7 roturas (quitar un trigger, un índice, abrir una política, apagar RLS, anular `check_delays`, quitar el orden de calificación, abrir la política del GPS): todas son detectadas. La de la política del GPS reveló un hueco (solo se probaba con *upsert*) que se corrigió con una prueba nueva.

## Agregar pruebas
- Una regla nueva en la base de datos → una prueba en `tests/db/` **y** su migración con su entrada en [Registro SQL](Registro-SQL) (la suite lo exige).
- Un archivo nuevo en `tests/` se descubre solo (`*.test.ts`).
- `tests/db/seed.ts` tiene constructores (`seedCarrera`, `scheduleWithGenerator`, `playMatch`…) para armar una Carrera en pocas líneas.

## Lo que no cubre (y cómo cubrirlo)
- Lo que el simulacro en código no sustituye: sonido y notificaciones en iPhone con la pantalla bloqueada, GPS real, la red del campus y las teselas de Mapbox.
- Pantallas con **usuarios reales** (login, tiempo real, geolocalización, sonido y notificaciones en iPhone, la red de la Javeriana): se prueban en el **simulacro** con teléfonos. Ver la lista en el [Informe de pruebas](Informe-de-pruebas).
- La revisión visual se hace con las páginas de vista previa (`/preview/<pantalla>` en `npm run dev`) en 390 px y 1280 px.

## El agente de pruebas
`carreapp-tester` (`.claude/agents/carreapp-tester.md`) es un agente de Claude Code que ejecuta todo lo anterior, **inventa casos nuevos** (un grupo que se retira, una base que se mueve, una Carrera grande…), revisa el diseño y la ubicación de la información, y escribe un informe con *lo que está bien*, *lo que falló* y *qué hacer*. Se invoca pidiéndole a Claude Code: "usa el agente carreapp-tester" (o con `/agents`). El resultado queda en [Informe de pruebas](Informe-de-pruebas).
