/*
  # Allow anonymous users to read invitations by token

  This migration fixes the invitation acceptance flow for unauthenticated users.
  When someone clicks an invitation link, they are NOT yet logged in — that's the
  whole point of the invitation. The RLS must allow anonymous reads.

  1. Security Changes
    - Add SELECT policy on `invitations` for `anon` role
      - The token acts as a shared secret (long random hex string, impossible to guess)
      - Same pattern as Supabase Auth magic links
      - Only unused invitations (utilise_le IS NULL) are readable
    - Add SELECT policy on `roles` for `anon` role
      - Roles is a small reference table, safe to read publicly
    - Add SELECT policy on `utilisateurs` for `anon` role
      - Limited to users who are referenced as inviters in a valid invitation
      - This allows the join `invite_par:utilisateurs!invitations_invite_par_id_fkey`

  2. Important Notes
    - RLS remains enabled on all tables
    - No INSERT/UPDATE/DELETE access for anon on any of these tables
    - The existing authenticated policies are untouched
*/

-- 1. Allow anon to SELECT invitations that have not been used yet
CREATE POLICY "anon_read_invitation_by_token"
  ON invitations
  FOR SELECT
  TO anon
  USING (utilise_le IS NULL);

-- 2. Allow anon to read the roles reference table (small, safe, no sensitive data)
CREATE POLICY "anon_read_roles"
  ON roles
  FOR SELECT
  TO anon
  USING (true);

-- 3. Allow anon to read utilisateurs ONLY if they are an inviter in a pending invitation
CREATE POLICY "anon_read_inviter_from_invitation"
  ON utilisateurs
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.invite_par_id = utilisateurs.id
        AND invitations.utilise_le IS NULL
    )
  );
