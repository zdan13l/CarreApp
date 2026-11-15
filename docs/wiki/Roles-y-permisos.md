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
| Ver el registro de auditoría | Sí | No | No |
| Ver perfiles de otros usuarios | Sí | No (solo el suyo) | No (solo el suyo) |
| Ver el mapa con la ubicación de todos | Sí | No | No |
| Transmitir su ubicación | — | — | Solo el corredor designado del grupo |

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
