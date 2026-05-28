/*
  # Create WebAuthn credentials table for biometric authentication

  1. New Tables
    - `webauthn_credentials`
      - `id` (uuid, primary key) - unique credential ID
      - `utilisateur_id` (uuid, FK to utilisateurs) - owner of this credential
      - `credential_id` (text) - WebAuthn credential ID (base64url encoded)
      - `public_key` (text) - COSE public key (base64url encoded)
      - `counter` (bigint) - signature counter for replay protection
      - `device_name` (text) - user-friendly device name (e.g. "iPhone de Matthieu")
      - `transports` (text[]) - available transports (usb, ble, nfc, internal)
      - `cree_le` (timestamptz) - creation date
      - `derniere_utilisation` (timestamptz) - last used date
      - `actif` (boolean) - whether the credential is active

    - `webauthn_challenges`
      - `id` (uuid, primary key)
      - `challenge` (text) - random challenge (base64url encoded)
      - `type` (text) - 'registration' or 'authentication'
      - `utilisateur_id` (uuid, nullable) - for registration challenges
      - `email` (text, nullable) - for authentication challenges
      - `expire_le` (timestamptz) - expiry (5 minutes)
      - `utilise` (boolean) - whether already consumed

  2. Security
    - RLS enabled on both tables
    - Users can only read/manage their own credentials
    - Challenges are write-only from edge functions (service role)
*/

-- Credentials table
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text NOT NULL DEFAULT 'Appareil biometrique',
  transports text[] DEFAULT ARRAY[]::text[],
  cree_le timestamptz NOT NULL DEFAULT now(),
  derniere_utilisation timestamptz,
  actif boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_webauthn_creds_utilisateur ON webauthn_credentials(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_creds_credential_id ON webauthn_credentials(credential_id);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
  ON webauthn_credentials FOR SELECT TO authenticated
  USING (utilisateur_id = (SELECT urc.utilisateur_id FROM user_role_cache urc WHERE urc.auth_user_id = auth.uid()));

CREATE POLICY "Users can delete own credentials"
  ON webauthn_credentials FOR DELETE TO authenticated
  USING (utilisateur_id = (SELECT urc.utilisateur_id FROM user_role_cache urc WHERE urc.auth_user_id = auth.uid()));

CREATE POLICY "Service role can insert credentials"
  ON webauthn_credentials FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update credentials"
  ON webauthn_credentials FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- Challenges table (ephemeral, cleaned up regularly)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL,
  type text NOT NULL CHECK (type IN ('registration', 'authentication')),
  utilisateur_id uuid REFERENCES utilisateurs(id) ON DELETE CASCADE,
  email text,
  expire_le timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  utilise boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_challenge ON webauthn_challenges(challenge);

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Only service_role can access challenges (edge functions use service role)
CREATE POLICY "Service role full access challenges"
  ON webauthn_challenges FOR ALL TO service_role
  USING (true) WITH CHECK (true);
