# CarreApp

Plataforma web para la gestión y seguimiento en tiempo real de la Carrera Javeriana durante las jornadas de inducción. Permite administrar equipos, bases, enfrentamientos, puntuaciones y ubicaciones, ofreciendo un ranking dinámico y actualizado en vivo.

Es una PWA (aplicación web instalable) pensada para que los inductores la usen desde el celular durante la semana de inducción. La interfaz está en español y el código en inglés.

## Tecnologías

Vite + React + TypeScript · vite-plugin-pwa · Supabase (Postgres, Auth, Realtime, Storage) · Vercel.

## Configuración local

```bash
npm install
cp .env.example .env.local   # completa la URL y la anon key de Supabase
npm run dev
```

## Despliegue (Vercel)

Importa el repositorio de GitHub con el preset **Vite** y agrega las variables de entorno
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El archivo `vercel.json` se encarga de las rutas de la SPA.

## Hoja de ruta

| Bloque | Descripción |
|---|---|
| 0 | Prueba de red y esqueleto del proyecto (actual) |
| 1 | Modelo de datos y autenticación |
| 2 | Panel de administrador: grupos, bases (con foto del lugar, información que se da en la base y 3 posibles preguntas), corredores y usuarios |
| 3 | Cronograma, rotación y validación de cruces repetidos |
| 4 | Vista de base (calificar enfrentamientos) |
| 5 | Ranking en vivo y vista de corredor |
| 6 | Mapa y GPS |
| 7 | Alertas de demora |
| 8 | Carga masiva desde plantilla |
| 9 | Pruebas y ensayo |
