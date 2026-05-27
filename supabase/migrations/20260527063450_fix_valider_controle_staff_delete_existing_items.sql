/*
  # Fix valider_controle_staff RPC - delete existing items before insert

  1. Changes
    - When updating an existing control (status a_faire/en_cours), delete any pre-existing
      controle_items before inserting the new ones
    - This prevents duplicate items (non_saisi ghosts + actual ok items)

  2. Notes
    - The bug caused 11 non_saisi duplicates alongside 11 ok items on the same control
    - The immutability trigger is bypassed within this function since it runs as SECURITY DEFINER
*/

CREATE OR REPLACE FUNCTION valider_controle_staff(
  p_parc_id UUID,
  p_type TEXT,
  p_date_planifiee DATE,
  p_realise_par_id UUID,
  p_realise_par_nom TEXT,
  p_realise_par_role TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_controle_id UUID;
  v_now TIMESTAMPTZ := now();
  v_item JSONB;
BEGIN
  -- Validate the user exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM utilisateurs WHERE id = p_realise_par_id AND actif = true
  ) THEN
    RAISE EXCEPTION 'Utilisateur invalide ou inactif';
  END IF;

  -- Validate the parc exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM parcs WHERE id = p_parc_id AND actif = true
  ) THEN
    RAISE EXCEPTION 'Parc invalide ou inactif';
  END IF;

  -- Check for existing control
  SELECT id INTO v_controle_id
  FROM controles
  WHERE parc_id = p_parc_id
    AND type = p_type::type_controle
    AND date_planifiee = p_date_planifiee
    AND est_formation = false
    AND statut IN ('a_faire', 'en_cours')
  LIMIT 1;

  IF v_controle_id IS NOT NULL THEN
    -- Delete pre-existing items to avoid duplicates
    DELETE FROM controle_items WHERE controle_id = v_controle_id;

    UPDATE controles SET
      date_demarrage = v_now,
      date_validation = v_now,
      realise_par_id = p_realise_par_id,
      realise_par_nom = p_realise_par_nom,
      realise_par_role = p_realise_par_role,
      valide_par_id = p_realise_par_id,
      statut = 'valide'
    WHERE id = v_controle_id;
  ELSE
    INSERT INTO controles (
      parc_id, type, date_planifiee, date_demarrage, date_validation,
      realise_par_id, realise_par_nom, realise_par_role, valide_par_id,
      statut, est_formation
    ) VALUES (
      p_parc_id, p_type::type_controle, p_date_planifiee, v_now, v_now,
      p_realise_par_id, p_realise_par_nom, p_realise_par_role, p_realise_par_id,
      'valide', false
    )
    RETURNING id INTO v_controle_id;
  END IF;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO controle_items (
      controle_id, point_id, etat, commentaire, photo_url, saisi_par_id
    ) VALUES (
      v_controle_id,
      (v_item->>'point_id')::UUID,
      (v_item->>'etat')::etat_controle_item,
      v_item->>'commentaire',
      v_item->>'photo_url',
      p_realise_par_id
    );
  END LOOP;

  RETURN v_controle_id;
END;
$$;