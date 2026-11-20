# Pantallas

Dónde vive cada información y por qué. El criterio es sencillo: **cada dato va en la pantalla donde se *usa*, en el momento en que se usa**, y lo que se toca poco (ajustes, preparación) no estorba lo que se mira todo el tiempo (la ronda en curso).

## Coordinador (`/admin`)

En el computador el menú lateral tiene dos grupos; en el celular la barra inferior muestra las pantallas en vivo y un botón **Preparar** que abre las de preparación.

El panel tiene **dos modos** que se eligen arriba del menú lateral: **Preparación** (crear la Carrera) y **En carrera** (verla correr). Cambia solo de modo al activar o terminar la Carrera; mientras corre, Preparación sigue disponible con un aviso. **Finalizar Carrera** (en *En vivo*) o desactivarla **reinicia todo su avance**, pero antes **descarga los resultados** (CSV con la clasificación y el detalle por cruce; también hay un botón *Descargar resultados* en *En vivo* y en *Puntajes*) (puntajes, llegadas, avisos, ubicaciones, registro) y conserva grupos, bases, usuarios y cronograma.

### Durante la Carrera (modo En carrera)
| Pantalla | Qué muestra | Para qué |
|---|---|---|
| **Control** (*En vivo*) | La **torre de control**: indicadores (ronda, vuelos en ruta, en puerta, aterrizados, demoras, radar), el **tablero de vuelos** (Flight Control), las **puertas** de la ronda con avisos a los grupos o a la base (Gate Management), las demoras en el traslado, el **registro de operaciones** (llegadas, cruces terminados y avisos) y el top. |
| **Pasaportes** (*Puntajes*) | Ranking completo, corrección o invalidación de cualquier ítem por cruce (de a una ronda) y el registro de cambios (plegable). | Corregir lo que envió una base y dejar rastro. |
| **Radar** (*Mapa*) | Mapa 3D con las bases y la posición de cada grupo; los grupos sin señal o en demora se marcan. Una posición que lleva **más de 1 hora sin actualizarse desaparece** del mapa (el grupo queda como "Sin señal"), así que si alguien olvida apagar el GPS no queda un punto fantasma al terminar la Carrera. | Ver dónde está cada grupo. |

### Preparación (modo Preparación)
*Carrera* abre con los **pasos para crear la Carrera**, en orden, cada uno con su estado: Grupos, Bases, Usuarios, Cruces y Activar.

| Pantalla | Qué muestra | Para qué |
|---|---|---|
| **Carrera** | Estado y lista de pendientes para activar, **carga desde un archivo** (Word/Excel, con una *Carrera de prueba* lista para ensayar), tiempo general y por tramo de las alertas, nueva edición y **eliminar la Carrera** (la desactivada, escribiendo su nombre; con la opción de borrar también a sus usuarios). | Dejar lista la Carrera. |
| **Grupos** | Nombre, foto y corredores (con el que transmite el GPS). | |
| **Bases** | Nombre, foto del lugar, información, 3 preguntas, inductores y ubicación (el mapa se abre solo si se necesita). | |
| **Cruces** | El cronograma se arma **a mano**, ronda por ronda (no hay generador automático); revisión (descansos, bases repetidas). | Armar y ajustar el cronograma. |
| **Inductores** | La lista de personas del **semestre** y sus pasaportes personales: elige o crea el semestre (nombre y temática), **sube el Excel** (Nombre, Carrera, Rol opcional) con vista previa, y recibe otro Excel con el @ y la contraseña de cada uno. En la lista: papel (corredor / base / coordinador), cultura, **grupo de dos** (o base), foto, nueva contraseña y eliminar. | Alguien nuevo, cambiar de papel, enlazar a su grupo. |
| **Usuarios** | Los de la Carrera elegida, cada uno con su **foto** (botón de cámara; reemplaza la inicial en su cabecera y en la lista) (más los coordinadores): crear, cambiar contraseña y eliminar. Los usuarios anteriores a esta regla aparecen en *Sin Carrera asignada* para adoptarlos o eliminarlos. Corredores e inductores se crean siempre dentro de una Carrera. | |

## Corredor (`/corredor`)
Una **barra de estado siempre visible** (el grupo, "En vivo" y **los puntos de su propio grupo**; **nunca el puesto ni los puntos de los demás**: nadie debe saber quién va ganando antes de que se anuncie) y tres pestañas (cuatro para el usuario designado del GPS). Un grupo puede compartir **un solo usuario** entre la pareja de corredores.

| Pestaña | Contenido |
|---|---|
| **Visado** | Avisos de demora y del coordinador, y el **destino** de la ronda actual: la foto de la base a gran formato con su puerta, código de aeropuerto y estado, el rival, las **tres etapas** (barra, pregunta, minijuego) con quién ganó cada una y el sello esperando; abajo el **próximo destino** como tarjeta de embarque. Cuando la base califica la tercera etapa con la app abierta, el sello cae en pantalla. |
| **Ubicación** *(solo el usuario designado)* | Un mapa **fijo** (no se mueve ni se acerca) con las bases y la posición del grupo, que se actualiza, y el botón para **compartir la ubicación** con el coordinador. No hay mapa de ruta: los corredores saben llegar. |
| **Pasaporte** | La portada se ve cada vez que se abre la pestaña y se abre al tocarla. Todas las páginas miden lo mismo y se pasan deslizando (sin botones). Página de identidad (equipo, vuelo, mapa del recorrido, progreso del viaje, itinerario) y páginas de sellos (cuatro destinos cada una): completado, disponible o en puerta, pendiente y descanso. Tocar un sello completado abre sus tres etapas. Un sello se gana al calificarse las tres etapas. Solo usa datos que el corredor ya leía de sus cruces. |
| **Top** | El **mismo ticket de pasajero** de Visado (nombre, en vivo y puntos) y, bajo una tarjeta blanca con el título, **los demás equipos** solo con foto y nombre (sin puntos y en orden alfabético). La tarjeta de pasajero solo está en Visado y en Top. |

Los ajustes de **sonido y notificaciones** están en la campana de la barra superior (campana tachada con un punto si el sonido está apagado; el panel se abre sobre la pantalla). Sin Carrera activa para su usuario se ve una explicación tranquila ("No hay ninguna Carrera activa para tu usuario").

## Pasaporte personal (`/pasaporte`)
Lo que ve un inductor al entrar con su @ personal (sin acceso a la operación; el grupo o la base entra con su propio usuario). Un pasaporte que se abre al tocar la cubierta, con tres versiones: **corredor** (papel, su grupo y con quién corre), **base** (mostrador azul, su base) y **coordinador** (torre de control, siempre oscura). Páginas: identidad (foto que sube el coordinador, carrera, cultura, papel, grupo o base, @, documento), **sellos** (el visado de entrada de su cultura y un sello por cada base visitada o atendida, o por cada Carrera coordinada) e **historial** de semestres. Cada carrera recibe una **cultura** de la temática del semestre y el pasaporte se viste con ella: color, borde de las páginas y emblema. Se actualiza solo cuando una Carrera empieza o termina.

## Entrada (`/login`)
La foto del campus arriba (con la de noche en modo oscuro), un velo oscuro en la parte de abajo de la foto y el formulario como tarjeta de embarque. Arriba a la izquierda, el escudo y el nombre CarreApp en blanco, quietos.

## Base (`/base`)
| Pestaña | Contenido |
|---|---|
| **Ronda** | Avisos de demora y **avisos del coordinador** (con sonido); el pase azul de la **ventanilla de visado** (foto y nombre de la base, código de aeropuerto y, en el talón, cuántos visados lleva sellados); el cruce actual como **mostrador** (puerta, estado, el sello de la base, los tres pasos *Llegada · Etapas · Sello*, los dos grupos como pasajeros con su vuelo, confirmar llegada, *Apurar a los grupos* y calificar) y la **próxima ronda** como otro pase. Al terminar todos los cruces, la tarjeta *Ventanilla cerrada*. |
| **Resultados** | El mismo pase y, bajo pestañas blancas de carpeta, *Equipos de la Carrera* (foto y nombre, **sin puntos**) y *Cruces de tu base*: el historial de lo que ha calificado. |
| **Mi base** | El espacio informativo del inductor, en pestañas de carpeta: **lo que se explica** en la base, las **posibles preguntas**, y *Dónde queda* (el sello de la base, la foto y la ubicación). El mapa solo se abre al pulsar *Cambiar ubicación* (o si la base aún no tiene ubicación). |

**Identidad:** el inductor es el **oficial de migración** de la Carrera y la pantalla es su ventanilla. Comparte el lenguaje del corredor (pase azul marino, pestañas de carpeta, barra flotante, fondo con el patrón, transición entre pestañas, campana y cuenta de la barra superior) y suma lo suyo: la **tinta del sello de cada base** (sale del id de la base, igual que el sello) es el acento de la pantalla: borde del mostrador, números de etapa y de ronda. Así cada base se reconoce a simple vista.

La campana de la barra superior abre los ajustes de **sonido y notificaciones**, para que el teléfono suene cuando el coordinador avise a la base. Si la Carrera no está activa para su usuario, la pantalla lo explica y, si intenta calificar, el mensaje dice que la Carrera no está activa.

## Qué se movió en la revisión y por qué
- **Resumen → En vivo + Carrera.** "Resumen" mezclaba el estado en vivo con ajustes, carga de archivos y creación de ediciones. Lo que se prepara una vez pasó a *Carrera*; lo que se mira cada minuto quedó en *En vivo*.
- **Demoras:** estaban repetidas en Cruces y en Mapa; ahora hay una sola lista (En vivo) y el Mapa solo marca a los grupos en demora.
- **Cruces** quedó solo para armar el cronograma; el estado en vivo de cada cruce está en *En vivo*.
- **Bases:** un mapa por tarjeta agotaba los contextos WebGL del navegador con muchas bases; ahora el mapa se abre bajo demanda.
- **Corredor:** los interruptores de sonido y notificaciones salieron de *Ronda* (campana en la barra) y los resultados de rondas pasadas salieron de *Ronda* hacia *Ruta* (cada ronda terminada se abre).
- **Base:** la información y las preguntas pasaron de *Mi base* a la **Guía** dentro de *Ronda*; *Top* y *Terminados* se unieron en **Resultados**.
- **Puntajes:** el registro de cambios es plegable.

## Cómo decidir dónde poner algo nuevo
1. ¿Quién lo usa y **cuándo**? Si es durante la ronda, va en la pantalla de la ronda; si es de preparación, en la sección de preparación.
2. ¿Con qué **frecuencia**? Lo que se toca una vez (ajustes) no debe ocupar espacio de lo que se mira siempre.
3. ¿Ya existe en otro lado? Duplicar información obliga a mantener dos copias: mejor un solo lugar y un enlace.
4. ¿Cabe en el celular? Si no, plegable o aparte.
