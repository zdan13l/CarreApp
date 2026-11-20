# Bitácora de desarrollo

Registro cronológico de lo que se hizo, por bloque. Los más recientes arriba.

## Reinicio y semilla de la Carrera 2710 (2026-11-20)
`scripts/seed-2710.ts` deja la base de datos lista para la inducción 2710 (Mitologías): borra todos los usuarios menos el administrador, las Carreras, las inducciones, los pasaportes y las fotos, y crea la inducción 2710, la Carrera 2710 con 18 grupos y 17 bases ficticios, 54 cruces (6 rondas, nadie repite rival), el usuario de cada grupo y de cada base, y el pasaporte personal de los 59 inductores del Excel (con su @, apodo, comité, generación e ingreso). Se corre en el computador del mantenedor con la llave de servicio (`--dry` solo muestra el plan; `--yes` borra y crea) y escribe `credenciales-2710.xlsx` con todas las contraseñas, que **no se sube a git** (está en `.gitignore`, igual que el Excel de inductores: son datos personales).
- **Nomenclatura de los semestres:** la primera parte del año es `2X10`, la segunda `2X30` y los intersemestrales `2X20`. Generaciones: Minichips 2710, Barbies 2630, Peluches 2610, Champiñones 2510; "Pendiente" queda sin generación hasta definirla; quien entró dos veces ("Barbies / Pendiente") guarda las dos y su ingreso es el más antiguo.
- **Roles:** "Coordi …" es coordinador; los demás se reparten (los del comité Carrera primero) en corredores (parejas de carreras distintas) y gente de base. El Excel no dice quién corre ni quién atiende una base, así que es una distribución de prueba que el coordinador corrige en *Inductores*. El líder dorado de un comité solo se marca cuando coordina uno solo (Clausura, Conzumo y Carrera); Caos tiene dos coordinadores y se elige a mano.
- Los grupos y las bases usan las fotos del campus que trae la app; la Carrera se deja activa si pasa `event_problems()`.

## El pasaporte es el de toda la vida en la inducción (2026-11-20)
El pasaporte va a existir en muchas inducciones, así que se separó lo general de lo de cada inducción (migración **0025**, pendiente de aplicar a mano; 0024 ya está aplicada).
- **Portada y página de identidad generales** (el "DNI" de la inducción): nada de mitologías, comité, papel ni pareja. Llevan el **símbolo de su carrera** (cinco: *sistemas*, *trónicas* —Mecatrónica, Redes y Electrónica—, *industrial*, *biomec* —Bioingeniería y Mecánica— y *civil*) con el nombre de la carrera, la foto, el apodo y el símbolo personal, **cuándo ingresó a inducción**, la **generación** (con su espacio para el sello, vacío hasta que se sepan las generaciones), el @ y un número que es el mismo toda la vida.
- **Cada inducción trae sus propias páginas**, en su temática: la **página de la inducción** (la firma "Inducción 2710 · Temática Mitologías", las palabras de los coordinadores y la cultura que le tocó, con su papel, grupo y pareja), la **página del comité** (su sello —dorado si lo coordina—, las palabras de su comité y un **sello dorado con la foto**: la del grupo con el que corre un corredor, o la de su base si atiende una, porque no corre ni tendrá sellos de bases) y las **páginas de visados**. Después van **páginas en blanco** para las próximas inducciones. Una temática que la app todavía no conoce (la 2720, "casas de Harry Potter") sale con páginas neutras y su propio nombre, nunca con las culturas de otra temática.
- **El coordinador** escribe las palabras de la inducción y de cada comité (*Inductores → Palabras para los pasaportes de esta inducción*), y **pone el apodo, el símbolo y su nombre** de cada persona (también el apodo por Excel). **El apodo y el símbolo ya no se eligen en Mi perfil**: se ponen una sola vez. Mi perfil queda con el @, la contraseña y el PDF.
- **Se quitó la versión del coordinador** (torre de control oscura) y las versiones por papel del cuaderno: se ve igual para todos, porque el próximo coordinador será otra persona y el papel cambia de inducción en inducción.
- El texto de la carga de inductores deja claro que la temática y la cultura son solo de esa inducción. El **PDF** sigue la misma estructura (portada y DNI generales, tres páginas por inducción, visados y dos páginas en blanco) y trae las fotos del grupo o la base.

## La identidad del pasaporte: comités, generación, apodo, símbolo, cuenta y PDF (2026-11-19)
Con la migración 0023 ya aplicada, el pasaporte personal se completó con lo que lo vuelve de cada persona (migración **0024**, pendiente de aplicar a mano).
- **Sello del comité.** En la inducción hay cinco comités y cada uno tiene su sello, dibujado con la mitología de la temática: **Clausura** (la bata azul con la que Homero recitaba sus poemas), **Meraki** (el comité de los inductores para los inductores: Psique, el alma, como una mariposa), **Conzumo** (la copa de vino de Dionisio), **Carrera** (las olimpiadas: un corredor dentro de la corona de laurel) y **Caos** (Prometeo y el fuego que enciende otros fuegos). **El coordinador de cada comité tiene el sello dorado** (oro, con una corona de rayos y "coordinador" en el anillo); cada comité tiene un solo coordinador por semestre. Galería en `/preview/comites`.
- **La cultura que te tocó** ya no usa las figuras de los sellos de las bases (Mjölnir, Medusa, el dragón…): es un dibujo propio del *lugar* de cada cultura (un drakkar, un templo, una pirámide, una pagoda, las pirámides con el sol) en un sello único, "Cultura nórdica · Te tocó".
- **Página "Mis sellos"** del pasaporte, con los cuatro sellos de identidad: comité, cultura, **generación** y **cuándo ingresó a inducción**. Mientras la generación o el ingreso no estén definidos (la lista de generaciones se sabrá después) queda el espacio vacío, con su anillo punteado, y el coordinador los pone desde *Inductores*.
- **Apodo y símbolo personal** (el gato blanco de uno, otro animal o cosa para cada uno): cada persona los elige en **Mi perfil** (40 íconos, sin emojis, y un nombre para el símbolo) y salen en la página de identidad.
- **Mi perfil:** también cambian su **@** y su **contraseña** (piden la contraseña actual; el cambio de @ lo hace el servidor, `api/account.ts`) y, si la olvidan, el coordinador sigue pudiendo generarles una nueva.
- **Páginas en blanco** como un pasaporte de verdad: nunca menos de cuatro páginas de visados (se llenan con el tiempo; se agregan más cuando hacen falta).
- **PDF de recuerdo:** *Mi perfil → Descargar mi pasaporte en PDF* arma en el teléfono un PDF A5 de 7 páginas o más (cubierta, identidad, mis sellos, visados con las páginas en blanco e historial). Dibuja las páginas como SVG con los mismos componentes de la pantalla, el navegador las vuelve imagen y `lib/pdf.ts` las junta en el archivo (sin librerías ni subir nada). En el celular abre el menú de compartir (para guardarlo en Archivos) y en el computador lo descarga. Se ve en `/preview/pasaporte-pdf`.
- **Inductores (coordinador):** comité, "coordina el comité", generación e ingreso por persona; el Excel acepta las columnas opcionales *Comité*, *Generación*, *Ingreso* y *Apodo*, y el Excel de contraseñas trae el comité.
- Migración 0023 aplicada el 2026-11-19.

## Pasaporte personal del inductor (2026-11-19)
Un regalo para los inductores y la base para que CarreApp siga años en la inducción: cada inductor tiene **un usuario personal (@)** que abre **su pasaporte**, un espacio propio donde queda, semestre tras semestre, su paso por la Carrera con los sellos de cada temática. Es aparte del usuario del grupo (el que entra a la operación en vivo).
- **Del Excel al @:** el coordinador sube el Excel de inductores (*Nombre*, *Carrera*, opcionalmente *Rol*) en **Preparación → Inductores**. La app muestra una vista previa con la cultura, el papel y el @ de cada uno, crea los usuarios y **devuelve otro Excel** con el @ y la contraseña de todos (`write-excel-file`, se descarga solo y se puede bajar de nuevo en esa sesión). El @ es el primer nombre y el primer apellido (`persona1`; si se repite, la inicial del segundo nombre o un número). Quien ya tenía pasaporte de otro semestre **conserva su @** y solo recibe una página nueva.
- **Una cultura por carrera, según la temática del semestre** (`src/lib/themes.ts`). En *Mitologías*: Sistemas → nórdica; Mecatrónica, Redes y Electrónica → griega; Industrial → mexicana; Bioingeniería y Mecánica → china; Civil → egipcia. Si una carrera no tiene regla, el coordinador elige la cultura. Otro semestre con otra temática solo necesita una entrada nueva en ese archivo.
- **El coordinador decide después** quién corre, quién es base y quién coordina (él también está en la lista), corrige la cultura, sube la **foto** (cámara), genera otra contraseña o elimina el pasaporte, y **enlaza a cada corredor con su grupo de dos** (o a cada base con su base).
- **Tres versiones del pasaporte** (`/pasaporte`): *corredor* (el viajero: su grupo, con quién corre y un sello por cada base que su grupo terminó), *base* (mostrador azul: su base y un sello por cada cruce atendido) y *coordinador* (torre de control, siempre oscura: una Carrera cerrada es un sello). Cubierta que se abre al tocarla, página de identidad (foto, carrera, cultura, papel, grupo o base, @ y número de documento), páginas de sellos con el **visado de entrada** de la cultura, e **historial** de todos los semestres. Cada cultura pone su color, el borde de sus páginas (runas, greca, escalones, nubes, loto) y el emblema de su cubierta (Mjölnir, Medusa, la Piedra del Sol, el dragón, el ojo de Horus).
- **Los sellos se guardan para siempre:** al desactivar una Carrera, antes de reiniciarla, se archivan los sellos de cada pasaporte (migración 0023). Mientras la Carrera corre se ven en vivo.
- **Migración 0023 (aplicar a mano en el SQL Editor):** `terms`, `passports`, `passport_records`, `passport_stamps` y las funciones `my_passport_context()` / `my_live_stamps()`. Hasta aplicarla, *Inductores* avisa "Falta aplicar la migración 0023" y nada más cambia.
- **Seguridad:** el usuario personal **no tiene perfil** (`profiles`): no puede leer grupos, bases, cruces ni puntajes; solo su propio pasaporte (`api/users.ts` lo crea con el rol `member` en `passports`).
- Pantallas de ejemplo: `/preview/pasaporte-corredor`, `/preview/pasaporte-base`, `/preview/pasaporte-coordi` (`?cultura=griega|mexicana|china|egipcia`, `?portada`, `?pagina=1`) y `/preview/inductores`.
- Sellos de la temática: la galería de propuestas (`docs/logo/sellos/`) sigue pendiente de elegir; los sellos de las bases siguen siendo los de siempre.

## Login: se probó escribir el nombre a pluma y se dejó quieto (2026-11-19)
Se probó que "CarreApp" se escribiera trazo a trazo en varias escrituras (como el saludo del iPhone) junto al escudo y no gustó: **el login volvió a ser estático**, como antes (escudo y nombre en blanco, tamaños de siempre). Se quitaron la animación, sus trazos generados y la herramienta que los hacía; no queda ninguna pantalla de bienvenida.
- **Se queda el velo oscuro** en la parte de abajo de la foto (`.login-hero::after`), que sí gustó: oscurece la foto abajo y da fondo a "Gestión en vivo de Carrera". El degradado que ya había quedaba debajo de la foto y no se veía.
- Está en el historial de git (commits `feat: login writes the name CarreApp stroke by stroke…` y `feat(tools): generator of the pen strokes…`) por si se quisiera retomar.

## Migración 0022 aplicada (2026-11-19)
El mantenedor aplicó a mano `0022_score_needs_arrival.sql`: la base de datos ya rechaza el puntaje de una base que no confirmó la llegada. Están aplicadas todas las migraciones, de la `0001` a la `0022`.

## Correcciones del tester: carga fallida, apurar desde el aviso, llegada obligatoria, botón legible y contraseñas (2026-11-19)
Se corrigieron los hallazgos de la sexta ejecución del agente `carreapp-tester`.
- **Error de red ≠ "sin Carrera":** si la primera carga falla (mala señal), corredor y base ven *No pudimos cargar tu pantalla* con *Reintentar* (`LoadFailed`), en lugar de "No hay ninguna Carrera activa para tu usuario". Sigue reintentando solo.
- **Apurar desde el aviso de demora:** el aviso de la base ahora lleva su propio botón *Apurar a los grupos* (sirve también cuando el grupo va tarde para la *próxima* ronda, que no tiene tarjeta con ese botón) y confirma con *Aviso enviado*.
- **Migración 0022 (aplicar a mano en el SQL Editor):** una base solo puede calificar si ya confirmó la llegada (`validate_score` exige `arrived_at`; el coordinador queda exento). La pantalla muestra las etapas solo con la llegada confirmada y, si la base de datos la rechaza, dice "Primero confirma que llegaron los dos grupos". Las pruebas de reglas ahora confirman la llegada antes de calificar.
- **Botón deshabilitado legible:** un botón principal deshabilitado es una pieza lisa y apagada (texto 6,6:1 en claro y 6,8:1 en oscuro) en lugar de un dorado desvanecido (~2:1).
- **Contraseñas sugeridas más fuertes:** llevan cuatro dígitos al azar al final (`D3lF1nZ4p4t00482`), porque las listas de palabras viajan con la app y el @ de un corredor es visible a los demás corredores (0021). El @ sigue visible a propósito. Conviene regenerar con *Cambiar contraseña* las contraseñas de corredores creadas antes de hoy.
- Documentación: pruebas (~510), "puntos del propio grupo" en la barra del corredor, nota del @ en Roles y permisos.
- Vistas de ejemplo nuevas: `/preview/base-demora` y `/preview/carga-fallida`.

## Migración 0021 aplicada (2026-11-19)
El mantenedor aplicó a mano `0021_team_contacts.sql` en el SQL Editor de Supabase. Con ella la ficha de cada equipo en *Top* muestra el @ de su corredor. Ya están aplicadas todas las migraciones, de la `0001` a la `0021`.

## Base: la ventanilla de visado (2026-11-19)
La pantalla de la base se veía plana al lado de la del corredor. Se le aplicó todo lo hecho en el corredor y se le dio una identidad propia: el inductor es el **oficial de migración** que sella los pasaportes.
- Del corredor: pase azul marino con muescas y talón, pestañas blancas de carpeta (*Equipos de la Carrera*, *Cruces de tu base*, *Lo que se explica*, *Posibles preguntas*, *Dónde queda*), fondo con el patrón, transición lateral entre pestañas, barra inferior flotante sin recarga de la vista, la campana (`AlertBell`) en lugar del panel de alertas en línea, título "Mi base" solo en *Ronda* y la tarjeta oscura de cierre.
- **Pase de la ventanilla** (`BaseTicket`): foto y nombre de la base, código de aeropuerto y, en el talón, los visados sellados.
- **Mostrador** (`MatchCard`): borde superior en la **tinta del sello de la base** (acento de toda la pantalla), placa de puerta, el sello de la base, tres pasos (*Llegada · Etapas · Sello*) con su estado, los grupos como pasajeros con su vuelo `JV 2xx` y si están en camino o en la puerta, etapas numeradas y el ganador elegido en el azul del pase.
- *Próxima ronda* es otro pase con los dos grupos; al terminar todo aparece *Ventanilla cerrada*.
- Vistas de ejemplo nuevas: `/preview/base-llegada` (esperando a los grupos) y `/preview/base-fin` (ventanilla cerrada).
- Sin cambios de base de datos ni de comportamiento: confirmar llegada, apurar y calificar funcionan igual.

## Corredor: revisión de la interfaz (2026-11-19)
Revisión de todas las pantallas del corredor en claro y oscuro a 390x844, 375x667 y 360x640, midiendo desbordes, objetivos táctiles, texto pequeño y recortes.
- **Pasaporte cortado (bug real):** la hoja de sellos necesitaba 624 px y la hoja medía 540, así que se recortaba la segunda fila de sellos y las líneas de lectura. Ahora todas las hojas miden 600 px (`--leaf-h`), la hoja crece si algún día necesita más (nunca recorta), los sellos son un poco más chicos (108) y la página 1 ya no repite el mapa en una lista: el mapa es más alto y se ven los códigos con letra de 12 px.
- **Demasiado dorado:** se quitaron la línea dorada de la barra, la tira de lámina de los tickets, el anillo dorado del avatar, el marco y la cinta de las hojas, los filetes dorados de las celdas, el borde dorado de la ficha del equipo y el dorado del marcador y de la etapa activa. La pestaña activa es una pastilla clara con el icono dorado. El dorado queda para la portada, el botón principal y los rótulos pequeños.
- **Amarillo en oscuro:** el marcador `0–1` ya no es amarillo chillón y el patrón del fondo se atenúa en modo oscuro para que las tarjetas manden.
- Sin desbordes horizontales ni botones menores de 40 px en Visado, Pasaporte, Top y recorrido completo. El texto pequeño que queda está dentro de los sellos (decorativo).

## Corredor ronda 4: fichas de equipos, pasaporte sólido y arreglos (2026-11-19)
- **Migración 0021 (aplicar a mano en el SQL Editor):** `team_contacts()` entrega el @ de los corredores de cada grupo de la propia Carrera. Sin ella la app funciona, pero la ficha del equipo sale sin @.
- *Top*: tocar un equipo abre una ficha con su foto grande y el @ de su corredor.
- Hoja de la cuenta: bordes arreglados (recorta la cinta dorada con las esquinas) y el rol va en una línea aparte debajo del @.
- El botón "Ver mi pasaporte" del recorrido completo estaba invisible: el estilo general de los botones dorados le pintaba un brillo encima y el texto azul quedaba sobre azul.
- Mapa: vuelve la vista **desde arriba** (botón que alterna con la vista 3D) y el control de zoom y brújula; "Centrar" respeta la vista elegida.
- Pasaporte: totalmente sólido (sin vetas ni transparencias), sin desplazamiento interno (el itinerario es una cuadrícula de dos columnas) para que deslizar de lado nunca se enrede; la portada ya no lleva las líneas `<<<` ni el chip circular.
- Las barras de desplazamiento y el desborde horizontal de la animación de pestañas ya no hacen saltar la pantalla al cambiar de pestaña.
- Ubicación: el estado es una píldora corta ("Compartiendo tu ubicación"), el botón de dejar de compartir va centrado y pide confirmación.
- "Mi grupo" solo es visible en Visado (en las demás el título queda solo para lectores de pantalla).

## Corredor ronda 3: cuenta, mapa, pasaporte fijo y recorrido completo (2026-11-18)
- La barra de arriba es una caja (logo, campana y @usuario) para que el título se distinga. Tocar el @usuario abre una hoja con la **foto grande**, el modo claro / oscuro y cerrar sesión; la campana abre una hoja con solo los dos interruptores.
- Los diálogos (sello nuevo, sello grande, cuenta, alertas) **bloquean el desplazamiento de la pantalla de atrás** (`lib/scrollLock.ts`, con contador para varios a la vez).
- Terminar todos los cruces muestra una tarjeta de celebración con los sellos, el total y un botón al pasaporte.
- Ubicación: el mapa ya no es fijo; botón **Centrar** que vuelve a encuadrar las bases (o el centro del campus). Banderas de las bases: gota azul marino con borde dorado y etiqueta blanca. Se quitó el texto: solo el botón de compartir.
- Pasaporte: tamaño fijo en todas las páginas (el cuerpo se desplaza por dentro), sin botones de página (solo deslizar, con los puntitos), página 1 sin datos repetidos, total de sellos en una insignia dorada, líneas de lectura centradas, sin la pista de tocar el sello y portada con más detalle.
- El ticket del próximo destino lleva el nombre arriba y, debajo, la foto y "Tu rival".

## Corredor: título blanco en Top, sello que espera, pasaporte con más estilo y botones nuevos (2026-11-18)
- Top: el mismo ticket de pasajero de Visado (sin el código de vuelo, con "En vivo") y una tarjeta blanca tipo pestaña de carpeta con el título "Los demás equipos".
- Al ganar un sello, la pantalla del sello **espera** a que la persona toque "Seguir" (antes se cerraba sola a los 4 s).
- Pasaporte: papel con las vetas del login, marco dorado, cinta de lámina arriba y celdas de identidad con filo dorado; se quitó la palabra "Passport" y la portada dice "Carrera 2710" centrado.
- Barra superior: campana y cuenta en azul marino con el avatar anillado en dorado; la barra del celular muestra solo el primer nombre. La campana ya no cambia de color según el sonido (era el verde de `.is-on` y el dorado al abrir, más el hover pegado en táctil): ahora siempre es azul marino, el estado se lee en el icono y en la lucecita (verde con sonido, dorada sin él) y abierta es dorada.

## Corredor: ticket de pasajero, Visado liviano, sellos grandes y pestañas flotantes (2026-11-18)
- La tarjeta de pasajero vuelve a ser un ticket (azul marino, muescas, talón con los puntos) y solo está en Visado. En Top vuelve el ticket de "Tu equipo" y abajo los demás equipos.
- La tarjeta del destino quedó más liviana: foto más baja, contra quién juegas con el marcador, las tres etapas en una fila y el sello en grande.
- En el pasaporte, tocar un sello lo abre grande en un diálogo (con las tres etapas); se dibuja fuera del librito porque su `perspective` atrapa los elementos fijos.
- El patrón de la entrada está detrás de todas las pestañas del corredor. Pestañas inferiores flotantes: pastilla azul marino con la activa en lámina dorada (también la usa la pantalla de la base).

## Pantalla del corredor (2026-11-18)
- Barra superior con el escudo completo y grande (antes la versión compacta de 30 px). Tarjeta principal: ahora muestra los **puntos** del equipo en lugar de "x de y destinos".
- Campana: el panel de ajustes se abre sobre la pantalla (se cierra tocando fuera, la X o Escape). El icono muestra el estado del sonido (campana sonando o tachada con punto) y se actualiza al instante. Se arregló una carrera: tocar el botón de "reactivar sonido" podía apagarlo, porque el toque ya había despertado el audio antes del clic.
- "Próximo destino" rehecho como pase de abordar en azul marino `#031d44` con muescas y talón (código y puerta).
- Pasaporte: la portada se ve cada vez que se abre la pestaña y se abre al tocarla. Las pestañas se deslizan al cambiar (hacia donde vas).
- Top: ya no repite la tarjeta del equipo (su nombre y puntos están arriba); lista todos los equipos con el propio marcado, sobre el patrón de la entrada.

## Login: mitad campus, mitad patrón, logo blanco con letras doradas (2026-11-18)
- La mitad de arriba vuelve a ser la foto del campus (esquinas redondeadas abajo) y la de abajo un patrón de mármol blanco con vetas doradas (`public/login-pattern.svg` y `login-pattern-dark.svg`, trazados vectoriales sin costura); en escritorio, foto a la izquierda y patrón a la derecha.
- Logo del login: escudo blanco (`crest-blanco.svg`) y nombre en lámina dorada. Solo "Gestión en vivo de Carrera" en amarillo.
- Modo oscuro del login con el azul `#031d44` (ticket y patrón de vetas en la misma familia).
- Login en modo oscuro: la foto del edificio al atardecer (`public/campus-noche.jpg`) reemplaza a la del campus de día; en modo claro sigue la de día.
- Ajustes del login: botón luna/sol sólido que cambia de color con el tema (azul marino en oscuro, blanco en claro; igual en celular y escritorio), tarjeta más arriba y "Gestión en vivo de Carrera" en blanco con una línea dorada encima.
- Botón luna/sol del login sólido (blanco sobre la foto, superficie en escritorio) y con hover sólido. Modo oscuro: tarjeta más clara que el fondo y patrón azul visible. Letras del logo y "Gestión en vivo de Carrera" en blanco; la contraseña vacía muestra puntitos.
- Tarjeta: la ruta (PUJ → 2710) en tres columnas centradas, y el código de barras y las líneas de lectura centrados; la segunda línea es aleatoria (`mrzRandom`). Sin scroll en 360x640, 390x844 ni 1440x900.

## Login como tarjeta de embarque, sin círculos de fondo (2026-11-18)
- Se quitaron las rosetas (círculos) de fondo en todas las pantallas.
- Login rehecho: foto a pantalla completa, sin la palabra "Pasaporte", y el formulario como tarjeta de embarque (PUJ → 2710, perforación, código de barras y líneas de lectura). En el celular cabe sin scroll (probado a 390x844 y 360x640); en PC, foto a la izquierda y tarjeta a la derecha.

## Logo nuevo: el escudo dorado (2026-11-18)
- Se eligió la opción A (escudo) y se mejoró: simétrico, trazado al doble de resolución y con versiones azul, blanca, dorada y compacta. **El ícono de la app no lleva el nombre**: escudo dorado sobre el azul de la app (192, 512, maskable, iPhone y favicon regenerados).
- Componente `Logo` nuevo (escudo compacto y nombre pintados con máscara, del color del lugar). Login con el logo de CarreApp arriba a la izquierda y **sin el escudo de la Universidad ni la brújula**; portada del pasaporte con el escudo dorado; menú del coordinador y barras de la app con el imagotipo.
- Se retiró la galería de seis logos y los archivos del escudo oficial. Archivos fuente en `docs/logo/final/`. El escudo es una reinterpretación: pendiente confirmar con la Universidad.

## Dos experiencias en un universo: el viaje y la torre de control (2026-11-18)
- **Concepto:** la Carrera como un viaje internacional. Cada grupo es un vuelo (`JV 200`…), cada base un destino con puerta y código de aeropuerto, y el pasaporte la prueba del viaje. Detalle en [Diseño](Diseno).
- **Corredores (viajeros):** el pasaporte tiene **portada** que se abre, **página de identidad** con equipo, vuelo y **mapa del recorrido** (posiciones reales de las bases), barra de progreso del viaje, itinerario y **páginas de sellos** con paso de página. Cada base tiene un **sello único** (foto en una tinta, nombre, código, símbolo del lugar, forma y composición). La pestaña *Visado* es la tarjeta del destino (foto grande, puerta, código, estado y las **tres etapas**) y el siguiente destino es una tarjeta de embarque.
- **El sello se gana al completar las tres etapas** (la base califica barra, pregunta y minijuego: el cruce termina). Antes se estampaba al llegar; cambió por pedido del nuevo concepto. La llegada confirmada ahora se muestra como "en puerta". No se tocó la lógica de validación ni la base de datos.
- **Coordinador (torre de control):** panel siempre oscuro con *Live Monitoring* (indicadores), *Flight Control* (tablero de vuelos), *Gate Management* (puertas), *Passport Verification* (matriz de sellos por vuelo), *Operations Log* (registro de llegadas, cruces terminados y avisos) y *Flight Radar* (mapa nocturno con barrido). Todo sale de datos reales; nada se simula.
- **Escudo oficial** de la Universidad (con sus proporciones) en la entrada, la portada del pasaporte y el menú del coordinador; **foto del campus** nueva en dos tamaños (1600 y 800 px).
- Sin cambios de base de datos, permisos ni autenticación; sin dependencias nuevas. Pruebas nuevas: `tests/unit/flight.test.ts` y `tests/static/torre.test.ts` (452 en total).

## Identidad "Visado": la app es un pasaporte (2026-11-18)
- **Qué es:** rediseño completo de la interfaz sobre una sola idea: papel de seguridad, portada azul con lámina dorada y **sellos que son las fotos de las bases**. Detalle en [Diseño](Diseno).
- **Entrada:** portada del pasaporte con la foto del campus (`public/campus.png`, 500 px: conviene reemplazarla por una de 1600 px o más), título en lámina y formulario en hoja de papel.
- **Corredor:** pestañas **Visado** (la base de la ronda como portada, con su sello y la cuenta del pasaporte arriba), **Pasaporte** (un sello por ronda, que reemplaza a *Ruta*) y **Top**. Al confirmarse la llegada con la app abierta, el sello cae en pantalla (momento del sello) y el teléfono vibra.
- **Base y coordinador:** cada base muestra su sello en *Mi base* y en *Bases*; el panel del coordinador es la "oficina de control" (portada azul con lámina en el menú, indicadores con trama).
- **Claro por defecto**, oscuro como "pasaporte de noche"; transiciones de página con View Transitions (con respaldo sin animación) y todo apagado con "reducir movimiento".
- **Sin cambios** de base de datos, lógica ni autenticación; sin dependencias ni fuentes nuevas. Pruebas nuevas: `tests/unit/stamp.test.ts` y `tests/static/visado.test.ts` (440 en total).
- Páginas de revisión en desarrollo: `/preview/runner-sello` y `/preview/sellos`.

## Hallazgos de la quinta ejecución del tester (2026-11-18)
- **Resultados antes de reiniciar:** *Finalizar Carrera* y *Desactivar* descargan un CSV con la clasificación y el detalle por cruce antes de borrar el avance (si no se puede leer, se pregunta antes de seguir); botón *Descargar resultados* en En vivo y en Puntajes. Nuevo `src/lib/results.ts` con pruebas.
- Pruebas nuevas del tester en `tests/db/qa-extra.test.ts` (Carrera de 20 grupos, calificación simultánea, 30 avisos a la vez, escalada de rol, reinicio). Total: 426 pruebas.
- `CLAUDE.md` al día (número de pruebas y vistas previas). Sin cambio: casillas de 22 px (el área tocable es la etiqueta de 44 px) y tabla ancha de `admin-forms` (se desplaza dentro de su contenedor).
- **Lectura de `matches`, `teams` y `bases` entre Carreras:** el hallazgo ya estaba resuelto por `0019`; no hace falta una `0021`. Se añadió una prueba que lo comprueba (corredor e inductor no leen nada de otra Carrera).

## Carrera de prueba con un usuario por grupo (2026-11-18)
- `carrera-de-prueba.xlsx` ahora trae **9 usuarios**: un corredor por grupo (`prueba.c1` … `prueba.c6`, el mismo que transmite el GPS) y 3 inductores, como en la Carrera real. Las pruebas (`simulacro.test.ts`, `bulk.test.ts`) se ajustaron a 9 usuarios.
- La guía [Prueba en vivo](Prueba-en-vivo) explica ahora los dos modos del coordinador (Preparación / En carrera) y que *Finalizar Carrera* reinicia el avance.

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
- **Tercera ejecución, P0 corregidos:** alerta de demora falsa para quien descansa una ronda (migración `0016`, aplicada el 2026-11-15); el perfil ya no se pierde con mala red (se reintenta y se guarda el último en el teléfono); activar y desactivar la Carrera piden confirmación.
- **Panel del coordinador en dos modos** (migración `0020`, aplicada el 2026-11-18): **Preparación** (crear la Carrera: pasos ordenados Grupos, Bases, Usuarios, Cruces y Activar, con su estado) y **En carrera** (solo lo que se mira mientras corre: En vivo, Puntajes y Mapa, sin nada para crear). El panel cambia solo de modo al activar o terminar la Carrera, y *En vivo* tiene el botón **Finalizar Carrera**. **Desactivar una Carrera reinicia todo su avance** (puntajes, llegadas, avisos, ubicaciones, registro de cambios) y conserva grupos, bases, usuarios y el cronograma.
- **Avisos que no se acumulan:** los avisos que ya cerraste no vuelven al recargar y solo se muestra el más reciente (cerrarlo cierra también los anteriores).
- **Notificaciones que siempre suenan:** cada aviso llega como una notificación nueva (etiqueta única) y antes se retiran las anteriores, para que cada una se comporte como la primera (antes, con una notificación sin quitar, la siguiente no sonaba o llegaba en bloque); duran 3 minutos en cola si el teléfono está lento y quedan en pantalla hasta leerlas; en la app, un aviso nuevo suena de inmediato aunque haya otro a la vista. **Límite:** el sonido de una notificación lo decide el teléfono (modo Concentración, silencio, notificaciones agrupadas); para no perder ninguna, dejar la app abierta con el sonido activado.
- **Ventanas emergentes bonitas:** todas las ventanas de confirmar o escribir un mensaje usan un diseño propio (tarjeta centrada en PC y hoja desde abajo en el celular, con icono, botones grandes y lista de lo que se va a enviar) en lugar de las del navegador.
- **Contraseñas chistosas:** las contraseñas sugeridas son dos palabras raras con letras por números (por ejemplo `D3lF1nZ4p4t0`), solo letras y números.
- **La campana** cambia de forma y se llena de oro mientras sus ajustes están abiertos, y *Cruces de tu base* muestra quién ganó cada ítem.
- **Pantallas por rol** (migración `0019`, aplicada el 2026-11-17): el corredor ya no ve puesto ni puntos de nadie (solo los suyos en *Top*), no tiene mapa de ruta y solo el usuario designado ve un mapa fijo para compartir ubicación; la base ya no ve ranking (equipos con foto y nombre) y recibe los avisos del coordinador con sonido; el coordinador ve el top 3 con marcos oro, plata y bronce, puede avisar a una base, el cronograma se arma a mano y un grupo necesita un solo usuario (pareja con usuario compartido). Los puntajes dejaron de ser legibles para quien no los necesita y cada Carrera es privada.
- **Eliminar Carrera** ahora borra **todo**: grupos, bases, cruces, puntajes, registro de cambios, avisos, ubicaciones, tiempos, fotos y usuarios; solo se puede con la Carrera desactivada (lo exige la base de datos). El menú *Preparar* del celular y las etiquetas del mapa (ya no se encimen) se corrigieron.
- **Ajustes de diseño tras la revisión** (migración `0018`, aplicada el 2026-11-17): nombre y @ junto a la foto o inicial en todas las cabeceras (menú de cuenta); la guía y las preguntas pasan a *Mi base*; el mapa de la base solo se abre al cambiar la ubicación; la campana de avisos recupera su tamaño (el relleno de los botones fantasma la aplastaba); *Después* con foto de la base y escudo del rival; entrada con textos nuevos y el logo legible en modo claro; foto de cada usuario desde *Usuarios*.
- **Rediseño "Marcador nocturno":** paleta nueva (azul noche, oro y papel cálido en modo claro), tarjeta azul destacada, cabecera del celular con un solo avatar y menú de cuenta, pestañas de vidrio, entrada partida en PC, En vivo con indicadores y la ronda como tabla, Carrera en dos columnas, **logo nuevo** (seis opciones en `/preview/logos`) y íconos de la app regenerados. Ver [Diseño](Diseno).
- **Modo claro / oscuro:** botón de sol / luna en todas las barras superiores; se guarda en el teléfono (ver [Diseño](Diseno)).
- **Eliminar Carrera** (Carrera > Eliminar esta Carrera): solo si está desactivada, escribiendo su nombre; borra grupos, bases, cruces, puntajes y tiempos, y opcionalmente a sus corredores e inductores. **Carrera de prueba** lista para cargar y guía de [Prueba en vivo](Prueba-en-vivo).
- **Mapa en vivo:** la posición de un grupo que lleva más de 1 hora sin actualizarse se quita del mapa (queda "Sin señal").
- **Tercera ejecución, resto de hallazgos corregidos** (migración `0017`, aplicada el 2026-11-15): alertas con la hora del servidor; el GPS recarga solo las posiciones (no toda la pantalla del coordinador); aviso de "sin conexión" y los datos se conservan ante un error de red; mensaje de entrada distinto si no hay red; cerrar sesión pide confirmación y quita las notificaciones del teléfono; Puntajes confirma antes de cambiar o borrar; recarga de teléfonos con retraso aleatorio; avisos con alcance y límite; auditoría sin ruido al borrar un inductor; comparación del secreto de push en tiempo constante; letra mínima de 12 px y mejor contraste.

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
