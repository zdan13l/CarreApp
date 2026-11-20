# Estado y pendientes (traspaso entre sesiones)

Foto del proyecto al **2026-11-19**, para retomar el trabajo en una conversación nueva sin perder contexto. La fuente de verdad del detalle sigue siendo la [Bitácora](Bitacora), el [Registro SQL](Registro-SQL) y `CLAUDE.md` (en el repositorio).

## Dónde está todo
- Repositorio: `https://github.com/zdan13l/CarreApp` (rama `main`; Vercel despliega solo en ~15 s). Carpeta local: `C:\Users\zdan1\Downloads\Carrera2710`.
- Wiki: `https://github.com/zdan13l/CarreApp.wiki.git` (rama `master`). Se publica copiando `docs/wiki/*.md` a un clon de la wiki y haciendo push.
- Base de datos: Supabase; **las migraciones `0001` a `0022` están aplicadas** la `0023` (pasaporte personal) también, el 2026-11-19; la `0024` (identidad) también; **la `0025` (palabras por inducción y foto de la base) está pendiente de aplicar a mano** (la `0021` y la `0022` el 2026-11-19) (el usuario las aplica a mano en el SQL Editor; ver el registro).

## Qué hace la app (resumen)
Roles: **coordinador** (PC), **inductor de base** y **corredor** (iPhone). Cada Carrera es una edición con grupos, bases, usuarios, cruces (cronograma) y puntajes. Solo una Carrera activa a la vez.

- **Coordinador** (dos modos): *Preparación* (pasos: Grupos, Bases, Usuarios, Cruces, Activar; carga desde Word/Excel; eliminar Carrera) y *En carrera* (En vivo con indicadores, tabla de la ronda, demoras, top 3 con marcos oro/plata/bronce, avisos a grupos o a la base; Puntajes; Mapa). **Finalizar/desactivar reinicia el avance** (0020) y conserva grupos, bases, usuarios y cronograma.
- **Corredor**: ronda actual y "Después", Ruta (historial), Top (solo su equipo con puntos y los demás por nombre), y para el usuario designado del GPS una pestaña Ubicación con mapa fijo. **No ve puesto ni puntos de otros** (privacidad en la base de datos, 0019).
- **Base**: califica 3 ítems por cruce, confirma llegada, apura a los grupos, ve la guía (información y preguntas) en *Mi base*, equipos por foto y nombre, y recibe avisos del coordinador con sonido.
- Notificaciones push (web-push) con sonido: cada aviso es una notificación nueva (el service worker retira las anteriores); los avisos cerrados en la app no reaparecen al recargar.
- Diseño **"Visado"** (2026-11-18): un viaje internacional con dos experiencias: **corredores = viajeros** (pasaporte con portada, mapa del recorrido y sellos únicos por base; claro por defecto) y **coordinador = torre de control** (siempre oscura: vuelos, puertas, verificación de pasaportes, registro de operaciones y radar); logo Brújula; ventanas emergentes propias (`confirmDialog` / `promptDialog`), contraseñas sugeridas chistosas (`D3lF1nZ4p4t0`). Ver [Diseño](Diseno) y [Pantallas](Pantallas).

- **Pasaporte personal del inductor** (2026-11-19, `0023` y `0024`; ahora con sello del comité —dorado para su coordinador—, generación, ingreso, apodo, símbolo, cambio de @ y contraseña, páginas en blanco y PDF de recuerdo): cada inductor tiene un @ personal que abre su pasaporte (corredor, base o coordinador, vestido con la cultura de su carrera en la temática del semestre) y guarda sus sellos para siempre. El coordinador sube el Excel de inductores en *Preparación → Inductores* y recibe otro Excel con los @ y las contraseñas; luego decide los papeles y enlaza a cada corredor con su grupo de dos. Ver la [Bitácora](Bitacora).

## Reglas de la base de datos que conviene recordar
Una Carrera activa a la vez; solo se elimina una Carrera desactivada; cada persona lee solo su Carrera; los puntajes solo los leen el coordinador, el inductor de esa base y los corredores de ese cruce; un grupo necesita al menos 1 usuario (la pareja puede compartirlo); un inductor solo actúa en la Carrera activa; avisos con `target` `groups` o `base` (límite de 20 s por base); desactivar reinicia el avance. Detalle en [Roles y permisos](Roles-y-permisos) y [Modelo de datos](Modelo-de-datos).

## Pruebas
`npm test` (~414 pruebas, ~12 s): base de datos en memoria con todas las migraciones, simulacro de una Carrera completa con el archivo de prueba, contrato app↔esquema, diseño, notificaciones, pantallas. `npm run check` = tipos + lint + api + pruebas + build. El agente `carreapp-tester` (`.claude/agents/`) las ejecuta e inventa casos; su informe está en [Informe de pruebas](Informe-de-pruebas).

## Pendientes
-1. **Aplicar a mano `0025_passport_pages.sql`** (hasta entonces el pasaporte abre sin las palabras de la inducción y de los comités y *Inductores* lo avisa), **escribir esas palabras** (*Inductores → Palabras para los pasaportes*), **poner el apodo y el símbolo de cada persona**, **definir las generaciones** (se ponen por persona en *Inductores*, o en el Excel) y **probar el flujo con el Excel real** (`Inductores_nombres_carreras.xlsx`, 60 personas, 8 carreras): crear semestre `2026-2` · Mitologías, subir el Excel, bajar las credenciales, entrar con un @ en un teléfono, cambiar papeles y enlazar los grupos de dos. Subir las fotos.
-2. **Elegir los sellos de la temática** (galerías en `docs/logo/sellos/`: `sellos-mitologias-2.html` es la ronda 2). Después: guardar el sello de cada base, el paquete por temática y las pruebas. El pasaporte personal ya usa el emblema de cada cultura, pero los sellos de las bases siguen siendo los de siempre.
0. ~~Aplicar a mano las migraciones `0021_team_contacts.sql` y `0022_score_needs_arrival.sql`~~ **Hecho (2026-11-19):** la ficha del equipo en *Top* muestra el @ de su corredor y una base solo puede calificar si ya confirmó la llegada.
1. **Simulacro con teléfonos reales** (lo único que la automatización no cubre), siguiendo [Prueba en vivo](Prueba-en-vivo): sonido y notificaciones en iPhone con la pantalla bloqueada (probar 3 o 4 avisos seguidos sin quitar ninguno), GPS del usuario designado, avisos del coordinador a la base, unos 60 teléfonos a la vez con la red del campus, Mapbox con teselas reales, el diseño nuevo y los márgenes seguros del iPhone, subir una foto de usuario real.
2. ~~Actualizar la Carrera de prueba~~ **Hecho (2026-11-18):** ahora trae un usuario por grupo (9 usuarios).
3. **Volver a correr el agente `carreapp-tester`** tras los últimos bloques (admin en dos modos, reinicio al desactivar, notificaciones, privacidad 0019) y actualizar `Informe-de-pruebas.md`.
4. Menores: la guía "Prueba en vivo" ya explica los dos modos y el reinicio al finalizar; las contraseñas de 6 caracteres siguen permitidas (lo exige Supabase y las plantillas).
5. **Rediseño Visado, por revisar con teléfonos:** ver los sellos con fotos reales de las bases (mala luz u oscuras pesan menos), la transición entre pestañas en iPhone y el momento del sello con la base confirmando de verdad. El pasaporte y el visado no tienen aún prueba de extremo a extremo (solo pruebas estáticas y de la librería de sellos).
6. Antes del día real: no publicar en `main` durante la Carrera (el mapa no está en el precaché), limpiar la Carrera de prueba con *Eliminar esta Carrera*, dejar la real activa.

## Cómo trabajar (convenciones del usuario)
- Habla en español; el código y los comentarios van en inglés, la interfaz en español.
- **No hacer commit ni push hasta que lo pida.** Commits convencionales y **nunca líneas Co-Authored-By**. Varios commits enfocados (migración, código, pruebas, docs). Después, copiar `docs/wiki/*.md` al clon de la wiki (`git checkout Arquitectura.md` en el clon porque solo cambia el fin de línea) y push.
- **Nunca editar una migración ya aplicada**: crear la siguiente `00NN_nombre.sql`, su fila y sección en `Registro-SQL.md`. El usuario la aplica a mano; avisarle cuando el código nuevo depende de una migración. Al aplicarla, marcarla con la fecha en el registro y en la bitácora.
- Cada bloque de trabajo: actualizar `docs/wiki/` (Bitácora, Registro SQL, Pantallas, Roles, Diseño según corresponda).
- Verificar la interfaz con `npm run dev` y `/preview/<pantalla>` (no hay credenciales de prueba; nunca pedir ni escribir contraseñas reales): `runner`, `runner-ruta`, `runner-top`, `runner-alertas`, `base`, `base-llegada`, `base-fin`, `base-demora`, `base-info`, `carga-fallida`, `base-resultados`, `admin`, `admin-carrera`, `admin-forms`, `map`, `logos`, `dialogs`, `sin-carrera`, `sin-carrera-base`; a 390 px y 1440 px, en claro y oscuro. Restaurar el tamaño de ventana y detener el servidor al terminar.
- Para comprobar el despliegue: `curl -s https://api.github.com/repos/zdan13l/CarreApp/commits/main/status` (no hay `gh`).

## Trampas conocidas del entorno (Windows + Git Bash)
- Los *heredocs* con comillas simples fallan: escribir scripts con la herramienta Write y ejecutarlos con `python`.
- Con `git add` por rutas, una ruta mal escrita aborta el comando y se salta el commit: revisar `git status` antes de hacer push (ya pasó una vez y falló un despliegue).
- Los archivos tienen CRLF en disco y LF en git; al editar con Python leer con `newline=''`.
- Las skills de terceros viven en `.claude/skills/` y están en el `.gitignore` (no se versionan); el agente `carreapp-tester` sí.
