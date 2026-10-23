-- Onglets « Contrats prestataires » et « Demandes prestataires », réservés aux
-- directeurs de parc (sur leurs parcs), au chef d'équipe, à la direction et à
-- l'admin IT. Les managers (même principaux) et les techniciens n'y ont pas accès.

CREATE OR REPLACE FUNCTION public.acces_direction_parc(p_parc uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
SELECT CASE (SELECT current_role_code())
  WHEN 'direction' THEN true
  WHEN 'chef_maintenance' THEN true
  WHEN 'admin_it' THEN true
  WHEN 'directeur_parc' THEN p_parc IS NULL OR p_parc = ANY (current_parc_ids())
  ELSE false
END;
$function$;
REVOKE ALL ON FUNCTION public.acces_direction_parc(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_direction_parc(uuid) TO authenticated;

-- Fichiers « contrat/<parc>/… » et « demande/<parc>/… »
CREATE OR REPLACE FUNCTION public.acces_fichier_direction(p_chemin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT acces_direction_parc(
    CASE
      WHEN split_part(p_chemin, '/', 2) = 'commun' THEN NULL
      ELSE coalesce((SELECT id FROM parcs WHERE code = split_part(p_chemin, '/', 2)),
                    '00000000-0000-0000-0000-000000000000'::uuid)
    END
  );
$function$;
REVOKE ALL ON FUNCTION public.acces_fichier_direction(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_fichier_direction(text) TO authenticated;

-- Contrats : nouveau type de document technique
ALTER TABLE public.documents_techniques DROP CONSTRAINT IF EXISTS documents_techniques_type_check;
ALTER TABLE public.documents_techniques
  ADD CONSTRAINT documents_techniques_type_check CHECK (type = ANY (ARRAY['plan', 'manuel', 'prestataire', 'contrat']));

ALTER POLICY documents_techniques_lecture ON public.documents_techniques
  USING (((type <> ALL (ARRAY['prestataire', 'contrat']))
          AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'])))
         OR (type = 'prestataire' AND acces_pilotage_parc(parc_id))
         OR (type = 'contrat' AND acces_direction_parc(parc_id)));

ALTER POLICY documents_techniques_ajout ON public.documents_techniques
  WITH CHECK (((type <> ALL (ARRAY['prestataire', 'contrat']))
               AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'])))
              OR (type = 'prestataire' AND acces_pilotage_parc(parc_id))
              OR (type = 'contrat' AND acces_direction_parc(parc_id)));

ALTER POLICY documents_techniques_modification ON public.documents_techniques
  USING (((type <> ALL (ARRAY['prestataire', 'contrat']))
          AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'])))
         OR (type = 'prestataire' AND acces_pilotage_parc(parc_id))
         OR (type = 'contrat' AND acces_direction_parc(parc_id)))
  WITH CHECK (((type <> ALL (ARRAY['prestataire', 'contrat']))
               AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'])))
              OR (type = 'prestataire' AND acces_pilotage_parc(parc_id))
              OR (type = 'contrat' AND acces_direction_parc(parc_id)));

ALTER POLICY alba_techniques_lecture ON storage.objects
  USING (bucket_id = 'alba-techniques'
         AND ((name !~~ 'prestataire/%' AND name !~~ 'contrat/%' AND name !~~ 'demande/%'
               AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'])))
              OR (name ~~ 'prestataire/%' AND acces_fichier_prestataire(name))
              OR ((name ~~ 'contrat/%' OR name ~~ 'demande/%') AND acces_fichier_direction(name))));

ALTER POLICY alba_techniques_ajout ON storage.objects
  WITH CHECK (bucket_id = 'alba-techniques'
              AND ((name !~~ 'prestataire/%' AND name !~~ 'contrat/%' AND name !~~ 'demande/%'
                    AND ((SELECT current_role_code())::text = ANY (ARRAY['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'])))
                   OR (name ~~ 'prestataire/%' AND acces_fichier_prestataire(name))
                   OR ((name ~~ 'contrat/%' OR name ~~ 'demande/%') AND acces_fichier_direction(name))));

-- Demandes spécifiques / demandes d'intervention aux prestataires
CREATE TABLE public.demandes_prestataires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parc_id uuid NOT NULL REFERENCES public.parcs(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'intervention' CHECK (type IN ('intervention', 'specifique')),
  prestataire text,
  domaine text,
  objet text NOT NULL CHECK (length(trim(objet)) > 0),
  description text,
  urgente boolean NOT NULL DEFAULT false,
  date_souhaitee date,
  date_prevue date,
  statut text NOT NULL DEFAULT 'a_envoyer' CHECK (statut IN ('a_envoyer', 'envoyee', 'planifiee', 'realisee', 'annulee')),
  suivi text,
  piece_chemin text,
  piece_nom text,
  cree_par_id uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL DEFAULT current_utilisateur_id(),
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now(),
  realisee_le timestamptz
);
CREATE INDEX demandes_prestataires_parc_idx ON public.demandes_prestataires (parc_id, statut);
CREATE INDEX demandes_prestataires_cree_par_idx ON public.demandes_prestataires (cree_par_id);

ALTER TABLE public.demandes_prestataires ENABLE ROW LEVEL SECURITY;

CREATE POLICY demandes_prestataires_lecture ON public.demandes_prestataires
  FOR SELECT TO authenticated USING (acces_direction_parc(parc_id));
CREATE POLICY demandes_prestataires_ajout ON public.demandes_prestataires
  FOR INSERT TO authenticated WITH CHECK (acces_direction_parc(parc_id));
CREATE POLICY demandes_prestataires_modification ON public.demandes_prestataires
  FOR UPDATE TO authenticated USING (acces_direction_parc(parc_id)) WITH CHECK (acces_direction_parc(parc_id));

GRANT SELECT, INSERT, UPDATE ON public.demandes_prestataires TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_demandes_prestataires_maj()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.modifie_le := now();
  IF NEW.statut = 'realisee' AND OLD.statut IS DISTINCT FROM 'realisee' THEN
    NEW.realisee_le := now();
  ELSIF NEW.statut <> 'realisee' THEN
    NEW.realisee_le := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_demandes_prestataires_maj
BEFORE UPDATE ON public.demandes_prestataires
FOR EACH ROW EXECUTE FUNCTION public.fn_demandes_prestataires_maj();
