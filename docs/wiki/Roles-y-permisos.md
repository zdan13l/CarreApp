# Roles y permisos

Hay **tres roles**. Los permisos se aplican en la **base de datos** (RLS), no solo ocultando botones: aunque alguien manipule la app, Postgres rechaza lo que su rol no permite.

| Acción | Admin (coordinador) | Base | Corredor |
|---|:-:|:-:|:-:|
| Crear / eliminar usuarios y cambiar contraseñas | Sí | No | No |
| Configurar Carrera, grupos, bases, corredores | Sí | No | No |
| Armar cruces y rotación | Sí | No | No |
| Ver ranking en vivo, grupos, cruces, y de cada base su nombre y foto | Sí | Sí | Sí |
| Ver la **información y las preguntas** de una base | Sí | **Solo la suya** | **No** |
| Registrar puntajes | Sí | **Solo de su base** | No |
| Confirmar que llegaron ambos grupos | Sí | **Solo su base** | No |
| Cambiar la foto de la base | Sí | **Solo la suya** | No |
| Corregir o borrar un puntaje ya enviado | **Sí (único)** | No | No |
| Invalidar un ítem que no se jugó | **Sí (único)** | No | No |
| Configurar el tiempo de traslado (general y por tramo) y enviar avisos de demora | **Sí (único)** | No | No |
| Mandar un aviso a los grupos de un cruce | Sí (todos) | **Solo de su base** | No |
| Recibir notificaciones y sonido de demora | — | — | **Sí** (solo corredores) |
| Recibir los avisos de su cruce | — | Sí | Sí |
| Ver el registro de auditoría | Sí | No | No |
| Ver perfiles de otros usuarios | Sí | No (solo el suyo) | No (solo el suyo) |
| Ver el mapa con la ubicación de todos | Sí | No | No |
| Transmitir su ubicación | — | — | Solo el corredor designado del grupo |
| Fijar la ubicación de una base en el mapa | Sí | **Solo la suya** | No |
| Ver su ruta a pie a la siguiente base | — | — | Sí (su posición queda en su teléfono) |

## Notas
- Hay **un solo admin**: el coordinador del comité de Carrera, que cambia cada semestre. Para traspasarlo se crea otro admin y se elimina el anterior.
- Una base con varios inductores: todos los asignados en `base_staff` pueden puntuar los cruces de esa base, y la regla de un puntaje por ítem evita que se pisen.
- No hay empates por ítem: siempre se elige un ganador. Si dos grupos quedan igualados en el total, se desempata en la vida real.
- Los **neos no usan la app**.

## Seguridad de las claves
| Clave | Dónde vive | Quién la puede ver |
|---|---|---|
| `anon` (pública) | Frontend (`VITE_SUPABASE_ANON_KEY`) | Cualquiera; es segura porque RLS protege los datos |
| `service_role` (secreta) | Solo variable de entorno de Vercel (`SUPABASE_SERVICE_ROLE_KEY`) | Nadie fuera del servidor. **Salta RLS**; no debe ir en el repo, el navegador ni chats |

Si la `service_role` se llega a exponer, se **regenera** en Supabase (Project Settings > API) y se actualiza en Vercel.

## Pasaporte personal (migración 0023)
Además de los tres roles de la operación, cada inductor tiene un **usuario personal** que solo abre su **pasaporte personal**. Ese usuario **no tiene perfil**: ninguna política le da filas de grupos, bases, cruces, puntajes ni perfiles, así que no puede entrar a la Carrera con él. Lee únicamente su propia persona, sus registros por semestre y sus sellos (más la lista de semestres), y dos funciones que solo devuelven nombres y cruces terminados (`my_passport_context()`, `my_live_stamps()`). El coordinador crea, enlaza (corredor → grupo de dos, base → base), cambia de papel, sube la foto y elimina; la persona no puede cambiarse el papel ni la foto. Quien corre entra a la operación con el **usuario del grupo**, y quien califica, con el de su base.

## Usuarios y Carreras
Corredores e inductores pertenecen a **una** Carrera (`profiles.event_id`) y no pueden asignarse a otra; el coordinador no pertenece a ninguna y ve todas. Ver [Registro SQL](Registro-SQL) `0014`.

## Lo que cada rol puede leer (desde la migración 0019)
- Cada persona lee solo los datos de **su Carrera**; el coordinador lee todas.
- **Puntajes** (y el ranking): solo el coordinador, el inductor de esa base y los corredores de ese cruce. Los demás no pueden saber quién va ganando.
- **El @ de los demás equipos** (`team_contacts()`, 0021): cada corredor ve el usuario (el @ con el que se inicia sesión) de los corredores de su propia Carrera, para poder encontrarlos; el coordinador ve todos y las bases y los anónimos nada. Como ese usuario es también el de inicio de sesión, las contraseñas sugeridas llevan cuatro dígitos al azar (no bastan las listas de palabras, que son públicas), y las contraseñas emitidas antes de este cambio se pueden regenerar con *Cambiar contraseña* en *Usuarios* antes del día real.
- **Avisos**: los corredores ven los avisos para grupos de sus cruces; el inductor ve los de su base; solo el coordinador puede avisar a una base.
- **Eliminar una Carrera** solo es posible si está desactivada.
