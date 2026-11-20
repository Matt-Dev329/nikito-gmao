-- Catalogue pièces karting interne (Sodi RSX2 V2) : ensembles (vue éclatée)
-- et pièces (repère, référence, désignation…). Chaque pièce est aussi entrée
-- dans le stock Karting (fiche existante reliée, sinon créée à 0).
-- Accès : chef d'équipe, direction, admin IT et technicien Karting.
CREATE OR REPLACE FUNCTION public.acces_catalogue_karting()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  SELECT coalesce((SELECT current_role_code())::text IN ('chef_maintenance', 'direction', 'admin_it'), false)
      OR (SELECT est_technicien_karting());
$function$;
REVOKE EXECUTE ON FUNCTION public.acces_catalogue_karting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acces_catalogue_karting() TO authenticated;

CREATE TABLE public.catalogue_ensembles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modele text NOT NULL DEFAULT 'Sodi RSX2 V2',
  nom text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  image_chemin text,
  image_mime text,
  actif boolean NOT NULL DEFAULT true,
  cree_par_id uuid REFERENCES public.utilisateurs(id),
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalogue_ensembles_cree_par_idx ON public.catalogue_ensembles(cree_par_id);

CREATE TABLE public.catalogue_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ensemble_id uuid NOT NULL REFERENCES public.catalogue_ensembles(id) ON DELETE CASCADE,
  repere text,
  reference text NOT NULL,
  designation text NOT NULL,
  quantite numeric,
  prix_ht numeric,
  piece_id uuid REFERENCES public.pieces_detachees(id) ON DELETE SET NULL,
  ordre integer NOT NULL DEFAULT 0,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalogue_pieces_ensemble_idx ON public.catalogue_pieces(ensemble_id);
CREATE INDEX catalogue_pieces_piece_idx ON public.catalogue_pieces(piece_id);
CREATE INDEX catalogue_pieces_reference_idx ON public.catalogue_pieces(lower(reference));

CREATE TRIGGER trg_um_catalogue_ensembles BEFORE UPDATE ON public.catalogue_ensembles
  FOR EACH ROW EXECUTE FUNCTION update_modifie_le();

ALTER TABLE public.catalogue_ensembles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogue_ensembles_acces ON public.catalogue_ensembles FOR ALL TO authenticated
  USING ((SELECT acces_catalogue_karting())) WITH CHECK ((SELECT acces_catalogue_karting()));
CREATE POLICY catalogue_pieces_acces ON public.catalogue_pieces FOR ALL TO authenticated
  USING ((SELECT acces_catalogue_karting())) WITH CHECK ((SELECT acces_catalogue_karting()));

-- Images des vues éclatées (et captures importées)
INSERT INTO storage.buckets (id, name, public) VALUES ('alba-catalogue', 'alba-catalogue', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY alba_catalogue_lecture ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'alba-catalogue' AND (SELECT acces_catalogue_karting()));
CREATE POLICY alba_catalogue_ajout ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'alba-catalogue' AND (SELECT acces_catalogue_karting()));
CREATE POLICY alba_catalogue_modification ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'alba-catalogue' AND (SELECT acces_catalogue_karting()));
CREATE POLICY alba_catalogue_suppression ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'alba-catalogue' AND (SELECT acces_catalogue_karting()));

-- Entrée au stock Karting des pièces d'un ensemble : référence déjà au stock
-- => reliée ; sinon fiche créée (stock 0, minimum 0 : pas d'alerte rupture).
CREATE OR REPLACE FUNCTION public.catalogue_vers_stock(p_ensemble_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_karting uuid := (SELECT id FROM commande_activites WHERE nom = 'Karting' LIMIT 1);
  v_sodi uuid := (SELECT id FROM fournisseurs WHERE nom ILIKE 'sodikart' LIMIT 1);
  v_p record;
  v_piece uuid;
  v_crees int := 0;
  v_relies int := 0;
BEGIN
  IF NOT acces_catalogue_karting() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  FOR v_p IN
    SELECT * FROM catalogue_pieces WHERE ensemble_id = p_ensemble_id AND piece_id IS NULL ORDER BY ordre
  LOOP
    SELECT id INTO v_piece FROM pieces_detachees WHERE lower(trim(reference)) = lower(trim(v_p.reference)) LIMIT 1;
    IF v_piece IS NULL THEN
      INSERT INTO pieces_detachees (reference, nom, description, fournisseur_id, stock_actuel, stock_min, prix_unitaire_ht, activite_id)
      VALUES (trim(v_p.reference), left(trim(v_p.designation), 300), 'Catalogue Sodi RSX2 V2', v_sodi, 0, 0, v_p.prix_ht, v_karting)
      ON CONFLICT (reference) DO NOTHING
      RETURNING id INTO v_piece;
      IF v_piece IS NULL THEN
        SELECT id INTO v_piece FROM pieces_detachees WHERE reference = trim(v_p.reference);
        v_relies := v_relies + 1;
      ELSE
        v_crees := v_crees + 1;
      END IF;
    ELSE
      v_relies := v_relies + 1;
    END IF;
    UPDATE catalogue_pieces SET piece_id = v_piece WHERE id = v_p.id;
  END LOOP;
  RETURN jsonb_build_object('crees', v_crees, 'relies', v_relies);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.catalogue_vers_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogue_vers_stock(uuid) TO authenticated;

-- Stock des pièces du catalogue (le technicien Karting voit le stock Karting)
CREATE OR REPLACE FUNCTION public.stock_pieces_catalogue()
 RETURNS TABLE(catalogue_piece_id uuid, stock_actuel integer, emplacement text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT acces_catalogue_karting() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT cp.id, pd.stock_actuel, pd.emplacement
  FROM catalogue_pieces cp JOIN pieces_detachees pd ON pd.id = cp.piece_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.stock_pieces_catalogue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stock_pieces_catalogue() TO authenticated;

-- Le technicien Karting et le rôle « Arcade consultation » : pas d'accès
-- en écriture au-delà (la garde de requêtes bloque déjà Arcade consultation).