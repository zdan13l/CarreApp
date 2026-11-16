# Diseño

Guía visual de CarreApp. Sirve para que cualquier pantalla nueva se vea igual que las demás sin tener que adivinar.

## Idea
Un **marcador de carrera**: fondo azul noche, **dorado** como color de marca y azul cielo para información. Pensado para el celular al aire libre: contraste alto, botones grandes y poca decoración. Sin emojis: todos los iconos son SVG de línea (librería Lucide) y los grupos sin foto muestran sus **iniciales**.

## Logo
Una **C** dorada (la Carrera) con una **aguja de brújula** azul en su interior (la ruta que hay que seguir). Archivos en `public/`: `logo.svg`, `favicon.svg` y los PNG de la app instalada (`pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`). El componente `Logo` dibuja la marca y el nombre "Carre**App**".

## Paleta · "Marcador nocturno"
Azul noche con el oro de la Javeriana, como el marcador de un estadio de noche; en modo claro, papel cálido con tinta azul. Todos los colores son variables en `src/index.css`.

| Uso | Oscuro | Claro | Variable |
|---|---|---|---|
| Fondo | `#070B18` | `#F4F2EC` | `--bg` |
| Tarjetas | `#0E1630` | `#FFFFFF` | `--surface` |
| Elevados | `#152045` / `#1E2C5C` | `#F0EDE4` / `#E6E2D6` | `--surface-2` / `--surface-3` |
| Campos | `#0A1128` | `#EDEAE0` | `--inset` |
| Texto · suave · tenue | `#EEF2FF` · `#A9B6DB` · `#93A1CC` | `#0D1633` · `#465073` · `#566083` | `--text`, `--text-muted`, `--text-faint` |
| **Marca (botones)** | `#FFC53D` | `#FFC53D` | `--gold` |
| Oro como texto | `#FFC53D` | `#7C4F00` | `--gold-ink` |
| Información, foco | `#66B3FF` | `#1A57C8` | `--sky` |
| Éxito / en vivo | `#3BDDA8` | `#08694A` | `--ok` |
| Advertencia | `#FFAC52` | `#8F4300` | `--warn` |
| Error / eliminar | `#FF7080` | `#A71C26` | `--danger` |
| **Tarjeta destacada** (marcador, KPI, entrada) | `#234BB5 → #0C1C55` | igual | `--hero-a`, `--hero-b` |

Los fondos de avisos y etiquetas se derivan del color con `color-mix`, así siempre combinan. Todos los pares de texto cumplen contraste AA (4,5:1) en los dos modos y las pruebas lo vigilan (`tests/static/theme-contrast.test.ts`).

### Rasgos del diseño
- **Una tarjeta azul profunda por pantalla** (el marcador del corredor, el indicador principal del coordinador, el panel de entrada) ancla la marca; el resto son superficies tranquilas con sombra suave.
- **Celular (corredor y base):** cabecera limpia con el logo y **un solo avatar** (menú con modo claro/oscuro y cerrar sesión), marcador en grande, pestañas inferiores de vidrio con una pastilla dorada en la activa, objetivos táctiles de 44 px o más y márgenes seguros del iPhone.
- **PC (coordinador):** menú lateral de 272 px con la Carrera activa arriba, contenido de hasta 1320 px, **indicadores arriba** (ronda, cruces, demoras, ubicación) y la ronda como **tabla** (base, cruce, estado, marcador y aviso) con el ranking y las demoras al lado. La entrada es una pantalla partida: marca a la izquierda, formulario a la derecha.
- **Tipografía:** Archivo condensado y en mayúsculas para títulos y marcadores (carácter deportivo), Archivo normal para el texto.

### Logo
Seis opciones listas (`src/components/logos.tsx`, galería en `/preview/logos`): **Brújula** (en uso: una C dorada con la aguja azul que marca el camino), C con destino, Podio, Pista, Bandera y Doble paso. Cambiar de logo es cambiar `LOGO_VARIANT` en `src/components/Logo.tsx`. Los íconos de la app (favicon, iPhone, PWA) se generan con el mismo dibujo; si cambias de logo hay que regenerarlos.

### Modo claro y oscuro
Cada persona elige su modo con el botón de **sol / luna** de la barra superior (corredor, base, coordinador y pantalla de entrada). La elección se guarda en el teléfono (`localStorage`, clave `carreapp.theme`); la primera vez la app es **oscura**, como siempre. Un pequeño script de `index.html` aplica el modo guardado antes de pintar, así no hay parpadeo, y el color de la barra del navegador (`theme-color`) cambia con él.

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
En desarrollo (`npm run dev`) existe `/preview/<pantalla>` que muestra los componentes reales con datos de ejemplo, sin iniciar sesión: `runner`, `runner-ruta`, `runner-top`, `base`, `base-info`, `admin`, `admin-forms`, `map`. No se incluye en la versión publicada.
