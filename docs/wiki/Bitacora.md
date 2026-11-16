# Bitácora de desarrollo

Registro cronológico de lo que se hizo, por bloque. Los más recientes arriba.

## Ajustes de las alertas, 2.ª ronda (2026-11-16)
- **Las notificaciones y el sonido son solo para los corredores** (son quienes deben apurarse). El coordinador y la base **mandan** los avisos: el coordinador desde Cruces y Mapa; la base con el botón *Apurar a los grupos* de su cruce actual. Los botones de activar sonido y notificaciones solo aparecen en la vista del corredor.
- El sonido de demora se repite **cada 30 segundos** (antes 10).
- **Error corregido en el envío:** la función `/api/push` fallaba con un error 500 del servidor y por eso no llegaba ninguna notificación; ahora carga la librería de forma segura y devuelve el motivo exacto del fallo.

## Bloque 8 — Carga masiva de toda la Carrera (2026-11-16)
**Hecho**
- **Cargar la Carrera desde un archivo** (Resumen): un solo documento de **Word (.docx)** o **Excel (.xlsx)** sirve para dejar lista una Carrera. Plantillas descargables en la misma pantalla (`public/plantillas/`); también hay una de solo personas en CSV.
- **Todo es opcional:** el archivo trae hasta seis secciones y se incluyen solo las que se necesiten (en Word cada sección es una tabla; en Excel, una hoja). La app reconoce cada tabla por los títulos de sus columnas.

| Sección | Columnas | Qué crea |
|---|---|---|
| Carrera | Dato · Valor | La Carrera (si es nueva queda en borrador) y su tiempo máximo general |
| Grupos | Nombre del grupo | Los grupos (sin foto) |
| Bases | Nombre de la base · Información · Pregunta 1, 2, 3 · Latitud · Longitud | Las bases con su información, preguntas y ubicación en el mapa (sin foto del lugar) |
| Personas | Nombre completo · Rol · Grupo o base · Usuario · GPS · Contraseña | Los usuarios, con su asignación a grupo o base y el corredor del GPS |
| Cruces | Ronda · Base · Grupo A · Grupo B | El cronograma |
| Tiempos | Desde · Hasta · Minutos | El tiempo máximo de cada tramo entre bases |

- **Vista previa con validación** antes de crear nada, por sección: datos que faltan, rol inválido, usuarios o personas repetidas, grupos o bases que no existen, **enfrentamientos repetidos**, un grupo en dos bases en la misma ronda, una base con dos cruces en una ronda, tramos repetidos o con minutos inválidos. También se revisa contra lo que ya existe en la Carrera. Solo se carga si todo está correcto.
- **Qué hace al cargar:** crea o reutiliza la Carrera, crea los grupos y bases que falten (también los que solo se nombran en Personas o Cruces), carga la información de las bases, crea los usuarios, los asigna, programa los cruces y guarda los tiempos.
- **Credenciales al final:** tabla con usuario y contraseña de cada persona, con *Copiar todo* y *Descargar CSV* (las contraseñas no se pueden consultar después).
- **Las fotos** de los grupos y de las bases se suben después en la app; el archivo no las incluye.
- Sin cambios de base de datos: usa `/api/users` y las reglas que ya existían.

**Verificado**
- Las plantillas reales de Word y Excel se leen completas (6 secciones, 0 errores) y la de CSV también; archivos con errores (enfrentamientos repetidos, grupos o bases inexistentes, rondas inválidas, tramos repetidos) se detectan con un mensaje claro.

**Pendiente**
- Probar la carga con el archivo real del comité y con ~60 usuarios.

## Ajustes tras el Bloque 9 (2026-11-15)
- **Registro de cambios por Carrera:** Puntajes mostraba el registro de todas las Carreras; ahora solo el de la Carrera elegida.
- **Usuarios por Carrera** (migración `0014`, aplicada el 2026-11-15): cada corredor e inductor pertenece a una Carrera; Usuarios, Grupos y Bases solo muestran los de la Carrera elegida y la carga masiva y el formulario crean usuarios ya asignados.
- **Desactivar la Carrera:** la base de datos y el botón funcionan (probado con permisos del coordinador); lo que faltaba era que corredores y bases lo notaran al instante (`events` en Realtime, también en `0014`).
- **Segunda ejecución del agente** (ver [Informe de pruebas](Informe-de-pruebas)): migración `0015` (aplicada el 2026-11-15): el registro de cambios guarda su Carrera y los inductores solo califican, confirman llegada o avisan en la Carrera activa; Usuarios no deja crear corredores o inductores sin Carrera.
- **Hallazgos menores corregidos:** el panel del coordinador escucha `events` en tiempo real; corredor y base no pierden la pantalla por un error de red; el aviso de usuario repetido explica que los nombres son únicos en todas las Carreras.

## Bloque 9 — Pruebas y organización de las pantallas (2026-11-16)
**Hecho**
- **Suite de pruebas automáticas** (`npm test`, 263 pruebas, unos 12 s): lógica pura, funciones del servidor, contrato entre la app y el esquema, reglas de la base de datos y **una Carrera completa simulada** de punta a punta. Ver [Pruebas](Pruebas).
- **Agente de pruebas** `carreapp-tester` (`.claude/agents/`): ejecuta todo, simula Carreras y casos nuevos, revisa el diseño y la ubicación de la información, y entrega retroalimentación (qué está bien, qué falló, qué hacer). Ver [Informe de pruebas](Informe-de-pruebas) para la primera ejecución.
- **`CLAUDE.md`** con la arquitectura y las convenciones del proyecto, para quien continúe el trabajo.
- **Información reorganizada** por pantalla (ver [Pantallas](Pantallas)): el panel del coordinador se divide en *Durante la Carrera* (**En vivo**, Puntajes, Mapa) y *Preparación* (Carrera, Grupos, Bases, Cruces, Usuarios); el corredor y la base tienen cada cosa donde la necesitan en el momento.
- **Corregido gracias a las pruebas:** alertas de demora falsas para grupos que no caminan (migración `0013`), mapas Mapbox múltiples en Bases (riesgo de agotar WebGL), colores antiguos en la ruta del mapa, variables de entorno sin documentar y textos desactualizados.

**Pendiente**
- (hecho) `0013` aplicada el 2026-11-15.
- Simulacro con teléfonos reales (sonido y notificaciones en iPhone, GPS, red de la Javeriana) y limpieza de los datos de prueba antes de la Carrera real.

## Mejoras de las alertas (2026-11-15)
**Corregido**
- **Sonido que no sonaba en tiempo real o dejaba de sonar:** el teléfono duerme el audio al bloquearse o al reabrir la app. Ahora cualquier toque en la app lo despierta, el botón avisa "Toca aquí para reactivar el sonido" cuando está dormido, y los avisos del coordinador se consultan también cada 10 segundos y al volver a la app (el bloqueo corta la conexión en vivo).
- **Repetición:** mientras dure una demora, la alerta suena **cada 10 segundos** (corredor, base y coordinador). El aviso manual suena cada 10 segundos durante su primer minuto.

**Nuevo**
- **Notificaciones push:** llegan con el teléfono bloqueado o la app cerrada. Las manda la base de datos (revisión cada 30 s) a través de `/api/push`; cada persona las activa con un botón (en iPhone, con la app instalada en la pantalla de inicio). Ver [Despliegue y configuración](Despliegue-y-configuracion).
- **Tiempo por tramo:** el recorrido entre bases no es igual, así que cada tramo del cronograma puede tener su tiempo máximo (Resumen > Tiempo de traslado por tramo). Hay un botón que lo calcula con el mapa (caminando x1,5) y se puede ajustar; los tramos vacíos usan el tiempo general.

**Pendiente**
- Aplicar `0011` y `push_setup.sql`, cargar las claves en Vercel y probar con teléfonos reales (bloqueados) en el simulacro.

## Bloque 7 — Alertas de demora (2026-11-15)
**Hecho**
- **Tiempo máximo de traslado** configurable por el coordinador (Resumen > Alertas de demora; por defecto 10 min).
- **Alerta automática:** un grupo está "en demora" cuando pasó ese tiempo desde que terminó su cruce anterior y la base aún no confirmó que llegaron ambos. Se calcula en cada teléfono con los datos compartidos (no necesita un servidor).
  - **Corredor:** aviso rojo con los minutos y la base a la que debe ir, más sonido.
  - **Base:** aviso con los grupos que están en demora en su cruce, más sonido.
  - **Coordinador:** panel *Demoras en el traslado* en Cruces y en Mapa, con los minutos de cada grupo y, si comparte GPS, a qué distancia está de la base.
- **Aviso manual:** botón *Avisar* en la demora y campana en cada cruce; el coordinador escribe (o acepta) un mensaje que reciben al instante los corredores de los dos grupos y la base de ese cruce.
- **Sonido y vibración:** hay que activar el sonido con un botón (iPhone y navegadores exigen un toque primero). Suena una vez al aparecer una alerta y se repite cada 3 minutos mientras siga la demora.

**Límite conocido**
- Los avisos suenan y se ven **con la app abierta**. Una notificación con la app cerrada (web push) exigiría un servidor de notificaciones y claves propias; queda como mejora opcional.

**Pendiente**
- Aplicar `0010` y probar con teléfonos reales en el simulacro.

## Rediseño visual (2026-11-15)
**Hecho**
- **Nuevo logo:** una C dorada con una aguja de brújula azul dentro, sobre azul noche (elegido entre 16 propuestas). Reemplaza al anterior en el icono de la app, el favicon y todas las pantallas.
- **Nueva identidad visual:** paleta azul noche + dorado, tipografía Archivo (titulares condensados) y componentes coherentes; ver [Diseño](Diseno).
- **Sin emojis:** iconos SVG de línea (Lucide) en pestañas, botones y avisos; los grupos sin foto muestran sus iniciales.
- **Pantallas rehechas:** login, corredor (marcador en vivo con puesto y puntos, ronda, ruta y top), base (marcador del cruce, elección del ganador por escudo), panel del coordinador (menú lateral en computador con marca y usuario; barra superior en celular) y mapa con marcadores nuevos.
- **Corrección de choques:** el selector de rondas ya no se amontona en celular, las filas de cruces separan base, grupos y estado, y el panel ocupa todo el ancho en computador.
- Página `/preview/<pantalla>` (solo desarrollo) para revisar el diseño con datos de ejemplo en celular y computador.

**Pendiente**
- Probar el nuevo diseño en iPhone real durante el simulacro.

## Bloque 6 — Mapa 3D y GPS (2026-11-15)
**Hecho**
- **Mapa 3D con Mapbox** (estilo *Standard*: edificios en 3D, inclinado, centrado en la Javeriana). Se carga solo cuando una pantalla lo usa (no pesa en el resto de la app).
- **Ubicación de las bases:** el coordinador (o la propia base, si se mueve) toca el mapa o usa su ubicación actual para fijar dónde está.
- **Mapa en vivo del coordinador** (pestaña *Mapa*): bases y grupos; cada grupo se mueve con la ubicación del corredor designado, con "hace X min" y alerta en rojo si pasan más de 2 minutos sin señal.
- **Corredor, pestaña Mapa:** ruta a pie a la siguiente base con distancia, tiempo e indicaciones paso a paso en español. Todos pueden usarla (su posición queda en su teléfono); **solo el designado** comparte además su ubicación con el coordinador (cada 30 s), con la pantalla encendida (*Wake Lock*) y la compartición sigue aunque cambie de pestaña.
- Variable `VITE_MAPBOX_TOKEN` (token público de Mapbox restringido por URL).

**Pendiente**
- Probar con teléfonos reales en el campus (migración `0009` aplicada y token de Mapbox cargado).

## Ajustes al Bloque 5 (2026-11-15)
- **Barra de navegación inferior** en celular. **Corredor:** barra de estado siempre visible con puesto y puntos en vivo, y pestañas *Ronda* (ronda actual, rival y lo que la base ha calificado ítem por ítem, más la última ronda terminada), *Ruta* y *Top*. **Base:** pestañas *Mi base* (foto, información y preguntas), *Ronda* (actual y próxima), *Top* y *Terminados*.
- **Información de la base privada:** el corredor ya no la ve, y tampoco puede leerla de la base de datos (migración `0008`).
- **Tiempo real más robusto en iPhone:** además del tiempo real, la app se refresca al volver al primer plano, al recuperar conexión y cada 20 segundos (el iPhone suspende las conexiones al bloquear la pantalla).

## Bloque 5 — Ranking en vivo y vista del corredor (2026-11-15)
**Hecho**
- **Vista del corredor** (`/corredor`): su grupo con foto, **puesto y puntos**; tarjeta de **su siguiente base** (foto de dónde queda, información y rival con foto) que pasa a *En juego* cuando la base confirma la llegada; **Top equipos** con su grupo resaltado; y **Tu ruta** ronda a ronda (base, rival, resultado, o *Descansas*).
- **Ranking en vivo** (componente compartido `Ranking`): se actualiza solo cuando llegan puntajes, cambian los cruces o se mueve una base. Los grupos con los mismos puntos comparten puesto. También aparece (plegable) en la vista de la base y en Puntajes del coordinador.
- Sin cambios de base de datos: usa la vista `team_standings` y las lecturas ya permitidas.

**Pendiente de validar**
- Probar con un usuario corredor real (iPhone) durante el simulacro.

## Ajustes al Bloque 4 (2026-11-15)
- **Llegada de los grupos:** la base ve el botón *Ya llegaron ambos grupos*; al confirmarlo el cruce pasa a **En juego** en el panel del coordinador (con la hora) y recién ahí puede calificar (`0007`).
- **Foto de la base editable** por sus inductores (la base puede moverse por lluvia).
- **Próxima ronda:** la base ve un adelanto del siguiente cruce (grupo A vs grupo B).
- **Cruces y Puntajes por ronda:** el coordinador ve una ronda a la vez, con botones *Anterior* y *Siguiente ronda* y cuántos cruces van terminados; empieza en la ronda en curso. Hay una casilla para ver todas.
- **Ítems invalidados:** si no se alcanza a hacer una barra, pregunta o minijuego, **solo el coordinador** lo marca como invalidado en Puntajes (incluso antes de esa ronda). Nadie suma, la base lo ve bloqueado y solo califica lo que queda; el cruce termina cuando sus 3 ítems están puntuados o invalidados (migración `0006`).
- **Tiempo real:** el panel del coordinador (Puntajes y Cruces) y la vista de la base se actualizan solos cuando llega un puntaje, sin recargar.
- **Solo la ronda en curso:** la base ve únicamente el cruce actual; al completar los 3 ítems aparece el siguiente. Los terminados quedan en un historial de solo lectura. La regla también está en la base de datos (`0005`); el coordinador puede puntuar fuera de orden.

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
