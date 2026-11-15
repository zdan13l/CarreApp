# Bitácora de desarrollo

Registro cronológico de lo que se hizo, por bloque. Los más recientes arriba.

## Bloque 4 — Vista de base y puntajes (2026-11-15)
**Hecho**
- **Vista de la base** (`/base`): foto del lugar, información y 3 preguntas, y los cruces de su base. El cruce actual aparece primero, con las fotos de los dos grupos y el marcador.
- Cada ítem (barra, pregunta, minijuego) se marca con dos botones grandes (uno por grupo; **no hay empates por ítem**). Se pueden enviar varios ítems juntos y la app pide confirmación porque **solo el coordinador puede corregir** después.
- Los ítems ya enviados quedan bloqueados; si otro inductor de la misma base ya registró uno, la pantalla se actualiza sola (tiempo real).
- **Admin > Puntajes:** ranking, corrección o borrado de cualquier puntaje y **registro de cambios** (quién, qué, antes y después, cuándo).
- Sin cambios de base de datos: usa las reglas y la auditoría de `0001`.

**Verificado**
- Probado en Postgres en memoria: una base solo inserta puntajes de su cruce, no puede editar ni duplicar, el envío de varios ítems funcionan, y las correcciones del admin quedan en la auditoría.

## Bloque 3 — Cruces y rotación (2026-11-15)
**Hecho**
- Pantalla **Cruces**: rondas con base y dos grupos por cruce. Los selectores ya excluyen grupos ocupados en la ronda y rivales que ya se enfrentaron; la base de datos valida igual (no repetir parejas, un grupo por ronda, una base por ronda).
- **Generador automático** (método de todos contra todos): propone rondas sin repetir rivales y rota las bases; se revisa antes de guardar y se puede ajustar a mano.
- **Revisión del cronograma**: grupos que descansan, repetición de bases, parejas programadas.
- Regla **mínimo 2 corredores por grupo** para activar la Carrera.
- Corrección: un inductor ya no puede asignarse a dos bases de la misma Carrera (ni un corredor a dos grupos) — migración `0003`.
- Login: botón para ver u ocultar la contraseña.

## Bloque 2 — Panel del coordinador (2026-11-15)
**Hecho**
- Panel adaptable: menú lateral en computador y pestañas abajo en celular. Secciones: Resumen, Grupos, Bases, Usuarios.
- Carreras: crear y activar; la activación se bloquea si falta algo (regla en la base de datos, migración `0002`).
- Grupos: nombre, foto, corredores y cuál transmite el GPS (solo uno por grupo).
- Bases: nombre, foto del lugar, información, 3 preguntas e inductores asignados.
- Usuarios: crear con contraseña sugerida copiable, cambiar contraseña y eliminar (vía `/api/users`).
- Las fotos se reducen en el navegador a 1000 px antes de subirse.
- El login acepta también `usuario@carreapp.test`.

**Pendiente**
- Probar en producción con datos reales (migración `0002` ya aplicada).

## Bloque 1 — Modelo de datos, autenticación y permisos (2026-11-15)
**Hecho**
- Esquema SQL completo con reglas de negocio, auditoría y RLS ([Registro SQL](Registro-SQL), 0001).
- Login por **usuario y contraseña** (internamente `usuario@carreapp.test`), tres rutas protegidas por rol: `/admin`, `/base`, `/corredor`.
- Endpoint `/api/users` (crear, cambiar contraseña, eliminar) restringido a admin.
- **Tema oscuro** y estilo para exteriores (botones y campos grandes, contraste alto).
- Migración aplicada en Supabase y primer admin creado.

**Verificado**
- SQL probado en Postgres en memoria: reglas anti-repetición, permisos por base y auditoría.
- La app compila y pasa el lint.

**Validado en producción**
- Login real con el admin.
- `/api/users` desplegado con `SUPABASE_SERVICE_ROLE_KEY` en Vercel.

## Bloque 0 — Esqueleto y prueba de red (2026-11-14)
**Hecho**
- Proyecto Vite + React + TypeScript como PWA (manifest, iconos, service worker).
- Cliente de Supabase por variables de entorno.
- Página de diagnóstico: conectividad, instalación, notificaciones y ubicación.
- Despliegue en Vercel conectado a GitHub (deploy en cada push).
- Logo de CarreApp como icono de la app, favicon y encabezado.

**Resultados de las pruebas de campo**
- La red de la Javeriana (wifi y datos móviles) alcanza Vercel y Supabase.
- Instalación en iPhone y ubicación funcionan. Las notificaciones se piden más adelante (Bloque 7), con un botón explícito, porque iOS exige un gesto del usuario.

## Decisiones de diseño y alcance (previas al código)
- Referencia visual: sitio de la Carrera anterior (tarjetas con foto para bases y equipos, ranking con puesto y puntos, tema oscuro).
- Requisito de las bases: **foto del lugar, información que se da y 3 posibles preguntas**.
- El coordinador define cruces y rotación; la app valida que **no se repitan enfrentamientos**.
- Solo el coordinador corrige puntajes ya enviados.
- Alerta de demora: tiempo máximo de traslado configurable por el admin, más aviso manual (Bloque 7).
- Fecha objetivo: **20 de enero** (próxima Carrera).
