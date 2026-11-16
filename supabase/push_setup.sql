-- CarreApp · activar las notificaciones push (se ejecuta UNA vez, después de la migración 0011).
--
-- Antes de ejecutarlo:
--   1. En Vercel (Settings > Environment Variables) deben estar VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
--      VAPID_SUBJECT, PUSH_SECRET y VITE_VAPID_PUBLIC_KEY, y la app redesplegada (ver la wiki).
--   2. Cambia 'REEMPLAZA-POR-TU-CLAVE' por el MISMO valor que pusiste en PUSH_SECRET.
--   3. Si tu dirección de la app no es https://carreapp.vercel.app, cámbiala en la url.
--
-- Qué hace: guarda la dirección y la clave del envío y programa la revisión de demoras
-- cada 10 segundos (solo hace una llamada a Vercel cuando hay un grupo en demora).

create extension if not exists pg_cron;

insert into public.push_config (id, url, secret)
values (1, 'https://carreapp.vercel.app/api/push', 'REEMPLAZA-POR-TU-CLAVE')
on conflict (id) do update set url = excluded.url, secret = excluded.secret;

-- Reprograma limpio si ya existía.
select cron.unschedule(jobid) from cron.job where jobname = 'check-delays';
select cron.schedule('check-delays', '10 seconds', 'select public.check_delays()');

-- Para apagar las notificaciones automáticas:
--   select cron.unschedule(jobid) from cron.job where jobname = 'check-delays';
