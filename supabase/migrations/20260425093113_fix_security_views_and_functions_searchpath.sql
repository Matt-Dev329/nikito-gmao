/*
  # Fix security warnings: SECURITY DEFINER views and mutable search_path functions

  1. Views — Switch from SECURITY DEFINER to SECURITY INVOKER
    - `v_categories_equipement_suggestions` — category suggestion view
    - `v_equipement_contexte_roller` — equipment Roller context view
    - `v_roller_cron_status` — Roller cron job monitoring view
    All three had the Postgres default (SECURITY DEFINER for views).
    Recreated with explicit `security_invoker = on` so queries run
    under the calling user's privileges, not the view owner's.

  2. Functions — Pin search_path to prevent manipulation
    - `get_parc_by_roller_venue(text)` — lookup parc by Roller venue code
    - `call_roller_sync(text)` — invoke Roller sync edge function via pg_net
    - `saisir_point_controle(...)` — record a single control-point answer
    - `valider_controle(...)` — finalize and validate a control
    Each function gets `SET search_path = public` so an attacker cannot
    inject a rogue schema ahead of public.

  3. Security
    - No RLS changes
    - No data changes
    - Views are dropped and recreated (they are virtual, no data loss)
    - Functions are replaced in-place via CREATE OR REPLACE
*/

-- ============================================================
-- 1. Recreate views with SECURITY INVOKER
-- ============================================================

-- 1a. v_categories_equipement_suggestions
DROP VIEW IF EXISTS public.v_categories_equipement_suggestions;
CREATE VIEW public.v_categories_equipement_suggestions
WITH (security_invoker = on) AS
SELECT
  ce.id AS categorie_id,
  ce.nom AS categorie_nom,
  count(e.id) AS nb_equipements_existants,
  array_agg(DISTINCT e.type_attraction) FILTER (WHERE e.type_attraction IS NOT NULL) AS types_attraction_utilises
FROM categories_equipement ce
LEFT JOIN equipements e ON e.categorie_id = ce.id AND e.est_formation IS NOT TRUE
GROUP BY ce.id, ce.nom
ORDER BY ce.nom;

-- 1b. v_equipement_contexte_roller
DROP VIEW IF EXISTS public.v_equipement_contexte_roller;
CREATE VIEW public.v_equipement_contexte_roller
WITH (security_invoker = on) AS
SELECT
  e.id AS equipement_id,
  e.code AS equipement_code,
  e.libelle AS equipement_libelle,
  e.parc_id,
  e.type_attraction,
  p.code AS parc_code,
  p.roller_venue_code,
  (
    SELECT round(avg(daily.total), 1)
    FROM (
      SELECT pa.date_attendance, sum(pa.attendances_count) AS total
      FROM parc_attendance pa
      JOIN roller_catalogue rc ON rc.id = pa.roller_catalogue_id
      WHERE pa.parc_id = e.parc_id
        AND rc.type_attraction = e.type_attraction
        AND pa.date_attendance >= CURRENT_DATE - interval '30 days'
      GROUP BY pa.date_attendance
    ) daily
  ) AS frequentation_moyenne_jour_30j,
  (
    SELECT round(avg(daily.ca), 2)
    FROM (
      SELECT pr.record_date, sum(pr.net_revenue) AS ca
      FROM parc_revenue pr
      JOIN roller_catalogue rc ON rc.id = pr.roller_catalogue_id
      WHERE pr.parc_id = e.parc_id
        AND rc.type_attraction = e.type_attraction
        AND pr.record_date >= CURRENT_DATE - interval '30 days'
      GROUP BY pr.record_date
    ) daily
  ) AS ca_moyen_jour_30j
FROM equipements e
JOIN parcs p ON p.id = e.parc_id
WHERE e.type_attraction IS NOT NULL
  AND e.est_formation IS NOT TRUE;

-- 1c. v_roller_cron_status
DROP VIEW IF EXISTS public.v_roller_cron_status;
CREATE VIEW public.v_roller_cron_status
WITH (security_invoker = on) AS
SELECT
  j.jobname,
  j.schedule,
  j.active,
  (SELECT count(*) FROM cron.job_run_details jrd
   WHERE jrd.jobid = j.jobid AND jrd.start_time > now() - interval '7 days') AS runs_7j,
  (SELECT count(*) FROM cron.job_run_details jrd
   WHERE jrd.jobid = j.jobid AND jrd.status = 'succeeded' AND jrd.start_time > now() - interval '7 days') AS success_7j,
  (SELECT jrd.start_time FROM cron.job_run_details jrd
   WHERE jrd.jobid = j.jobid ORDER BY jrd.start_time DESC LIMIT 1) AS last_run,
  (SELECT jrd.status FROM cron.job_run_details jrd
   WHERE jrd.jobid = j.jobid ORDER BY jrd.start_time DESC LIMIT 1) AS last_status
FROM cron.job j
WHERE j.jobname LIKE 'roller_sync_%'
ORDER BY j.jobname;


-- ============================================================
-- 2. Pin search_path on functions
-- ============================================================

-- 2a. get_parc_by_roller_venue
CREATE OR REPLACE FUNCTION public.get_parc_by_roller_venue(p_venue_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.parcs
  WHERE roller_venue_code = p_venue_code
  LIMIT 1;
$$;

-- 2b. call_roller_sync
CREATE OR REPLACE FUNCTION public.call_roller_sync(function_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

-- 2c. saisir_point_controle
CREATE OR REPLACE FUNCTION public.saisir_point_controle(
  p_controle_id uuid,
  p_point_id uuid,
  p_etat etat_controle_item,
  p_equipement_id uuid DEFAULT NULL,
  p_commentaire text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_saisi_par_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_controle controles%rowtype;
  v_point bibliotheque_points%rowtype;
  v_existing controle_items%rowtype;
  v_item_id uuid;
  v_result jsonb;
begin
  select * into v_controle from controles where id = p_controle_id;
  if not found then
    raise exception 'Contrôle introuvable: %', p_controle_id using errcode = 'P0001';
  end if;

  if v_controle.statut = 'valide' then
    raise exception 'Contrôle déjà validé, modification impossible (immutabilité Lean)' using errcode = 'P0002';
  end if;

  if v_controle.statut = 'remplace' then
    raise exception 'Contrôle remplacé, utiliser le nouveau contrôle' using errcode = 'P0003';
  end if;

  select * into v_point from bibliotheque_points where id = p_point_id;
  if not found then
    raise exception 'Point bibliothèque introuvable: %', p_point_id using errcode = 'P0004';
  end if;

  select * into v_existing from controle_items
  where controle_id = p_controle_id and point_id = p_point_id;

  if found then
    update controle_items set
      etat = p_etat,
      equipement_id = coalesce(p_equipement_id, v_existing.equipement_id),
      commentaire = coalesce(p_commentaire, v_existing.commentaire),
      photo_url = coalesce(p_photo_url, v_existing.photo_url),
      saisi_par_id = coalesce(p_saisi_par_id, v_existing.saisi_par_id),
      saisi_le = now()
    where id = v_existing.id;
    v_item_id := v_existing.id;
  else
    insert into controle_items (
      controle_id, point_id, equipement_id, etat,
      commentaire, photo_url, saisi_par_id, saisi_le,
      point_libelle_snapshot, point_categorie_snapshot, point_type_controle_snapshot,
      est_formation
    ) values (
      p_controle_id, p_point_id, p_equipement_id, p_etat,
      p_commentaire, p_photo_url, p_saisi_par_id, now(),
      v_point.libelle, v_point.categorie::text, v_point.type_controle::text,
      v_controle.est_formation
    ) returning id into v_item_id;
  end if;

  if v_controle.statut = 'a_faire' then
    update controles set
      statut = 'en_cours',
      date_demarrage = coalesce(date_demarrage, now()),
      realise_par_id = coalesce(realise_par_id, p_saisi_par_id),
      modifie_le = now()
    where id = p_controle_id;
  end if;

  select jsonb_build_object(
    'item_id', ci.id,
    'controle_id', ci.controle_id,
    'point_id', ci.point_id,
    'etat', ci.etat,
    'incident_genere_id', ci.incident_genere_id,
    'saisi_le', ci.saisi_le,
    'controle_statut', c.statut
  ) into v_result
  from controle_items ci
  join controles c on c.id = ci.controle_id
  where ci.id = v_item_id;

  return v_result;
end;
$$;

-- 2d. valider_controle
CREATE OR REPLACE FUNCTION public.valider_controle(
  p_controle_id uuid,
  p_valide_par_id uuid,
  p_signature_url text DEFAULT NULL,
  p_signature_ip text DEFAULT NULL,
  p_signature_user_agent text DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_controle controles%rowtype;
  v_total_points int;
  v_points_saisis int;
  v_nb_hs int;
  v_nb_degrade int;
  v_hash_input text;
  v_hash text;
begin
  select * into v_controle from controles where id = p_controle_id;
  if not found then
    raise exception 'Contrôle introuvable' using errcode = 'P0001';
  end if;

  if v_controle.statut = 'valide' then
    raise exception 'Contrôle déjà validé' using errcode = 'P0002';
  end if;

  select count(*) into v_points_saisis from controle_items
  where controle_id = p_controle_id and etat <> 'non_saisi';

  if v_points_saisis = 0 then
    raise exception 'Aucun point saisi, validation impossible' using errcode = 'P0005';
  end if;

  select count(*) filter (where etat = 'hs'),
         count(*) filter (where etat = 'degrade')
  into v_nb_hs, v_nb_degrade
  from controle_items where controle_id = p_controle_id;

  select md5(string_agg(
    ci.id::text || ':' || ci.etat::text || ':' || coalesce(ci.commentaire, ''),
    '|' order by ci.id
  ))
  into v_hash
  from controle_items ci where ci.controle_id = p_controle_id;

  update controles set
    statut = 'valide',
    valide_par_id = p_valide_par_id,
    date_validation = now(),
    signature_url = coalesce(p_signature_url, signature_url),
    signature_at = case when p_signature_url is not null then now() else signature_at end,
    signature_ip = coalesce(p_signature_ip, signature_ip),
    signature_user_agent = coalesce(p_signature_user_agent, signature_user_agent),
    hash_integrite = v_hash,
    modifie_le = now()
  where id = p_controle_id;

  return jsonb_build_object(
    'controle_id', p_controle_id,
    'statut', 'valide',
    'points_saisis', v_points_saisis,
    'nb_hs', v_nb_hs,
    'nb_degrade', v_nb_degrade,
    'hash_integrite', v_hash,
    'date_validation', now()
  );
end;
$$;
