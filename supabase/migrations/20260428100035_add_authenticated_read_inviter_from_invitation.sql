/*
  # Allow authenticated users to read inviter info from utilisateurs

  ## Problem
  When an authenticated user opens an invitation link, the `fetchInvitation` query
  joins `utilisateurs` to get the inviter's name. The existing policy
  `anon_read_inviter_from_invitation` only covers the `anon` role. An authenticated
  user who is not direction/chef_maintenance/admin_it and has no row in utilisateurs
  (new user who just signed up) cannot read the inviter's info, causing the
  PostgREST embedded relation to fail and the whole query to return an error.

  ## Fix
  Add a SELECT policy for `authenticated` that mirrors the anon policy: allow
  reading utilisateurs rows that are the `invite_par_id` of an unused invitation.

  ## Security
  - Read-only (SELECT only)
  - Scoped to utilisateurs who are inviters of currently active (unused) invitations
  - Does not expose any other user data
*/

CREATE POLICY "authenticated_read_inviter_from_invitation"
  ON utilisateurs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invitations
      WHERE invitations.invite_par_id = utilisateurs.id
        AND invitations.utilise_le IS NULL
    )
  );

;
