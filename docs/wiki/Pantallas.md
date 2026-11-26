# Pantallas

Dónde vive cada información y por qué. El criterio es sencillo: **cada dato va en la pantalla donde se *usa*, en el momento en que se usa**, y lo que se toca poco (ajustes, preparación) no estorba lo que se mira todo el tiempo (la ronda en curso).

## Coordinador (`/admin`)

**El menú lateral muestra un nivel a la vez** (así nadie se pierde): fuera de una carrera ve *Todas las carreras*, el *Historial de resultados* y la *Administración global* (Inductores, Grupos organizativos, Comités, Generaciones, Insignias y **Sellos**, el taller donde se crean todos los sellos); **dentro de una carrera no aparece la administración global**: solo esa carrera, con un enlace para volver a *Todas las carreras*. El menú de una carrera tiene tres partes que siguen su vida: **Resumen y control** (siempre), **Preparación** (8 pasos numerados en el orden en que se hacen: 1 Configuración, 2 Temática, 3 Grupos participantes, 4 Bases, 5 Cruces, 6 Coordi y comités, 7 Inductores, 8 Usuarios) y **En carrera** (Puntajes y Radar). Antes de iniciar, Preparación está abierta y En carrera plegada («al iniciar»); desde que corre es al revés y Preparación queda plegada («protegida mientras corre»); el grupo de la página donde estás siempre se ve. No hay barra de pestañas arriba: en el celular solo una línea con el código, el nombre y el estado. Cada pantalla dice en su cabecera su lugar («Preparación · 3») y se llama igual que en el menú.

**Aspecto del panel:** sigue el modo claro / oscuro y habla el idioma del corredor y la base: mostrador azul marino, pases de abordar (carrera, puertas, indicadores), tablero de salidas azul marino para los vuelos y lámina dorada; ver Diseno.md.

**Resumen y control según el momento:** mientras la carrera se prepara (Deshabilitada o Habilitada) es **la lista de pasos y pendientes** (los mismos 8 pasos del menú, los obligatorios con círculo, y qué falta para habilitar) con el control de estado; desde que inicia es **la torre de control** (indicadores, tablero de vuelos, puertas, demoras, registro y top). *Configuración* solo tiene ajustes (carga desde un archivo y tiempos de traslado): nada del estado ni de los pendientes, que viven en un solo lugar.

**Sellos (taller global):** se elige *para qué* es el sello (generación, temática, subtemática, base o comité; los grupos no llevan sello: los representa su insignia) y, salvo las generaciones (permanentes), *la inducción* a la que pertenece; el sello solo vale en esa carrera. Las secciones de cada carrera (Temática, Bases, Coordi y comités) y Generaciones **solo muestran** los sellos de su sección, con un botón al taller.

**Finalizar Carrera** (en *En vivo*) o desactivarla **reinicia todo su avance**, pero antes **descarga los resultados** (CSV con la clasificación y el detalle por cruce; también hay un botón *Descargar resultados* en *En vivo* y en *Puntajes*) (puntajes, llegadas, avisos, ubicaciones, registro) y conserva grupos, bases, usuarios y cronograma.

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
| **Inductores** (dos vistas: *global* = el único lugar donde se registra una persona; *dentro de una carrera* = solo agrega o quita personas ya registradas de esa carrera) | **Global:** «¿Qué es un inductor?», dos botones —**Registrar inductor/a nuevo** (nombre, @, apodo, carrera, otra carrera si hace doble programa, generación [el ingreso sale solo] y canción) y **Carga masiva con Excel** (plantilla, generación por defecto, canciones buscadas y escuchadas, Excel de usuarios y contraseñas)— y **Todos los inductores**: buscador y filtros en menús combinables (carrera, inducción de ingreso, estado: activos, ancestros, deshabilitados) y por fila las inducciones que lleva y **Editar perfil** (nombre, @, carrera, otra carrera, generación, apodo, canción, foto), ancestro, nueva contraseña y eliminar. **Dentro de una carrera:** las palabras de los coordis y de cada comité para esa inducción y la lista de quienes participan, con papel, cultura, comité (y si lo coordina), grupo de dos o base; agrega a una persona ya registrada (su carrera sale de su pasaporte), la quita de esa carrera o la **deshabilita** en ella (esa inducción no le cuenta). | Alguien nuevo, corregir un perfil, cambiar de papel, enlazar a su grupo. |
| **Usuarios** | Los de la Carrera elegida, cada uno con su **foto** (botón de cámara; reemplaza la inicial en su cabecera y en la lista) (más los coordinadores): crear, cambiar contraseña y eliminar. Los usuarios anteriores a esta regla aparecen en *Sin Carrera asignada* para adoptarlos o eliminarlos. Corredores e inductores se crean siempre dentro de una Carrera. | |

## Corredor (`/corredor`)
Una **barra de estado siempre visible** (el grupo, "En vivo" y **los puntos de su propio grupo**; **nunca el puesto ni los puntos de los demás**: nadie debe saber quién va ganando antes de que se anuncie) y tres pestañas (cuatro para el usuario designado del GPS). Un grupo puede compartir **un solo usuario** entre la pareja de corredores.

| Pestaña | Contenido |
|---|---|
| **Visado** | Avisos de demora y del coordinador, y el **destino** de la ronda actual: la foto de la base a gran formato con su puerta, código de aeropuerto y estado, el rival, las **tres etapas** (barra, pregunta, minijuego) con quién ganó cada una y el sello esperando; abajo el **próximo destino** como tarjeta de embarque. Cuando la base califica la tercera etapa con la app abierta, el sello cae en pantalla. |
| **Ubicación** *(solo el usuario designado)* | Un mapa **fijo** (no se mueve ni se acerca) con las bases y la posición del grupo, que se actualiza, y el botón para **compartir la ubicación** con el coordinador. No hay mapa de ruta: los corredores saben llegar. |
| **Pasaporte** | La portada se ve cada vez que se abre la pestaña y se abre al tocarla. Todas las páginas miden lo mismo y se pasan deslizando (sin botones). Página de identidad (equipo, vuelo, mapa del recorrido, progreso del viaje, itinerario) y páginas de sellos (cuatro destinos cada una): completado, disponible o en puerta, pendiente y descanso. Tocar un sello completado abre sus tres etapas. Un sello se gana al calificarse las tres etapas. Solo usa datos que el corredor ya leía de sus cruces. |
| **Top** | El **mismo ticket de pasajero** de Visado (nombre, en vivo y puntos) y, bajo una tarjeta blanca con el título, **los demás equipos** solo con foto y nombre (sin puntos y en orden alfabético). La tarjeta de pasajero solo está en Visado y en Top. |

Los ajustes de **sonido y notificaciones** están en la hoja de la cuenta (tocar el avatar de la barra), entre «Modo oscuro» y «Cerrar sesión»; un punto dorado en el avatar avisa que el sonido está apagado. Sin Carrera activa para su usuario se ve una explicación tranquila ("No hay ninguna Carrera activa para tu usuario").

## Pasaporte personal (`/pasaporte`)
Lo que ve un inductor al entrar con su @ personal (sin acceso a la operación; el grupo o la base entra con su propio usuario). Es **el pasaporte de toda su vida en la inducción**, igual para todos: una cubierta que se abre al tocarla y estas páginas.
1. **Identidad (el DNI):** foto, nombre, **símbolo de su carrera** con el nombre de la carrera, apodo y la **canción** de la persona (un fragmento de 30 s con pausa y volumen; los pone el coordinador), cuándo ingresó a inducción, generación (con su espacio para el sello), @ y número. **General y única de la persona: nada de temática, comité, papel ni pareja.**
2. **Por cada inducción** (la más nueva primero), en su temática: la **página de la inducción** ("Inducción 2710 · Temática Mitologías", las palabras de los coordinadores, la cultura que le tocó, su papel, grupo y pareja), la **página del comité** (su sello, dorado si lo coordina; las palabras del comité; y un **sello dorado con la foto** del grupo con el que corre o de la base que atiende) y las **páginas de visados** (el visado de entrada y un sello por cada base visitada o atendida, o por cada Carrera coordinada; siempre hay páginas libres).
3. **Páginas en blanco** para las próximas inducciones.
Al tocar **«Tu carrera»** en la página de identidad se abre la **insignia** de la carrera en grande, con un texto sobre ser ingeniero de esa carrera y sobre la Cruz San Pedro Claver. Abajo hay dos pestañas: *Pasaporte* y **Mi perfil** (cambiar el @ y la contraseña, y **descargar el pasaporte en PDF** de recuerdo). El apodo y el símbolo no se cambian ahí: se ponen una vez. Se actualiza solo cuando una Carrera empieza o termina.

## Entrada (`/login`)
La foto del campus arriba (con la de noche en modo oscuro), un velo oscuro en la parte de abajo de la foto y el formulario como tarjeta de embarque. Arriba a la izquierda, el escudo y el nombre CarreApp en blanco, quietos.

## Base (`/base`)
| Pestaña | Contenido |
|---|---|
| **Ronda** | Avisos de demora y **avisos del coordinador** (con sonido); el pase azul de la **ventanilla de visado** (foto y nombre de la base, código de aeropuerto y, en el talón, cuántos visados lleva sellados); el cruce actual como **mostrador** (puerta, estado, el sello de la base, los tres pasos *Llegada · Etapas · Sello*, los dos grupos como pasajeros con su vuelo, confirmar llegada, *Apurar a los grupos* y calificar) y la **próxima ronda** como otro pase. Al terminar todos los cruces, la tarjeta *Ventanilla cerrada*. |
| **Resultados** | El mismo pase y, bajo pestañas blancas de carpeta, *Equipos de la Carrera* (foto y nombre, **sin puntos**) y *Cruces de tu base*: el historial de lo que ha calificado. |
| **Mi base** | El espacio informativo del inductor, en pestañas de carpeta: **lo que se explica** en la base, las **posibles preguntas**, y *Dónde queda* (el sello de la base, la foto y la ubicación). El mapa solo se abre al pulsar *Cambiar ubicación* (o si la base aún no tiene ubicación). |

**Identidad:** el inductor es el **oficial de migración** de la Carrera y la pantalla es su ventanilla. Comparte el lenguaje del corredor (pase azul marino, pestañas de carpeta, barra flotante, fondo con el patrón, transición entre pestañas, campana y cuenta de la barra superior) y suma lo suyo: la **tinta del sello de cada base** (sale del id de la base, igual que el sello) es el acento de la pantalla: borde del mostrador, números de etapa y de ronda. Así cada base se reconoce a simple vista.

La hoja de la cuenta (avatar de la barra) tiene los ajustes de **sonido y notificaciones**, para que el teléfono suene cuando el coordinador avise a la base. Si la Carrera no está activa para su usuario, la pantalla lo explica y, si intenta calificar, el mensaje dice que la Carrera no está activa.

## Qué se movió en la revisión y por qué
- **Resumen → En vivo + Carrera.** "Resumen" mezclaba el estado en vivo con ajustes, carga de archivos y creación de ediciones. Lo que se prepara una vez pasó a *Carrera*; lo que se mira cada minuto quedó en *En vivo*.
- **Demoras:** estaban repetidas en Cruces y en Mapa; ahora hay una sola lista (En vivo) y el Mapa solo marca a los grupos en demora.
- **Cruces** quedó solo para armar el cronograma; el estado en vivo de cada cruce está en *En vivo*.
- **Bases:** un mapa por tarjeta agotaba los contextos WebGL del navegador con muchas bases; ahora el mapa se abre bajo demanda.
- **Corredor:** los interruptores de sonido y notificaciones salieron de *Ronda* (hoja de la cuenta) y los resultados de rondas pasadas salieron de *Ronda* hacia *Ruta* (cada ronda terminada se abre).
- **Base:** la información y las preguntas pasaron de *Mi base* a la **Guía** dentro de *Ronda*; *Top* y *Terminados* se unieron en **Resultados**.
- **Puntajes:** el registro de cambios es plegable.

## Cómo decidir dónde poner algo nuevo
1. ¿Quién lo usa y **cuándo**? Si es durante la ronda, va en la pantalla de la ronda; si es de preparación, en la sección de preparación.
2. ¿Con qué **frecuencia**? Lo que se toca una vez (ajustes) no debe ocupar espacio de lo que se mira siempre.
3. ¿Ya existe en otro lado? Duplicar información obliga a mantener dos copias: mejor un solo lugar y un enlace.
4. ¿Cabe en el celular? Si no, plegable o aparte.

**Base · pestaña Ronda, un momento a la vez:** (1) grupos en camino: cada uno con la base de donde viene, el tiempo máximo del tramo y un reloj que cuenta hacia atrás, «Apurar» por grupo y para los dos (0031), y «Ya llegaron ambos grupos»; (2) llegaron: solo las tres etapas por calificar; (3) calificados: solo «Ya los dejé ir» (tarjeta «Equipos en rotación», habilitada cuando llega el aviso del coordinador); (4) al dejarlos ir, el siguiente cruce con su reloj.

**Estados de la Carrera (0032):** el coordinador la maneja con `PhaseControl` (Preparación → Carrera y arriba de En vivo): Deshabilitada → Habilitada → Iniciada → Terminada. En *Habilitada* las bases y los corredores ven un aviso, los botones desactivados y el botón **Ver tutorial**; en *Iniciada* todo funciona y corre el reloj; en *Terminada* se bloquea otra vez; *Deshabilitar* pasa al Historial y *Reiniciar* (solo desde Terminada) deja la Carrera Habilitada para otra prueba.

**Pasos de la ventanilla (base):** Llegada, Etapas y Sello se ven desde que los grupos vienen en camino; Sello queda «Puesto» cuando la base confirma «Ya los dejé ir».

**Panel del coordi (0036):** tres niveles: *Todas las carreras* (`/admin`), *una carrera* (`/admin/carreras/<id>/…` con su código, estado, lo permitido y sus pestañas) y *Administración global* (inductores, grupos de carreras, comités, **generaciones (0039)**, insignias, el **taller de sellos (0040)** e historial). Ver la Bitácora.
