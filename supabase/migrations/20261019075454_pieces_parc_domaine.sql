-- Stock : chaque pièce peut être rangée par parc (stock du parc ; vide = stock
-- commun) et par domaine (activité du catalogue de commandes).
-- Le domaine est repris automatiquement du produit du catalogue lié à la pièce
-- (création depuis le catalogue ou import de facture) s'il n'est pas déjà choisi.

ALTER TABLE public.pieces_detachees
  ADD COLUMN IF NOT EXISTS parc_id uuid REFERENCES public.parcs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activite_id uuid REFERENCES public.commande_activites(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pieces_detachees_parc ON public.pieces_detachees(parc_id);
CREATE INDEX IF NOT EXISTS idx_pieces_detachees_activite ON public.pieces_detachees(activite_id);

CREATE OR REPLACE FUNCTION public.fn_domaine_piece_depuis_produit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.piece_id IS NOT NULL AND NEW.activite_id IS NOT NULL THEN
    UPDATE pieces_detachees SET activite_id = NEW.activite_id
    WHERE id = NEW.piece_id AND activite_id IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.fn_domaine_piece_depuis_produit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_domaine_piece_depuis_produit
AFTER INSERT OR UPDATE OF piece_id, activite_id ON public.commande_produits
FOR EACH ROW EXECUTE FUNCTION public.fn_domaine_piece_depuis_produit();

-- Pièces déjà liées au catalogue
UPDATE public.pieces_detachees p SET activite_id = c.activite_id
FROM public.commande_produits c
WHERE c.piece_id = p.id AND p.activite_id IS NULL;
