/*
  # Restrict codes_2fa INSERT policy

  1. Security changes
    - Drop the overly broad INSERT policy on codes_2fa that used WITH CHECK (true)
    - Replace with a policy that restricts inserts to the authenticated user's own email
    - Uses auth.jwt() to extract the email from the JWT claims

  2. Notes
    - The 2FA code is inserted right after signInWithPassword succeeds,
      so the user is authenticated and their JWT contains their email
*/

DROP POLICY IF EXISTS "codes_2fa_insert" ON codes_2fa;

CREATE POLICY "codes_2fa_insert_own_email"
  ON codes_2fa FOR INSERT
  TO authenticated
  WITH CHECK (email = (auth.jwt()->>'email'));
