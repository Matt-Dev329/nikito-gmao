/*
  # Double authentification (2FA) - Tables devices reconnus et codes 2FA

  1. Nouvelles tables
    - `devices_reconnus`
      - `id` (uuid, primary key)
      - `utilisateur_id` (uuid, FK vers utilisateurs)
      - `device_hash` (text) - identifiant unique du navigateur
      - `nom_device` (text) - ex: "Windows", "MacIntel"
      - `navigateur` (text) - extrait du user agent
      - `ip` (text) - adresse IP lors de l'enregistrement
      - `derniere_connexion` (timestamptz) - derniere utilisation du device
      - `expire_le` (timestamptz) - expiration automatique a 14 jours
      - `actif` (boolean) - permet de revoquer un device
      - `cree_le` (timestamptz)

    - `codes_2fa`
      - `id` (uuid, primary key)
      - `email` (text) - email de l'utilisateur
      - `code` (text) - code a 6 chiffres
      - `expire_le` (timestamptz) - expiration a 10 minutes
      - `utilise` (boolean) - marque le code comme consomme
      - `tentatives` (integer) - nombre de tentatives echouees
      - `cree_le` (timestamptz)

  2. Securite
    - RLS active sur les deux tables
    - devices_reconnus : l'utilisateur ne voit/modifie que ses propres devices
    - codes_2fa : accessible en anon+authenticated pour le flow de login 2FA
    - Index sur (utilisateur_id, device_hash) pour recherche rapide de device

  3. Notes
    - Les codes 2FA expirent apres 10 minutes
    - Les devices reconnus expirent apres 14 jours
    - Apres 5 tentatives echouees, le code est invalide
*/

-- ============================================
-- Table devices_reconnus
-- ============================================
CREATE TABLE IF NOT EXISTS devices_reconnus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id),
  device_hash text NOT NULL,
  nom_device text,
  navigateur text,
  ip text,
  derniere_connexion timestamptz DEFAULT now(),
  expire_le timestamptz DEFAULT (now() + interval '14 days'),
  actif boolean DEFAULT true,
  cree_le timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_user ON devices_reconnus (utilisateur_id, device_hash);

ALTER TABLE devices_reconnus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_select_own" ON devices_reconnus FOR SELECT TO authenticated
  USING (utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid()));

CREATE POLICY "device_insert_auth" ON devices_reconnus FOR INSERT TO authenticated
  WITH CHECK (utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid()));

CREATE POLICY "device_update_own" ON devices_reconnus FOR UPDATE TO authenticated
  USING (utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid()))
  WITH CHECK (utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid()));

CREATE POLICY "device_delete_own" ON devices_reconnus FOR DELETE TO authenticated
  USING (utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid()));

-- ============================================
-- Table codes_2fa
-- ============================================
CREATE TABLE IF NOT EXISTS codes_2fa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expire_le timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  utilise boolean DEFAULT false,
  tentatives integer DEFAULT 0,
  cree_le timestamptz DEFAULT now()
);

ALTER TABLE codes_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "codes_2fa_select" ON codes_2fa FOR SELECT TO anon, authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR current_setting('request.jwt.claims', true)::json->>'email' IS NOT NULL);

CREATE POLICY "codes_2fa_insert" ON codes_2fa FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "codes_2fa_update" ON codes_2fa FOR UPDATE TO anon, authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR current_setting('request.jwt.claims', true)::json->>'email' IS NOT NULL)
  WITH CHECK (email = current_setting('request.jwt.claims', true)::json->>'email' OR current_setting('request.jwt.claims', true)::json->>'email' IS NOT NULL);

-- ============================================
-- RPC: verifier_device_reconnu (callable post-login)
-- ============================================
CREATE OR REPLACE FUNCTION verifier_device_reconnu(p_email text, p_device_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM devices_reconnus d
    JOIN utilisateurs u ON u.id = d.utilisateur_id
    WHERE u.email = p_email
      AND d.device_hash = p_device_hash
      AND d.actif = true
      AND d.expire_le > now()
  );
$$;

-- ============================================
-- RPC: verifier_code_2fa (callable post-login)
-- ============================================
CREATE OR REPLACE FUNCTION verifier_code_2fa(p_email text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record codes_2fa%ROWTYPE;
  v_total_attempts integer;
BEGIN
  SELECT count(*)
  INTO v_total_attempts
  FROM codes_2fa
  WHERE email = p_email
    AND utilise = false
    AND expire_le > now()
    AND tentatives >= 5;

  IF v_total_attempts > 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'blocked');
  END IF;

  SELECT *
  INTO v_record
  FROM codes_2fa
  WHERE email = p_email
    AND code = p_code
    AND utilise = false
    AND expire_le > now()
    AND tentatives < 5
  ORDER BY cree_le DESC
  LIMIT 1;

  IF v_record.id IS NULL THEN
    UPDATE codes_2fa
    SET tentatives = tentatives + 1
    WHERE email = p_email
      AND utilise = false
      AND expire_le > now();

    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  UPDATE codes_2fa SET utilise = true WHERE id = v_record.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- RPC: enregistrer_device (callable post-2FA)
-- ============================================
CREATE OR REPLACE FUNCTION enregistrer_device(
  p_device_hash text,
  p_nom_device text,
  p_navigateur text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_utilisateur_id uuid;
BEGIN
  SELECT id INTO v_utilisateur_id
  FROM utilisateurs
  WHERE auth_user_id = auth.uid();

  IF v_utilisateur_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO devices_reconnus (utilisateur_id, device_hash, nom_device, navigateur, derniere_connexion, expire_le)
  VALUES (v_utilisateur_id, p_device_hash, p_nom_device, p_navigateur, now(), now() + interval '14 days')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================
-- RPC: rafraichir_device (update last connexion)
-- ============================================
CREATE OR REPLACE FUNCTION rafraichir_device(p_device_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE devices_reconnus
  SET derniere_connexion = now(),
      expire_le = now() + interval '14 days'
  WHERE device_hash = p_device_hash
    AND utilisateur_id = (SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid())
    AND actif = true;
END;
$$;
