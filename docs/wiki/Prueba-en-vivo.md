# Prueba en vivo (simulacro)

Guía para ensayar una Carrera de verdad con teléfonos, antes del día. Usa la **Carrera de prueba** lista para cargar: `carrera-de-prueba.xlsx` (botón "Carrera de prueba" en *Carrera > Cargar la Carrera desde un archivo*, o en `public/plantillas/`).

## Qué trae la Carrera de prueba
- **6 grupos:** Dioses Griegos, Dioses Nórdicos, Samuráis, Guerreros Aztecas, Vikingos, Gladiadores.
- **3 bases** con información, 3 preguntas y ubicación en el campus: Atrio, Cancha de Fútbol, Biblioteca.
- **9 usuarios:** 6 corredores (**uno por grupo**, compartido por la pareja, y es el que transmite el GPS) y 3 inductores, con usuarios `prueba.c1` … `prueba.c6` y `prueba.i1` … `prueba.i3`. **Las contraseñas se generan al subir el archivo** y se muestran una sola vez: cópialas (no están en el archivo ni en el repositorio).
- **15 cruces en 5 rondas** (cada grupo juega contra los otros 5, nadie juega dos veces en una ronda) y los **tiempos entre bases** (3 a 5 min; el general es de 8).

## Paso a paso
1. **Cargar:** el panel arranca en modo **Preparación** (sin Carrera activa). *Carrera > Cargar la Carrera desde un archivo* → sube `carrera-de-prueba.xlsx`, revisa la vista previa y confirma. Copia las contraseñas.
2. **Fotos:** faltan solo las de los 6 grupos y las 3 bases (*Grupos* y *Bases*). Con cualquier imagen basta. Mira la lista "Falta para poder activar".
3. **Ubicación:** revisa en *Bases* que cada punto esté donde realmente vas a probar (las coordenadas son aproximadas del campus; cámbialas si ensayas en otro lugar).
4. **Activar** la Carrera (confirma). El panel pasa solo al modo **En carrera** (En vivo, Puntajes, Mapa). Solo puede haber una activa: la real, si ya existe, queda desactivada mientras ensayas.
5. **Teléfonos:** reparte usuarios. Mínimo: 1 corredor (que ya es el del GPS) y 1 inductor; ideal: 3 inductores y los 6 corredores (uno por grupo). Entra desde el celular y **instala la app** (iPhone: Compartir > Agregar a inicio). Activa el sonido y las notificaciones (campana en la pantalla del corredor).
6. **Jugar las rondas:** el inductor confirma la llegada de los dos grupos y califica los 3 ítems; el coordinador mira *En vivo*.

## Qué observar (lista de comprobación)
| Prueba | Qué debe pasar |
|---|---|
| Demora | Un grupo tarda más de 8 min entre bases: suena y llega notificación **solo a sus corredores**; en *En vivo* aparece en "Demoras" con el botón *Avisar*. |
| Descanso | Con 6 grupos y 3 bases nadie descansa; para probarlo, deja a un grupo sin cruce en una ronda: **no** debe recibir alertas. |
| Misma base | Un grupo que repite base no recibe alerta de demora. |
| Corrección | En *Puntajes* cambia un resultado: pide confirmación y queda en el registro de cambios. |
| Cambio de Carrera | *Finalizar Carrera* (En vivo) pide confirmación: corredores y bases dejan de verla de inmediato (sin recargar). |
| Reinicio | Al finalizar, el avance se borra (puntajes, llegadas, avisos, ubicaciones, registro) pero quedan grupos, bases, usuarios y cruces: al reactivarla se puede repetir el ensayo sin volver a cargar el archivo. |
| Mapa | El corredor con GPS aparece en *Mapa*; si deja de transmitir, pasa a "Sin señal" y, tras 1 hora, desaparece. |
| Teléfono bloqueado | Con la pantalla bloqueada llega la notificación de demora (el sonido solo suena con la app abierta). |
| Sin red | Apaga datos en un teléfono: aparece la franja "Sin conexión" y la pantalla no se vacía; al volver la red se actualiza. |
| Cerrar sesión | Pide confirmación y ese teléfono deja de recibir notificaciones. |
| Privacidad | Un corredor **no** ve la información ni las preguntas de la base; solo el inductor de esa base y el coordinador. |
| Carga | Con todos los teléfonos a la vez, las pantallas se actualizan en 1 a 3 s y el panel de Supabase no muestra picos raros. |

## Al terminar: limpiar
1. Finaliza la Carrera (modo En carrera) y, en Preparación, *Carrera > Eliminar esta Carrera*: escribe su nombre y deja marcada la opción de eliminar también a sus corredores e inductores.
2. Reactiva la Carrera real (si la hay) y revisa que en *Usuarios* no queden usuarios `prueba.*` ni "Sin Carrera asignada".
3. Anota en la [Bitácora](Bitacora) lo que falló o sorprendió, y vuelve a correr el agente de pruebas (ver [Pruebas](Pruebas)).

## Antes del día real
- No publiques cambios en `main` durante la Carrera (un teléfono con la versión vieja puede fallar al abrir el mapa).
- Haz este simulacro **al menos una vez** con la red del campus y varios teléfonos distintos (iPhone y Android).
