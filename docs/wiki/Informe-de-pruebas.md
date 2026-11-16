# Informe de pruebas

Primera ejecución (Bloque 9, 2026-11-16). Cada vez que se use el agente `carreapp-tester` este informe se actualiza con la fecha.

## Qué se probó
- 263 pruebas automáticas (`npm test`): lógica, funciones del servidor, contrato app ↔ esquema, reglas y permisos de la base de datos, generador de cronograma, y una **Carrera simulada** completa (6 grupos, 3 bases, 5 rondas).
- Siete roturas deliberadas de reglas (`TEST_MUTATION_SQL`) para comprobar que las pruebas las detectan.
- Revisión visual de las pantallas de vista previa a 390 px y 1280 px.
- Revisión de la ubicación de la información en las pantallas del coordinador, el corredor y la base.

## Lo que está bien
- **La base de datos es el árbitro:** cruces repetidos, grupos en dos bases, empates, ítems fuera de orden y activaciones incompletas son imposibles aunque la app falle.
- **Permisos:** una base solo califica sus cruces y no edita después; la información privada de las bases no llega a los corredores; el GPS solo lo lee el coordinador.
- **La Carrera de ensayo** termina con un ranking idéntico al conteo independiente, y el registro de cambios cuadra (45 calificaciones y 1 corrección).
- **El generador** acepta de 2 a 20 grupos sin romper reglas.
- **Las funciones del servidor** validan autorización y revierten si algo falla.
- Las pruebas **detectan** las roturas deliberadas.

## Lo que falló (y ya se corrigió)
| Hallazgo | Causa | Arreglo |
|---|---|---|
| Alertas de demora falsas cada 30 s | Un grupo que juega dos rondas seguidas en la misma base "se demoraba" sin caminar | `check_delays()` y `lateTeams` ignoran ese caso. **Migración `0013` pendiente de aplicar** |
| Hueco en la prueba del GPS | Solo se probaba con *upsert*; una política abierta de inserción pasaba | Prueba de INSERT simple |
| Un mapa por tarjeta en Bases | Riesgo de agotar los contextos WebGL | Mapa bajo demanda |
| Colores antiguos en la ruta del mapa | Valores fijos en vez de variables CSS | `cssColor` |
| `.env.example` incompleto | Faltaban las variables de notificaciones | Completado |

## Ubicación de la información
Resultado en [Pantallas](Pantallas): el panel del coordinador se dividió en *En vivo* y *Carrera*; las demoras tienen un solo lugar; el corredor lleva sus ajustes a la campana y las rondas pasadas a *Ruta*; la base muestra la guía junto al cruce y une *Top* y *Terminados*.

## Riesgos para la Carrera real (no los cubre la automatización)
- Sonido y notificaciones en iPhone con el teléfono bloqueado.
- Precisión del GPS y calidad de la red en el campus.
- Mapbox: el token está restringido por URL; probar en el dominio real.
- Carga simultánea: todos los teléfonos con tiempo real y *polling* cada 20 s.
- Datos de prueba que deben limpiarse antes del día.

## Recomendaciones
**P0**
- Aplicar `0013` en Supabase.
- Simulacro con teléfonos reales (un corredor y una base por rol) durante 2 rondas.

**P1**
- Ensayar la carga desde Word/Excel con los datos reales.
- Probar el flujo de reemplazo de un corredor y de retiro de un grupo.

**P2**
- Actualizar el roadmap del `README.md` y volver a correr el agente después de cada bloque.
