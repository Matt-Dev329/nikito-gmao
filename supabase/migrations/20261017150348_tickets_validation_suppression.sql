-- Tickets :
--  * créés par le staff ou un manager non principal → « à valider » : ils
--    n'arrivent dans Opérations qu'une fois validés par le chef d'équipe, la
--    direction, l'admin IT, le directeur du parc ou un manager principal du parc ;
--  * suppression (annulation) par les mêmes, avec un motif obligatoire ;
--  * nom du déclarant enregistré sur le ticket (lisible par tous).

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS declare_par_nom text,
  ADD COLUMN IF NOT EXISTS supprime_motif text,
  ADD COLUMN IF NOT EXISTS supprime_par_id uuid REFERENCES public.utilisateurs(id),
  ADD COLUMN IF NOT EXISTS supprime_le timestamptz;
CREATE INDEX IF NOT EXISTS incidents_supprime_par_id_idx ON public.incidents (supprime_par_id);
CREATE INDEX IF NOT EXISTS incidents_validation_attente_idx ON public.incidents (validation_manager) WHERE validation_manager = 'en_attente';

-- Parc d'un ticket : celui de l'équipement, sinon ceux du déclarant
CREATE OR REPLACE FUNCTION public.parcs_du_ticket(p_incident_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
SELECT coalesce(
  (SELECT ARRAY[e.parc_id] FROM incidents i JOIN equipements e ON e.id = i.equipement_id WHERE i.id = p_incident_id),
  (SELECT parcs_de_utilisateur(i.declare_par_id) FROM incidents i WHERE i.id = p_incident_id),
  '{}');
$function$;

-- Valider / supprimer un ticket : chef, direction, admin IT, directeur du parc, manager principal du parc
CREATE OR REPLACE FUNCTION public.peut_valider_ticket(p_incident_id uuid)
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
  WHEN 'directeur_parc' THEN parcs_du_ticket(p_incident_id) && current_parc_ids()
  WHEN 'manager_parc' THEN parcs_du_ticket(p_incident_id) && parcs_manager_principal()
  ELSE false
END;
$function$;

-- À la création : nom du déclarant, et validation requise pour le staff et les managers non principaux
CREATE OR REPLACE FUNCTION public.fn_ticket_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role role_utilisateur;
  v_parc uuid;
BEGIN
  SELECT r.code, trim(coalesce(u.prenom, '') || ' ' || coalesce(u.nom, ''))
    INTO v_role, NEW.declare_par_nom
  FROM utilisateurs u JOIN roles r ON r.id = u.role_id
  WHERE u.id = NEW.declare_par_id;

  SELECT parc_id INTO v_parc FROM equipements WHERE id = NEW.equipement_id;

  IF v_role = 'staff_operationnel'
     OR (v_role = 'manager_parc' AND NOT EXISTS (
           SELECT 1 FROM parcs_utilisateurs pu
           WHERE pu.utilisateur_id = NEW.declare_par_id AND pu.est_manager
             AND (v_parc IS NULL OR pu.parc_id = v_parc))) THEN
    NEW.validation_manager := 'en_attente';
  ELSIF NEW.validation_manager IS NULL OR NEW.validation_manager = 'en_attente' THEN
    NEW.validation_manager := 'auto';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_ticket_creation
  BEFORE INSERT ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_ticket_creation();

-- Nom du déclarant sur les tickets existants
UPDATE public.incidents i
SET declare_par_nom = trim(coalesce(u.prenom, '') || ' ' || coalesce(u.nom, ''))
FROM public.utilisateurs u
WHERE u.id = i.declare_par_id AND i.declare_par_nom IS NULL;

CREATE OR REPLACE FUNCTION public.valider_ticket(p_incident_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT peut_valider_ticket(p_incident_id) THEN
    RAISE EXCEPTION 'Tu ne peux pas valider ce ticket' USING ERRCODE = '42501';
  END IF;
  UPDATE incidents
  SET validation_manager = 'valide',
      valide_par_manager_id = (SELECT current_utilisateur_id()),
      valide_le = now()
  WHERE id = p_incident_id AND validation_manager = 'en_attente';
END;
$function$;

CREATE OR REPLACE FUNCTION public.supprimer_ticket(p_incident_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF length(trim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Indique le motif de la suppression';
  END IF;
  IF NOT peut_valider_ticket(p_incident_id) THEN
    RAISE EXCEPTION 'Tu ne peux pas supprimer ce ticket' USING ERRCODE = '42501';
  END IF;
  UPDATE incidents
  SET statut = 'annule',
      validation_manager = CASE WHEN validation_manager = 'en_attente' THEN 'refuse' ELSE validation_manager END,
      supprime_motif = trim(p_motif),
      supprime_par_id = (SELECT current_utilisateur_id()),
      supprime_le = now()
  WHERE id = p_incident_id AND statut <> 'annule';
END;
$function$;

REVOKE ALL ON FUNCTION public.parcs_du_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.peut_valider_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valider_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supprimer_ticket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parcs_du_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_valider_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_ticket(uuid, text) TO authenticated;