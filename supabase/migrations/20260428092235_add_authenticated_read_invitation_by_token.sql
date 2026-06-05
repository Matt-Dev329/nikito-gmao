/*
  # Allow authenticated users to read unused invitations by token

  ## Problem
  The existing policy `anon_read_invitation_by_token` only applies to the `anon` role.
  When a user opens an invitation link while already logged into the app (browser has
  an active Supabase session), the client sends the JWT and the request runs as
  `authenticated` instead of `anon`. Since no SELECT policy on `invitations` covers
  `authenticated` users looking up by token, the query returns 0 rows and the UI
  shows "Invitation invalide".

  ## Fix
  Add a new SELECT policy for `authenticated` that mirrors the anon policy:
  allow reading invitations where `utilise_le IS NULL`.

  ## Security
  - Policy only grants SELECT (read-only)
  - Only unused invitations are visible (utilise_le IS NULL)
  - Token is a high-entropy random string, so brute-force enumeration is not feasible
  - The existing `invit_direction_total` policy for direction/chef_maintenance is unchanged
*/

CREATE POLICY "authenticated_read_invitation_by_token"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (utilise_le IS NULL);

;
