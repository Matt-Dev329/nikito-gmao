
-- ═══════════════════════════════════════════════════════════════════
-- FIX TEMPORAIRE : permettre la lecture en anon sur les tables 
-- de configuration parc (parc_attractions + parc_points_actifs)
-- 
-- CONTEXTE : tant que la page de login n'est pas opérationnelle,
-- l'app se connecte avec la clé anon. Les 4 parcs sont publics 
-- (visibles sur le site Nikito de toute façon) donc savoir qu'il y 
-- a un Karting à Domus n'est pas un secret industriel.
-- 
-- À RENFORCER après mise en place du login : restreindre en 
-- {authenticated} uniquement.
-- ═══════════════════════════════════════════════════════════════════

-- Remplacer la politique de lecture sur parc_attractions
DROP POLICY IF EXISTS "attractions_lecture_authentifies" ON parc_attractions;
CREATE POLICY "attractions_lecture_publique" ON parc_attractions 
  FOR SELECT TO anon, authenticated USING (true);

-- Même chose pour parc_points_actifs (overrides par parc)
DROP POLICY IF EXISTS "parc_points_actifs_select" ON parc_points_actifs;
DROP POLICY IF EXISTS "override_lecture_authentifies" ON parc_points_actifs;
CREATE POLICY "override_lecture_publique" ON parc_points_actifs 
  FOR SELECT TO anon, authenticated USING (true);

-- Les politiques d'écriture restent strictes (direction/chef uniquement)
-- donc personne ne peut MODIFIER les attractions ou overrides sans être connecté.

-- Vérif
SELECT tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE tablename IN ('parc_attractions', 'parc_points_actifs')
ORDER BY tablename, cmd;
;
