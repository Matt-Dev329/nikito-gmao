/*
  # Stock : sorties pour tout le monde, entrées réservées au chef d'équipe

  - `mouvement_stock(p_piece_id, p_delta)` passe en SECURITY DEFINER :
    · sortie (delta < 0) : tous les rôles internes (direction, chef d'équipe,
      directeur de parc, manager, technicien, admin IT) ;
    · entrée (delta > 0) : chef d'équipe, direction, admin IT et
      gestionnaires des commandes uniquement.
  - Écriture directe dans `pieces_detachees` (création, modification)
    réservée à ces mêmes gestionnaires ; les autres passent par la RPC.
  - `decrement_stock` (pièces utilisées à la clôture) passe en SECURITY
    DEFINER pour continuer à sortir le stock quel que soit le rôle.
  Script rejouable.
*/

CREATE OR REPLACE FUNCTION public.peut_entrer_stock()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT (SELECT current_role_code())::text IN ('direction', 'chef_maintenance', 'admin_it')
      OR est_gestionnaire_commandes();
$$;
REVOKE EXECUTE ON FUNCTION public.peut_entrer_stock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_entrer_stock() TO authenticated;

CREATE OR REPLACE FUNCTION public.mouvement_stock(p_piece_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_stock integer;
BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;
  IF (SELECT current_role_code())::text NOT IN ('direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it') THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  IF p_delta > 0 AND NOT peut_entrer_stock() THEN
    RAISE EXCEPTION 'Seul le chef d''équipe peut ajouter du stock' USING ERRCODE = '42501';
  END IF;
  UPDATE pieces_detachees
     SET stock_actuel = GREATEST(0, stock_actuel + p_delta), modifie_le = now()
   WHERE id = p_piece_id
  RETURNING stock_actuel INTO v_stock;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pièce introuvable';
  END IF;
  RETURN v_stock;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mouvement_stock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mouvement_stock(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE pieces_detachees SET stock_actuel = GREATEST(0, stock_actuel - NEW.quantite), modifie_le = NOW()
  WHERE id = NEW.piece_id;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.decrement_stock() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "pieces_ecriture_techniciens" ON public.pieces_detachees;
DROP POLICY IF EXISTS "pieces_ecriture_gestionnaires" ON public.pieces_detachees;
CREATE POLICY "pieces_ecriture_gestionnaires" ON public.pieces_detachees FOR ALL TO authenticated
USING ((SELECT peut_entrer_stock()))
WITH CHECK ((SELECT peut_entrer_stock()));

-- Trace de la migration (repo et base synchronisés)
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016074000', 'stock_sortie_pour_tous')
ON CONFLICT (version) DO NOTHING;
