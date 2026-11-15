# CarreApp

PWA to manage the induction "Carrera" live: rankings per base, runners' routes, GPS map and admin panel.
UI in Spanish, code in English.

## Stack
Vite + React + TypeScript · vite-plugin-pwa · Supabase (Postgres, Auth, Realtime, Storage) · Vercel.

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in Supabase URL and anon key
npm run dev
```

## Deploy (Vercel)
Import the GitHub repo, framework preset **Vite**, and add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
as environment variables. `vercel.json` handles SPA routing.

## Roadmap
Block 0 network check + skeleton (this) → 1 data model & auth → 2 admin config → 3 schedule & anti-repeat validation →
4 base view → 5 live ranking & runner view → 6 GPS map → 7 slow-pace alerts → 8 bulk import → 9 rehearsal.
