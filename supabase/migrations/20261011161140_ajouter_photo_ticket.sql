/*
  # Ajouter une photo à un ticket

  La photo du signalement est dans incidents.photos_urls (bucket
  alba-incidents). RPC `ajouter_photo_ticket` : ajoute une photo
  supplémentaire au ticket (complément, autre angle, ticket créé sans photo),
  sans doublon, pour les rôles terrain.
*/

CREATE OR REPLACE FUNCTION public.ajouter_photo_ticket(p_incident_id uuid, p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_role text := current_role_code()::text;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(p_path), '') IS NULL THEN
    RAISE EXCEPTION 'Photo manquante';
  END IF;
  UPDATE incidents
     SET photos_urls = array_append(COALESCE(photos_urls, '{}'::text[]), p_path)
   WHERE id = p_incident_id
     AND NOT (p_path = ANY (COALESCE(photos_urls, '{}'::text[])));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ajouter_photo_ticket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_photo_ticket(uuid, text) TO authenticated;
