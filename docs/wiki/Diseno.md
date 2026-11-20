# Diseño

Guía visual de CarreApp. Sirve para que cualquier pantalla nueva se vea igual que las demás sin tener que adivinar.

## Idea · "Visado": un mismo universo, dos experiencias
**Un viaje internacional.** Cada grupo es un vuelo, cada base es un destino con puerta y código de aeropuerto, y el pasaporte es la prueba del viaje. Un mismo lenguaje (sellos, códigos de tres letras, indicativos de vuelo, el escudo de la Universidad) y dos experiencias distintas:

- **Corredores: viajeros.** Papel limpio (sin tramas de fondo), portada azul con **lámina dorada**, fotografías inmersivas y un pasaporte digital con **los sellos de las bases**. **Claro por defecto** (el papel se lee mejor al sol) y un modo oscuro "pasaporte de noche".
- **Coordinador: torre de control.** Un centro de operaciones **siempre oscuro** (sin importar el modo de la app), con rejilla de cartografía, radar, tablero de vuelos y colores de instrumento (verde radar, ámbar, cian, rojo). Las mismas variables de color de siempre, con otros valores dentro de `.tower`.

Sin emojis: iconos de línea (Lucide) y escudos con iniciales. Sin fuentes nuevas. Todo el vocabulario aeroportuario sale de datos reales (grupos, bases, cruces), nunca se guarda ni se inventa: `src/lib/flight.ts`.

### El vocabulario del viaje (`src/lib/flight.ts`)
- **Destino:** cada base tiene un código de tres letras ("Biblioteca" → BIB, "Cancha de Fútbol" → CFU) y su **puerta** es el número de la ronda.
- **Vuelo:** cada grupo tiene un indicativo (`JV 200`, `JV 213`…), asignado por el orden alfabético de los nombres de los grupos de la Carrera: es el mismo en el teléfono del corredor y en el panel del coordinador.
- **Estado de un vuelo:** *en ruta* (va hacia su base), *en puerta* (la base confirmó su llegada), *aterrizado* (terminó todos sus cruces) o *demora* (tarda más de lo permitido en llegar: es la misma regla de las alertas). Se calcula de los cruces; no se guarda.
- **Las tres etapas** de un destino (barra, pregunta, minijuego) están hechas cuando la base las calificó (gane quien gane, o invalidada). **Cuando las tres están hechas el cruce termina y el grupo recibe el sello**: no se tocó la lógica de validación.

### Qué se repite en todas las pantallas
- **Sin tramas ni círculos de fondo:** se retiraron las rosetas (el diseño pide fondos limpios).
- **Lámina dorada** (`--foil`): línea bajo la cabecera, borde inferior de la portada del corredor, de la oficina de control y de las tarjetas destacadas, y título de la entrada.
- **Etiquetas de campo** en monoespaciada del sistema y mayúsculas (como los campos de un documento): `h3`, `.eyebrow`, etiquetas de formulario, indicadores. Las **líneas de lectura** (`Mrz`) cierran la entrada y el pasaporte con datos reales (grupo, sellos, rondas).
- **Perforación de estampilla** en el borde inferior de la foto del visado y alrededor de las miniaturas ("Próximo visado").
- **Pestañas:** la activa lleva una cinta azul con el icono dorado.

### El sello (`src/components/Stamp.tsx`, `src/lib/stamp.ts`)
- **Único por base:** su foto impresa en una sola tinta (filtro SVG: lo oscuro toma la tinta, lo claro queda papel), su nombre, su **código de aeropuerto**, un **símbolo** de qué lugar es (libro para la biblioteca, balón para la cancha, templo para la capilla…; se lee del nombre y, si no hay coincidencia, sale del identificador), una **forma** (círculo, hexágono, octógono o cuadrado), una **tinta** (`--ink-1` a `--ink-5`), una **composición** (el nombre alrededor de la foto o sobre una banda) y la inclinación. Es el mismo sello en el pasaporte del corredor, en *Mi base* y en *Puertas* del coordinador.
- **Estados:** **completo** (las tres etapas calificadas: sello con lámina y check), **en ruta** / **en puerta** (contorno punteado que respira), **pendiente** (el número de la ronda y el código del destino) y **descanso**.
- Al calificar la base la tercera etapa con la app abierta: **momento del sello** (`StampMoment`): el sello cae con un golpe, el teléfono vibra una vez y se cierra solo o al tocar.

### El pasaporte (`src/components/Passport.tsx`, `RouteMap.tsx`)
**Portada** azul con lámina, el escudo, el nombre del grupo y su vuelo: se abre sola (o al tocarla) con una animación de tapa. **Página de identidad:** escudo, equipo, vuelo, destinos y sellos, el **mapa del recorrido** (cada base en su posición real, unidas en el orden de las rondas; tramo completo sólido, el resto punteado, el avión espera en el último destino completado), la barra de progreso del viaje y el itinerario con el estado de cada destino. **Páginas de sellos:** cuatro destinos por página (completado, disponible/en puerta, pendiente, descanso), con paso de página 3D y deslizamiento; tocar un sello completado abre sus tres etapas.

### Tarjeta de destino (pestaña *Visado* del corredor)
La foto de la base ocupa la tarjeta (4:5) con la **señalética**: puerta, código de aeropuerto y estado (*Disponible*, *En puerta*, *En juego*); debajo, el rival, las **tres etapas** como un trayecto (con quién ganó cada una) y el sello esperando. El destino siguiente es una **tarjeta de embarque**.

### Torre de control (coordinador)
- **Live Monitoring** (indicadores): ronda, vuelos en ruta, en puerta, aterrizados, demoras y vuelos con GPS.
- **Flight Control** (tablero de vuelos): indicativo, grupo, destino, puerta, estado, destinos completados y hora del último sello.
- **Gate Management** (puertas): las bases de la ronda con su código, y la pantalla *Puertas* (antes *Bases*).
- **Passport Verification** (*Pasaportes*): una celda por destino de cada vuelo con su estado, y la corrección de resultados de siempre.
- **Operations Log** (registro de operaciones): llegadas confirmadas, cruces terminados y avisos enviados, solo con registros reales.
- **Flight Radar** (*Radar*): el mapa nocturno con retícula y barrido de radar; cada grupo lleva su indicativo.
- Menú con el escudo de la Universidad, la marca y la **hora local** (corregida con la del servidor).

### Entrada
El login es **la foto del campus a pantalla completa** (`public/campus.jpg` y `campus-800.jpg` para teléfonos), el logo de CarreApp arriba a la izquierda (frente al interruptor de modo claro u oscuro), la frase "Un sello por cada base que alcances" y el formulario como una **tarjeta de embarque** (PUJ → 2710, perforación con talón, código de barras y líneas de lectura). **En el celular cabe entera, sin scroll** (100dvh): si la pantalla es baja, la tarjeta se compacta (sin código de barras y, en las muy bajas, sin talón). En PC, la foto a la izquierda y la tarjeta a la derecha. Ya no aparece la palabra "Pasaporte" en el login.

### Movimiento
CSS puro, sin librerías. Cambiar de pestaña = **pasar la página** (transición de vista de 150 a 240 ms con la API View Transitions, con las barras de navegación fuera de la animación; sin ella o con "reducir movimiento" el cambio es inmediato). Entradas de 350 a 700 ms con desaceleración; el sello y su momento son lo único con rebote corto. Todos los `@keyframes` solo describen el inicio, así que con "reducir movimiento" cada elemento queda en su estado final (regla global en `index.css`, vigilada por `tests/static/visado.test.ts`).

## El pasaporte personal: general y por inducción
El pasaporte del inductor (`MemberPassport`) reutiliza el cuaderno, la cubierta y las páginas del pasaporte del grupo. **Es el pasaporte de toda la vida de la persona en la inducción**, así que tiene dos capas: lo **general** (la cubierta y la página de identidad, con el **símbolo de su carrera**, `CareerEmblem`: cinco símbolos y el nombre de la carrera; sin temática, comité, papel ni pareja) y lo **de cada inducción**, vestido con la cultura que le tocó en la temática de *esa* inducción (`lib/themes.ts`): una **tinta** (`--culture-ink`), un **borde** de página (runas, greca, escalones, nubes, loto: `CultureOrnament`) y la marca de su cultura. Una temática que la app no conoce sale con páginas neutras (estrella, borde de puntos) y su propio nombre. Se ve igual para todos: no hay versiones por papel ni torre de control.
**La marca de cada cultura (`CultureEmblem`) es un dibujo del lugar de esa cultura** (un drakkar, un templo, una pirámide escalonada, una pagoda, las pirámides con el sol) y **nunca repite las figuras de los sellos de las bases** (dioses y criaturas). Los sellos redondos (`Seals.tsx`) llevan su dibujo y su texto en los anillos.
Cada **comité** tiene su sello (`CommitteeSeal`, con la mitología de la temática, una tinta cada uno): Clausura (la bata de Homero, azul), Meraki (Psique como mariposa, violeta), Conzumo (la copa de Dionisio, rojo), Carrera (el corredor en la corona de laurel, verde) y Caos (el fuego de Prometeo, ámbar). El **coordinador** del comité tiene el mismo dibujo **dorado** (degradado `--foil-a..d`) con una corona de rayos. El **sello dorado con foto** (`PhotoSeal`) imprime en oro la foto del grupo de un corredor o de la base de quien la atiende. El **símbolo personal** es un ícono de una lista (`lib/symbols.ts`), no un emoji.
Después de las páginas de cada inducción van páginas en blanco, como un pasaporte de verdad. El **PDF de recuerdo** (`lib/passportPdf.ts`) dibuja las mismas páginas con colores fijos y claros (el papel), sin leer las variables del tema, porque se arma fuera de la página.

## Logo
El **escudo** (versión del logo elegida el 2026-11-18, sin la C ni la brújula anteriores). El **ícono de la app no lleva texto**: escudo en lámina dorada sobre el azul de la app, que es la portada del pasaporte. Archivos de la app en `public/`: `crest-dorado.svg` (portada del pasaporte), `crest-simple.svg` y `wordmark.svg` (se pintan con máscara en el componente `Logo`, del color del lugar: `--logo-ink`, blanco sobre las portadas azules), `favicon.svg` y los PNG (`pwa-192`, `pwa-512`, `pwa-maskable-512`, `apple-touch-icon`, `favicon`). Todos los formatos (isotipo, logotipo, imagotipo, isologo para impresos, versiones azul, blanca y dorada) están en `docs/logo/final/` con sus reglas de uso. **Importante:** este escudo es una reinterpretación, no el escudo oficial de la Universidad; conviene confirmar con ella que aprueba esta versión. Para volver a la brújula anterior hay que cambiar esos archivos y el componente `Logo`.

## Paleta · papel y pasaporte de noche
Todos los colores son variables en `src/index.css`. **Claro** = papel de seguridad (azul grisáceo muy pálido con tinta azul marino); **oscuro** = "pasaporte de noche".

| Uso | Claro (por defecto) | Oscuro | Variable |
|---|---|---|---|
| Fondo | `#E8ECF4` | `#060A1B` | `--bg` |
| Páginas (tarjetas) | `#FAFBFD` | `#0D1430` | `--surface` |
| Elevados | `#EEF1F8` / `#DFE5F1` | `#141D44` / `#1D2A5A` | `--surface-2` / `--surface-3` |
| Campos | `#FFFFFF` | `#090F26` | `--inset` |
| Texto · suave · tenue | `#0C1740` · `#404C78` · `#525E88` | `#EEF2FF` · `#A9B6DB` · `#93A1CC` | `--text`, `--text-muted`, `--text-faint` |
| **Marca (botones)** | `#FFC53D` | `#FFC53D` | `--gold` |
| Oro como texto | `#7A5000` | `#FFC53D` | `--gold-ink` |
| Información, foco | `#1A4DC0` | `#66B3FF` | `--sky` |
| Éxito / en vivo | `#066543` | `#3BDDA8` | `--ok` |
| Advertencia · error | `#8F4300` · `#A71C26` | `#FFAC52` · `#FF7080` | `--warn`, `--danger` |
| **Portada** (marcador, entrada, oficina) | `#234BB5 → #0C1C55` | igual | `--hero-a`, `--hero-b` |
| **Tintas de los sellos** (una por base) | `#1F49B8 #B3261E #1B7A52 #6A3FA0 #A85A00` | `#86ADFF #FF8F86 #62E3AC #C7A6FF #FFB862` | `--ink-1` … `--ink-5` |
| **Lámina dorada** | degradado dorado | igual | `--foil` |

Los fondos de avisos y etiquetas se derivan con `color-mix`. Todos los pares de texto cumplen contraste AA (4,5:1) en los dos modos (`tests/static/theme-contrast.test.ts`); los sellos son decorativos y llevan `aria-label` con el nombre de la base, la ronda y la hora.

### Rasgos del diseño
- **Una tarjeta azul profunda por pantalla** (el marcador del corredor, el indicador principal del coordinador, el panel de entrada) ancla la marca; el resto son superficies tranquilas con sombra suave.
- **Celular (corredor y base):** cabecera limpia con el logo y **un solo avatar** (menú con modo claro/oscuro y cerrar sesión), marcador en grande, pestañas inferiores de vidrio con una pastilla dorada en la activa, objetivos táctiles de 44 px o más y márgenes seguros del iPhone.
- **PC (coordinador):** menú lateral de 272 px con la Carrera activa arriba, contenido de hasta 1320 px, **indicadores arriba** (ronda, cruces, demoras, ubicación) y la ronda como **tabla** (base, cruce, estado, marcador y aviso) con el ranking y las demoras al lado. La entrada es una pantalla partida: marca a la izquierda, formulario a la derecha.
- **Tipografía:** Archivo condensado y en mayúsculas para títulos y marcadores, Archivo normal para el texto y la monoespaciada del sistema para etiquetas de campo y líneas de lectura.

### Logo
La galería de seis opciones se retiró: el logo es el escudo (ver arriba).

### Modo claro y oscuro
Cada persona elige su modo con el botón de **sol / luna** de la barra superior (corredor, base, coordinador y pantalla de entrada). La elección se guarda en el teléfono (`localStorage`, clave `carreapp.theme`); la primera vez la app es **clara** (el papel); el oscuro es el "pasaporte de noche". Un pequeño script de `index.html` aplica el modo guardado antes de pintar, así no hay parpadeo, y el color de la barra del navegador (`theme-color`) cambia con él.

- La paleta clara está en `:root[data-theme='light']` (`src/index.css`) con **las mismas variables** que la oscura: los componentes no saben en qué modo están.
- El dorado de marca sigue en los botones; **como texto** se usa `--gold-ink`, que en modo claro es un ámbar oscuro (el dorado sobre blanco no se lee). Los colores de estado (`--sky`, `--ok`, `--warn`, `--danger`) también son más profundos en modo claro.
- Las pruebas exigen que ambas paletas definan las mismas variables y que todos los colores de texto tengan contraste AA (4,5:1) sobre `--bg`, `--surface` y `--surface-2` en los dos modos.
- El mapa del coordinador pasa de *dusk* (oscuro) a *day* (claro) según el modo; el del corredor sigue en *day*.
- Lógica en `src/lib/theme.ts` (`useTheme`) y `src/components/ThemeToggle.tsx`.

## Tipografía
**Archivo** (variable, se sirve desde la propia app, sin depender de internet). Los titulares usan la versión **condensada** en peso 800; el texto, ancho normal. Los números del marcador usan cifras tabulares. Campos de 16 px o más (evita el zoom automático de iOS).

## Componentes (en `src/index.css` y `src/components/`)
- **Botones:** dorado (acción principal), `ghost` (secundaria), `danger` (eliminar), `icon-btn` (solo icono, 44 px). Acciones principales de 52–56 px.
- **Tarjetas** `card`, **listas** con líneas finas, **etiquetas** `badge`/`chip`, **avisos** `warn` / `ok-box` / `fail-box` (con icono automático).
- **Escudo** `Crest` (foto o iniciales), **Ranking** (posición, escudo, nombre, puntos), **Marcador** del corredor siempre visible, **pestañas inferiores** `BottomNav` (corredor y base) y menú lateral / pestañas del coordinador `AdminNav`.
- **Navegación del coordinador:** menú lateral en dos grupos (*Durante la Carrera* y *Preparación*); en el celular, barra inferior con las pantallas en vivo y un botón *Preparar* que abre las de preparación.
- **Mapa:** marcadores propios (base azul con bandera, grupo con su escudo y borde dorado, destino dorado pulsante, tú en azul).

## Reglas para pantallas nuevas
1. Solo variables de color de `:root`; nada de colores sueltos.
2. Sin emojis: iconos de `lucide-react` (22 px en pestañas, 18–20 px en botones).
3. Objetivos táctiles de al menos 44 px; texto de al menos 16 px en campos.
4. Probar en 390 px de ancho (celular) y 1280 px (computador): nada debe desbordarse ni pisarse.

## Vista previa del diseño
En desarrollo (`npm run dev`) existe `/preview/<pantalla>` que muestra los componentes reales con datos de ejemplo, sin iniciar sesión: `runner` (Visado), `runner-ruta` (Pasaporte con portada y páginas), `runner-top`, `runner-sello` (el momento del sello), `sellos` (galería de sellos y estados), `base`, `base-info`, `admin`, `admin-forms`, `map`. La entrada se ve en `/login`. No se incluye en la versión publicada.
