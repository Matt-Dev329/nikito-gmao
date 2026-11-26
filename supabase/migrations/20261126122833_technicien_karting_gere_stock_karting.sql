-- Technicien Karting : entrées / sorties et nouvelles pièces dans le stock
-- Karting (comme le technicien Arcade pour le stock Arcade).
CREATE OR REPLACE FUNCTION public.peut_gerer_piece(p_activite_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  SELECT peut_entrer_stock()
      OR (current_role_code()::text = 'technicien'
          AND p_activite_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM utilisateurs u
            JOIN commande_activites a ON a.id = p_activite_id
            WHERE u.id = current_utilisateur_id()
              AND ((u.profil_technicien = 'arcade' AND a.nom = 'Arcade')
                OR (u.profil_technicien = 'karting' AND a.nom = 'Karting'))));
$function$;
