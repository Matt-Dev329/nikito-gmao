/*
  # RPC : signalements du jour d'un utilisateur (page staff « Mes signalements »)

  Le staff opérationnel accède via la clé anon (pas d'auth.uid()), il ne peut donc
  pas lire la table incidents directement (RLS). Cette RPC SECURITY DEFINER renvoie
  les incidents qu'il a déclarés aujourd'hui — parité avec les autres RPC staff.
*/
CREATE OR REPLACE FUNCTION public.incidents_du_jour_utilisateur(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  numero_bt text,
  titre text,
  description text,
  statut public.statut_incident,
  declare_le timestamptz,
  equipement_libelle text,
  equipement_code text,
  parc_nom text,
  priorite_nom text,
  priorite_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT i.id, i.numero_bt, i.titre, i.description, i.statut, i.declare_le,
         e.libelle, e.code, p.nom, np.nom, np.code::text
  FROM incidents i
  LEFT JOIN equipements e ON e.id = i.equipement_id
  LEFT JOIN parcs p ON p.id = e.parc_id
  LEFT JOIN niveaux_priorite np ON np.id = i.priorite_id
  WHERE i.declare_par_id = p_user_id
    AND i.declare_le >= date_trunc('day', now())
    AND i.est_brouillon = false
  ORDER BY i.declare_le DESC;
$$;

GRANT EXECUTE ON FUNCTION public.incidents_du_jour_utilisateur(uuid) TO anon, authenticated;
