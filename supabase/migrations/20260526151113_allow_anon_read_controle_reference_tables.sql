/*
  # Allow anonymous read access to control reference tables

  1. Changes
    - Add SELECT policy for `anon` role on `bibliotheque_points`
    - Add SELECT policy for `anon` role on `parc_attractions`
    - Add SELECT policy for `anon` role on `parc_points_actifs`

  2. Reason
    - Staff PIN users authenticate via RPC (verifier_pin_staff) but do NOT have
      a Supabase auth session. They use the anon key to query reference data
      needed for the daily opening control screen.
    - These tables contain non-sensitive configuration data (control point
      definitions, park attractions, active point overrides).

  3. Security Notes
    - Read-only access (SELECT only)
    - No user-specific or sensitive data exposed
    - Write operations remain restricted to authenticated users
*/

-- bibliotheque_points: allow anon to read active control points
CREATE POLICY "biblio_lecture_anon"
  ON bibliotheque_points
  FOR SELECT
  TO anon
  USING (actif = true);

-- parc_attractions: allow anon to read park attractions
CREATE POLICY "attractions_lecture_anon"
  ON parc_attractions
  FOR SELECT
  TO anon
  USING (true);

-- parc_points_actifs: allow anon to read active point overrides
CREATE POLICY "ppa_lecture_anon"
  ON parc_points_actifs
  FOR SELECT
  TO anon
  USING (actif = true);
