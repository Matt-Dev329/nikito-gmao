/*
  # Allow anonymous write access to controles tables for staff PIN users

  1. Changes
    - Add INSERT policy for `anon` on `controles` table
    - Add UPDATE policy for `anon` on `controles` table
    - Add SELECT policy for `anon` on `controles` table
    - Add INSERT policy for `anon` on `controle_items` table

  2. Reason
    - Staff PIN users (daily opening control) do NOT have a Supabase auth session.
    - They need to create and validate controls (insert into controles + controle_items).
    - The staff identity is verified upstream via the verifier_pin_staff RPC.

  3. Security Notes
    - INSERT restricted to controls where realise_par_id is provided (not null)
    - UPDATE restricted to controls in 'a_faire' or 'en_cours' status only
    - These are operational data entries, not admin operations
*/

-- controles: allow anon to SELECT (needed for checking existing control)
CREATE POLICY "ctrl_select_anon_staff"
  ON controles
  FOR SELECT
  TO anon
  USING (true);

-- controles: allow anon to INSERT new controls
CREATE POLICY "ctrl_insert_anon_staff"
  ON controles
  FOR INSERT
  TO anon
  WITH CHECK (realise_par_id IS NOT NULL);

-- controles: allow anon to UPDATE controls in progress
CREATE POLICY "ctrl_update_anon_staff"
  ON controles
  FOR UPDATE
  TO anon
  USING (statut IN ('a_faire', 'en_cours'))
  WITH CHECK (realise_par_id IS NOT NULL);

-- controle_items: allow anon to INSERT items
CREATE POLICY "items_insert_anon_staff"
  ON controle_items
  FOR INSERT
  TO anon
  WITH CHECK (saisi_par_id IS NOT NULL);
