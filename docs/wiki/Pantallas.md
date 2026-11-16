# Pantallas

Dónde vive cada información y por qué. El criterio es sencillo: **cada dato va en la pantalla donde se *usa*, en el momento en que se usa**, y lo que se toca poco (ajustes, preparación) no estorba lo que se mira todo el tiempo (la ronda en curso).

## Coordinador (`/admin`)

En el computador el menú lateral tiene dos grupos; en el celular la barra inferior muestra las pantallas en vivo y un botón **Preparar** que abre las de preparación.

### Durante la Carrera
| Pantalla | Qué muestra | Para qué |
|---|---|---|
| **En vivo** | La ronda en curso (cada cruce con su estado, marcador, ítems y hora de llegada), las **demoras en el traslado** con el botón *Avisar*, el top 3 y cuántos grupos comparten su ubicación. Si la Carrera está en borrador, avisa qué falta y lleva a *Carrera*. | Es el tablero de control: todo lo que cambia mientras se juega, en un solo lugar. |
| **Puntajes** | Ranking completo, corrección o invalidación de cualquier ítem por cruce (de a una ronda) y el registro de cambios (plegable). | Corregir lo que envió una base y dejar rastro. |
| **Mapa** | Mapa 3D con las bases y la posición de cada grupo; los grupos sin señal o en demora se marcan. | Ver dónde está cada grupo. |

### Preparación
| Pantalla | Qué muestra | Para qué |
|---|---|---|
| **Carrera** | Estado y lista de pendientes para activar, **carga desde un archivo** (Word/Excel), tiempo general y por tramo de las alertas, y nueva edición. | Dejar lista la Carrera. |
| **Grupos** | Nombre, foto y corredores (con el que transmite el GPS). | |
| **Bases** | Nombre, foto del lugar, información, 3 preguntas, inductores y ubicación (el mapa se abre solo si se necesita). | |
| **Cruces** | Generador del cronograma, revisión (descansos, bases repetidas) y edición ronda por ronda. | Armar y ajustar el cronograma. |
| **Usuarios** | Los de la Carrera elegida (más los coordinadores): crear, cambiar contraseña y eliminar. Los usuarios anteriores a esta regla aparecen en *Sin Carrera asignada* para adoptarlos o eliminarlos. Corredores e inductores se crean siempre dentro de una Carrera. | |

## Corredor (`/corredor`)
Una **barra de estado siempre visible** (grupo, puesto y puntos en vivo) y cuatro pestañas:

| Pestaña | Contenido |
|---|---|
| **Ronda** | Avisos de demora y del coordinador, la ronda actual (base con foto, rival y resultados que la base ha calificado ítem por ítem) y la que viene después. |
| **Mapa** | Ruta a pie a la siguiente base (y, para el corredor designado, compartir la ubicación). |
| **Ruta** | Todas sus rondas; cada ronda terminada se abre para ver el resultado ítem por ítem. |
| **Top** | Ranking con su grupo resaltado. |

Los ajustes de **sonido y notificaciones** están en la campana de la barra superior (con un punto si el sonido está apagado): se configuran una vez y no estorban la ronda.

## Base (`/base`)
| Pestaña | Contenido |
|---|---|
| **Ronda** | Avisos de demora, el cruce actual (confirmar llegada, *Apurar a los grupos*, calificar), el próximo y la **guía de la base** (información y preguntas) plegable: se necesita justo mientras se califica. |
| **Resultados** | Top equipos y los cruces ya terminados de la base. |
| **Mi base** | Foto y ubicación en el mapa (se cambian solo si la base se mueve). |

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
