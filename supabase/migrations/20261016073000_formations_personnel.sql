/*
  # Formations du personnel (tous les parcs)

  Registre des formations de chaque personne (SST, habilitation électrique,
  incendie / évacuation, CACES…), avec l'attestation et la date de
  recyclage.

  1. Bucket privé `alba-formations` (attestations PDF / images, 25 Mo).
  2. Table `formations_personnel`.
  3. Accès : direction, chef d'équipe, admin IT (tous les parcs) ;
     directeurs de parc (leurs parcs). Pas de suppression (actif = false).
  4. Alertes de recyclage : `alertes_recyclages_formations()` notifie les
     chefs d'équipe et le directeur du parc à J-60, J-30, J-7, le jour J et
     le lendemain ; pg_cron chaque matin (05h10 UTC).
  Script rejouable.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('alba-formations', 'alba-formations', false, 26214400,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "alba_formations_lecture" ON storage.objects;
CREATE POLICY "alba_formations_lecture" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'alba-formations'
  AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it')
);

DROP POLICY IF EXISTS "alba_formations_ajout" ON storage.objects;
CREATE POLICY "alba_formations_ajout" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'alba-formations'
  AND (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'directeur_parc', 'admin_it')
);

CREATE TABLE IF NOT EXISTS public.formations_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid REFERENCES public.parcs(id) ON DELETE SET NULL,
  personne text NOT NULL,
  poste text,
  intitule text NOT NULL,
  organisme text,
  date_formation date NOT NULL,
  date_expiration date,
  attestation text,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  cree_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formations_personnel_parc ON public.formations_personnel(parc_id);
CREATE INDEX IF NOT EXISTS idx_formations_personnel_cree_par ON public.formations_personnel(cree_par_id);
CREATE INDEX IF NOT EXISTS idx_formations_personnel_expiration ON public.formations_personnel(date_expiration) WHERE actif;

ALTER TABLE public.formations_personnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formations_personnel_lecture ON public.formations_personnel;
CREATE POLICY formations_personnel_lecture ON public.formations_personnel FOR SELECT TO authenticated
USING (
  (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it')
  OR ((SELECT current_role_code())::text = 'directeur_parc' AND (parc_id IS NULL OR parc_id = ANY (current_parc_ids())))
);

DROP POLICY IF EXISTS formations_personnel_ajout ON public.formations_personnel;
CREATE POLICY formations_personnel_ajout ON public.formations_personnel FOR INSERT TO authenticated
WITH CHECK (
  (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it')
  OR ((SELECT current_role_code())::text = 'directeur_parc' AND parc_id = ANY (current_parc_ids()))
);

DROP POLICY IF EXISTS formations_personnel_modification ON public.formations_personnel;
CREATE POLICY formations_personnel_modification ON public.formations_personnel FOR UPDATE TO authenticated
USING (
  (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it')
  OR ((SELECT current_role_code())::text = 'directeur_parc' AND parc_id = ANY (current_parc_ids()))
)
WITH CHECK (
  (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it')
  OR ((SELECT current_role_code())::text = 'directeur_parc' AND parc_id = ANY (current_parc_ids()))
);

CREATE OR REPLACE FUNCTION public.alertes_recyclages_formations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_aujourdhui date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_f record;
  v_dest record;
  v_jours integer;
  v_nb integer := 0;
BEGIN
  FOR v_f IN
    SELECT f.id, f.personne, f.intitule, f.date_expiration, f.parc_id, p.code AS parc_code
    FROM formations_personnel f
    LEFT JOIN parcs p ON p.id = f.parc_id
    WHERE f.actif AND f.date_expiration IS NOT NULL
      AND (f.date_expiration - v_aujourdhui) IN (60, 30, 7, 0, -1)
      -- Une formation plus récente de la même personne remplace l'ancienne
      AND NOT EXISTS (
        SELECT 1 FROM formations_personnel f2
        WHERE f2.actif AND f2.id <> f.id
          AND lower(f2.personne) = lower(f.personne) AND lower(f2.intitule) = lower(f.intitule)
          AND f2.date_formation > f.date_formation
      )
  LOOP
    v_jours := v_f.date_expiration - v_aujourdhui;
    FOR v_dest IN
      SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
      WHERE u.actif
        AND (
          r.code = 'chef_maintenance'
          OR (r.code = 'directeur_parc' AND (v_f.parc_id IS NULL OR EXISTS (
            SELECT 1 FROM parcs_utilisateurs pu WHERE pu.utilisateur_id = u.id AND pu.parc_id = v_f.parc_id
          )))
        )
    LOOP
      PERFORM notifier_push(
        v_dest.id,
        CASE
          WHEN v_jours < 0 THEN 'Formation expirée : ' || v_f.intitule
          WHEN v_jours = 0 THEN 'Formation expire aujourd''hui : ' || v_f.intitule
          ELSE 'Recyclage dans ' || v_jours || ' j : ' || v_f.intitule
        END,
        concat_ws(' · ', v_f.personne, v_f.parc_code, 'expiration ' || to_char(v_f.date_expiration, 'DD/MM/YYYY')),
        '/gmao/formations-personnel'
      );
      v_nb := v_nb + 1;
    END LOOP;
  END LOOP;
  RETURN v_nb;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alertes_recyclages_formations() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'gmao_alertes_recyclages_formations',
  '10 5 * * *',
  $cron$SELECT public.alertes_recyclages_formations();$cron$
);

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016073000', 'formations_personnel')
ON CONFLICT (version) DO NOTHING;
