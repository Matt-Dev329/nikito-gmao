/*
  # Restrict 3 overly broad RLS policies from public/anon to authenticated

  1. Security Changes
    - `bibliotheque_points`: Drop "biblio_lecture_publique" (accessible by anon), replace with "biblio_lecture_authentifies" (authenticated only)
    - `parc_attractions`: Drop "attractions_lecture_publique" (accessible by anon), replace with "attractions_lecture_authentifies" (authenticated only)
    - `parc_points_actifs`: Drop "override_lecture_publique" (accessible by anon), replace with "override_lecture_authentifies" (authenticated only)

  2. Important Notes
    - These tables contained SELECT policies using USING(true) with TO public, meaning unauthenticated users could read data
    - The new policies still use USING(true) but restrict access to authenticated users only
    - This prevents anonymous API access to internal business data
*/

DROP POLICY IF EXISTS "biblio_lecture_publique" ON bibliotheque_points;
CREATE POLICY "biblio_lecture_authentifies"
  ON bibliotheque_points
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "attractions_lecture_publique" ON parc_attractions;
CREATE POLICY "attractions_lecture_authentifies"
  ON parc_attractions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "override_lecture_publique" ON parc_points_actifs;
CREATE POLICY "override_lecture_authentifies"
  ON parc_points_actifs
  FOR SELECT
  TO authenticated
  USING (true);
