# CarreApp

Plataforma web para la gestión y seguimiento en tiempo real de la **Carrera Javeriana** durante la semana de inducción: ranking en vivo, bases, enfrentamientos, ruta de los corredores, mapa con ubicación y panel de administración.

> Esta wiki es la memoria del proyecto. Si no estás el día de la inducción, aquí está todo lo necesario para entender qué se desplegó, cómo funciona y cómo operarlo.

## Qué es la Carrera (contexto)
- Los **neos** (primíparos) recorren la universidad en grupos. Cada grupo va acompañado de **corredores** (inductores).
- En cada **base** (punto estratégico del campus) se enfrentan dos grupos. Un inductor de la base da los puntos.
- Cada enfrentamiento vale **3 puntos**, uno por ítem: **barra** (canción del equipo), **pregunta** (sobre la información de la base) y **minijuego**.
- No hay empates por ítem; el desempate del total se resuelve en la vida real.
- La app se reutiliza **inducción a inducción**: el número de grupos, bases, inductores, nombres y fotos cambian cada vez.

## Páginas de esta wiki
| Página | Contenido |
|---|---|
| [Arquitectura](Arquitectura) | Diagrama de componentes y flujos |
| [Modelo de datos](Modelo-de-datos) | Diagrama entidad-relación y reglas de negocio |
| [Registro SQL](Registro-SQL) | Historial de scripts SQL aplicados en Supabase |
| [Roles y permisos](Roles-y-permisos) | Quién puede hacer qué |
| [Despliegue y configuración](Despliegue-y-configuracion) | Servicios, variables de entorno, cómo desplegar |
| [Estado y pendientes](Estado-y-pendientes) | Foto actual del proyecto, pendientes y convenciones para retomar el trabajo |
| [Bitácora](Bitacora) | Qué se hizo en cada bloque de desarrollo |

## Estado actual
Ver la [Bitácora](Bitacora) para el detalle. Hoja de ruta:

| Bloque | Descripción | Estado |
|---|---|---|
| 0 | Prueba de red y esqueleto PWA | Hecho |
| 1 | Modelo de datos, autenticación y permisos | Hecho y validado en producción |
| 2 | Panel admin: grupos, bases (foto, información, 3 preguntas), corredores y usuarios | Hecho y validado |
| 3 | Cronograma, rotación y validación anti-repetición | Hecho |
| 4 | Vista de base (calificar) | Código listo, falta probar en campo |
| 5 | Ranking en vivo y vista del corredor | Hecho, falta probar con corredores reales |
| 6 | Mapa y GPS | Hecho, falta probar con teléfonos en el campus |
| 7 | Alertas de demora | Código listo, falta aplicar `0010` y probar |
| 8 | Carga masiva (plantilla Word/Excel) | Código listo (plantilla completa), falta probar con el archivo real |
| 9 | Pruebas y ensayo | Pruebas automáticas y agente de pruebas listos; falta el simulacro con teléfonos |

## Decisiones clave
- **PWA única con 3 roles** (admin, base, corredor) en vez de varias apps: se instala desde el navegador, sin tiendas de apps, y es gratis.
- **Sin servidor propio**: todo corre en servicios gestionados con plan gratuito (Vercel + Supabase). Un servidor propio sería bloqueado por la red de la universidad.
- **Los permisos viven en la base de datos** (RLS de Postgres), no solo en la interfaz: una base no puede tocar los puntos de otra aunque se manipule la app.
- **Diseño oscuro y botones grandes**, pensado para usar al aire libre con una mano.
- **GPS**: solo un corredor por grupo transmite. En iPhone la app debe estar abierta con la pantalla activa (limitación de las PWA).
- **Notificaciones push en iPhone** requieren tener la app instalada en la pantalla de inicio (iOS 16.4 o superior).
