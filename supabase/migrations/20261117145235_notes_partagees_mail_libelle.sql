-- Correctif : le nom d'un équipement est dans la colonne « libelle »
CREATE OR REPLACE FUNCTION public.mail_note_partagee(p_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_note notes_partagees%ROWTYPE;
  v_ticket incidents%ROWTYPE;
  v_commande commandes%ROWTYPE;
  v_parc uuid;
  v_objet text;
  v_lien text;
  v_emails text[];
BEGIN
  SELECT * INTO v_note FROM notes_partagees WHERE id = p_note_id AND actif;
  IF v_note.id IS NULL THEN RETURN NULL; END IF;

  IF v_note.objet_type = 'ticket' THEN
    SELECT * INTO v_ticket FROM incidents WHERE id = v_note.objet_id;
    IF v_ticket.id IS NULL THEN RETURN NULL; END IF;
    v_parc := parc_de_ticket(v_ticket.equipement_id, v_ticket.meta, v_ticket.declare_par_id);
    v_objet := 'Ticket ' || v_ticket.numero_bt || COALESCE(' · ' || nullif(trim(v_ticket.titre), ''), '')
               || COALESCE(' · ' || (SELECT libelle FROM equipements WHERE id = v_ticket.equipement_id), '');
    v_lien := '/gmao/operations/' || v_ticket.numero_bt;
  ELSE
    SELECT * INTO v_commande FROM commandes WHERE id = v_note.objet_id;
    IF v_commande.id IS NULL THEN RETURN NULL; END IF;
    v_parc := v_commande.parc_id;
    v_objet := 'Commande ' || v_commande.numero;
    v_lien := '/gmao/commander';
  END IF;

  SELECT array_agg(DISTINCT u.email) INTO v_emails
  FROM utilisateurs u JOIN roles r ON r.id = u.role_id
  WHERE u.actif AND u.email IS NOT NULL AND u.id <> v_note.auteur_id
    AND (r.code IN ('chef_maintenance', 'direction')
         OR (r.code = 'directeur_parc' AND EXISTS (
               SELECT 1 FROM parcs_utilisateurs pu WHERE pu.utilisateur_id = u.id AND pu.parc_id = v_parc)));

  RETURN jsonb_build_object(
    'emails', COALESCE(to_jsonb(v_emails), '[]'::jsonb),
    'objet', v_objet,
    'lien', v_lien,
    'parc', (SELECT nom FROM parcs WHERE id = v_parc),
    'auteur', (SELECT trim(prenom || ' ' || nom) FROM utilisateurs WHERE id = v_note.auteur_id),
    'texte', v_note.texte,
    'cree_le', v_note.cree_le);
END;
$function$;