
-- TEMPORAIRE : rouvrir en lecture anon pour que l'app fonctionne 
-- en attendant que le login frontend soit posé par Bolt.
-- À reserrer dès que la RouteProtegee sera active.

DROP POLICY IF EXISTS "attractions_lecture_authentifies" ON parc_attractions;
CREATE POLICY "attractions_lecture_publique" ON parc_attractions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "override_lecture_authentifies" ON parc_points_actifs;
CREATE POLICY "override_lecture_publique" ON parc_points_actifs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "biblio_lecture_authentifies" ON bibliotheque_points;
CREATE POLICY "biblio_lecture_publique" ON bibliotheque_points FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_lecture_authentifies" ON categories_equipement;
CREATE POLICY "categories_lecture_publique" ON categories_equipement FOR SELECT TO anon, authenticated USING (true);
;
