# Diseño

Guía visual de CarreApp. Sirve para que cualquier pantalla nueva se vea igual que las demás sin tener que adivinar.

## Idea
Un **marcador de carrera**: fondo azul noche, **dorado** como color de marca y azul cielo para información. Pensado para el celular al aire libre: contraste alto, botones grandes y poca decoración. Sin emojis: todos los iconos son SVG de línea (librería Lucide) y los grupos sin foto muestran sus **iniciales**.

## Logo
Una **C** dorada (la Carrera) con una **aguja de brújula** azul en su interior (la ruta que hay que seguir). Archivos en `public/`: `logo.svg`, `favicon.svg` y los PNG de la app instalada (`pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`). El componente `Logo` dibuja la marca y el nombre "Carre**App**".

## Paleta
| Uso | Color | Variable |
|---|---|---|
| Fondo | `#0A1020` | `--bg` |
| Tarjetas | `#111A2E` | `--surface` |
| Elementos elevados | `#172240` / `#1F2D52` | `--surface-2` / `--surface-3` |
| Campos (hundidos) | `#0D1528` | `--inset` |
| Bordes | `#223052` / `#33466F` | `--border` / `--border-strong` |
| Texto | `#EDF1FA` · suave `#9AA8C7` · tenue `#6F7EA3` | `--text`, `--text-muted`, `--text-faint` |
| **Marca (acciones principales)** | `#F2B632` | `--gold` |
| Información, enlaces, foco | `#6CB0FF` | `--sky` |
| Éxito / en vivo | `#3DD6A0` | `--ok` |
| Advertencia | `#FF9F43` | `--warn` |
| Error / eliminar | `#FF6B6B` | `--danger` |

Los fondos de avisos y etiquetas se derivan del color con `color-mix`, así siempre combinan.

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
