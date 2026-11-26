-- Stock Karting : seuil d'alerte par défaut à 10 pour toute nouvelle pièce
-- (création manuelle, import de facture, catalogue), sauf seuil donné.
CREATE OR REPLACE FUNCTION public.fn_seuil_alerte_karting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(NEW.stock_min, 0) = 0
     AND NOT coalesce(NEW.est_formation, false)
     AND NEW.activite_id = (SELECT id FROM commande_activites WHERE nom = 'Karting' LIMIT 1) THEN
    NEW.stock_min := 10;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_seuil_alerte_karting BEFORE INSERT ON public.pieces_detachees
  FOR EACH ROW EXECUTE FUNCTION fn_seuil_alerte_karting();
