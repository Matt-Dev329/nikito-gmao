
-- ═══════════════════════════════════════════════════════════════════
-- FERMETURE DES LECTURES ANON SUR DONNÉES OPÉRATIONNELLES
-- 
-- Contexte : ce matin on avait ouvert parc_attractions + parc_points_actifs
-- en lecture anon pour que l'app fonctionne sans login. 
-- Maintenant que le login va être posé côté front, on referme tout.
-- 
-- SEULES exceptions gardées en anon :
--   - parcs (les 4 parcs sont déjà publics sur nikito.com)
--   - bibliotheque_points + categories_equipement (référentiels non sensibles)
-- ═══════════════════════════════════════════════════════════════════

-- Fermer parc_attractions (qui a quoi dans quel parc = info métier)
DROP POLICY IF EXISTS "attractions_lecture_publique" ON parc_attractions;
CREATE POLICY "attractions_lecture_authentifies" ON parc_attractions 
  FOR SELECT TO authenticated USING (true);

-- Fermer parc_points_actifs (les overrides par parc)
DROP POLICY IF EXISTS "override_lecture_publique" ON parc_points_actifs;
CREATE POLICY "override_lecture_authentifies" ON parc_points_actifs 
  FOR SELECT TO authenticated USING (true);

-- Fermer bibliotheque_points (finalement oui, c'est une info métier 
-- qui révèle quels contrôles on fait)
DROP POLICY IF EXISTS "biblio_lecture_tous" ON bibliotheque_points;
CREATE POLICY "biblio_lecture_authentifies" ON bibliotheque_points
  FOR SELECT TO authenticated USING (true);

-- Fermer categories_equipement (même raison)
DROP POLICY IF EXISTS "categories_lecture_tous" ON categories_equipement;
CREATE POLICY "categories_lecture_authentifies" ON categories_equipement
  FOR SELECT TO authenticated USING (true);

-- Garder parcs ouvert en anon : cela permettra à la page de login 
-- d'afficher le sélecteur "Choisis ton parc" pour le login staff par PIN
-- (pas de donnée sensible, juste les 4 noms de parcs déjà publics)
-- → pas de changement sur la politique "parcs_lecture_publique"

-- Vérification finale : combien de tables encore lisibles en anon ?
SELECT 
  tablename,
  policyname
FROM pg_policies 
WHERE schemaname = 'public' 
  AND 'anon' = ANY(roles::text[])
  AND cmd = 'SELECT'
ORDER BY tablename;
;
