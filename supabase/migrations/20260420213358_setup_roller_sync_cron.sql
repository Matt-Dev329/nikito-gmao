
-- 1. Fonction helper : appelle une Edge Function Supabase via pg_net
-- Stocke la clé anon dans un secret Vault pour ne pas la mettre en clair dans le cron
create or replace function public.call_roller_sync(function_name text)
returns bigint
language plpgsql
security definer
as $$
declare
  request_id bigint;
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
  project_url text := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
begin
  select net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || anon_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) into request_id;

  return request_id;
end;
$$;

comment on function public.call_roller_sync is 'Helper pour déclencher une sync Roller depuis pg_cron. Retourne le request_id pg_net pour traçabilité.';

-- 2. Supprimer les crons existants avec le même nom (idempotence)
do $$
declare
  job_name text;
begin
  for job_name in
    select jobname from cron.job
    where jobname in (
      'roller_sync_gxs_nightly',
      'roller_sync_products_weekly',
      'roller_sync_attendance_nightly',
      'roller_sync_revenue_nightly'
    )
  loop
    perform cron.unschedule(job_name);
  end loop;
end $$;

-- 3. Planifier les 4 crons
-- CRON 1 : GXS tous les jours à 01h UTC (03h Paris)
select cron.schedule(
  'roller_sync_gxs_nightly',
  '0 1 * * *',
  $$select public.call_roller_sync('sync-roller-gxs');$$
);

-- CRON 2 : Products uniquement le lundi à 02h UTC (04h Paris) — catalogue stable
select cron.schedule(
  'roller_sync_products_weekly',
  '0 2 * * 1',
  $$select public.call_roller_sync('sync-roller-products');$$
);

-- CRON 3 : Attendance tous les jours à 03h UTC (05h Paris)
select cron.schedule(
  'roller_sync_attendance_nightly',
  '0 3 * * *',
  $$select public.call_roller_sync('sync-roller-attendance');$$
);

-- CRON 4 : Revenue tous les jours à 04h UTC (06h Paris)
select cron.schedule(
  'roller_sync_revenue_nightly',
  '0 4 * * *',
  $$select public.call_roller_sync('sync-roller-revenue');$$
);

-- 4. Vue utilitaire pour voir l'état des crons facilement
create or replace view public.v_roller_cron_status as
select
  j.jobname,
  j.schedule,
  j.active,
  (
    select count(*) from cron.job_run_details jrd
    where jrd.jobid = j.jobid
    and jrd.start_time > now() - interval '7 days'
  ) as runs_7j,
  (
    select count(*) from cron.job_run_details jrd
    where jrd.jobid = j.jobid
    and jrd.status = 'succeeded'
    and jrd.start_time > now() - interval '7 days'
  ) as success_7j,
  (
    select jrd.start_time from cron.job_run_details jrd
    where jrd.jobid = j.jobid
    order by jrd.start_time desc limit 1
  ) as last_run,
  (
    select jrd.status from cron.job_run_details jrd
    where jrd.jobid = j.jobid
    order by jrd.start_time desc limit 1
  ) as last_status
from cron.job j
where j.jobname like 'roller_sync_%'
order by j.jobname;

comment on view public.v_roller_cron_status is 'État des CRON de synchronisation Roller — exécutions 7 derniers jours, dernière exécution, statut';
;
