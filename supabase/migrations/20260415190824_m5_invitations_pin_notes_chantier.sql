-- ============================================================
-- M5 · Invitations utilisateurs + PIN staff + Notes chantier
-- ============================================================

-- 1. Ajout du statut de validation et du PIN staff sur utilisateurs
ALTER TABLE utilisateurs
  ADD COLUMN statut_validation TEXT
    CHECK (statut_validation IN ('en_attente', 'valide', 'refuse', 'desactive'))
    DEFAULT 'en_attente',
  ADD COLUMN code_pin_hash TEXT,             -- bcrypt du code 6 chiffres pour staff
  ADD COLUMN code_pin_genere_le TIMESTAMPTZ,
  ADD COLUMN auth_mode TEXT
    CHECK (auth_mode IN ('email_password', 'pin_seul'))
    DEFAULT 'email_password',
  ADD COLUMN valide_par_id UUID REFERENCES utilisateurs(id),
  ADD COLUMN valide_le TIMESTAMPTZ;

CREATE INDEX idx_users_statut ON utilisateurs(statut_validation);
CREATE INDEX idx_users_auth_mode ON utilisateurs(auth_mode);

-- 2. Table invitations (lien d'invitation à durée limitée)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,                -- token aléatoire dans le lien
  email TEXT,                                -- pré-rempli (optionnel pour staff)
  prenom TEXT,
  nom TEXT,
  role_id UUID NOT NULL REFERENCES roles(id),
  parcs_assignes UUID[] DEFAULT ARRAY[]::UUID[],
  est_manager BOOLEAN DEFAULT FALSE,
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('email_password', 'pin_seul')),
  invite_par_id UUID NOT NULL REFERENCES utilisateurs(id),
  invite_le TIMESTAMPTZ DEFAULT NOW(),
  expire_le TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  utilise_le TIMESTAMPTZ,
  utilisateur_cree_id UUID REFERENCES utilisateurs(id),
  notes TEXT
);
CREATE INDEX idx_invit_token ON invitations(token) WHERE utilise_le IS NULL;
CREATE INDEX idx_invit_expire ON invitations(expire_le) WHERE utilise_le IS NULL;

-- 3. Table notes_chantier (vie d'un parc · chantier + travaux + audits)
CREATE TYPE categorie_note_chantier AS ENUM (
  'chantier_initial',
  'travaux',
  'audit',
  'reunion_fournisseur',
  'reglementaire',
  'autre'
);

CREATE TABLE notes_chantier (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parc_id UUID NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  date_reunion DATE NOT NULL,
  categorie categorie_note_chantier NOT NULL DEFAULT 'autre',
  titre TEXT NOT NULL,
  participants TEXT[] DEFAULT ARRAY[]::TEXT[],
  contenu_md TEXT NOT NULL,
  decisions TEXT[] DEFAULT ARRAY[]::TEXT[],
  pieces_jointes JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  cree_par_id UUID REFERENCES utilisateurs(id),
  cree_le TIMESTAMPTZ DEFAULT NOW(),
  modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notes_parc_date ON notes_chantier(parc_id, date_reunion DESC);
CREATE INDEX idx_notes_categorie ON notes_chantier(categorie);

CREATE TRIGGER trg_um_notes_chantier
  BEFORE UPDATE ON notes_chantier
  FOR EACH ROW EXECUTE FUNCTION update_modifie_le();

ALTER TABLE notes_chantier ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_direction_total" ON notes_chantier FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance'));
CREATE POLICY "notes_manager_lecture_son_parc" ON notes_chantier FOR SELECT
  USING (current_role_code() = 'manager_parc' AND parc_id = ANY(current_parc_ids()));

-- 4. RLS invitations (seules direction et chef équipe peuvent inviter)
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invit_direction_total" ON invitations FOR ALL
  USING (current_role_code() IN ('direction','chef_maintenance'));

-- 5. Fonction RPC · vérifier le code PIN staff (login)
-- Côté front : appel via supabase.rpc('verifier_pin_staff', {parc_code, pin_clair})
CREATE OR REPLACE FUNCTION verifier_pin_staff(p_parc_code TEXT, p_pin TEXT)
RETURNS TABLE(utilisateur_id UUID, prenom TEXT, nom TEXT, trigramme TEXT, role_code role_utilisateur) AS $$
DECLARE
  v_parc_id UUID;
BEGIN
  SELECT id INTO v_parc_id FROM parcs WHERE code = p_parc_code AND actif = TRUE;
  IF v_parc_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT u.id, u.prenom, u.nom, u.trigramme, r.code
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  JOIN parcs_utilisateurs pu ON pu.utilisateur_id = u.id
  WHERE pu.parc_id = v_parc_id
    AND u.auth_mode = 'pin_seul'
    AND u.statut_validation = 'valide'
    AND u.code_pin_hash = crypt(p_pin, u.code_pin_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fonction RPC · accepter une invitation (utilisée par la page /invitation/:token)
CREATE OR REPLACE FUNCTION accepter_invitation(
  p_token TEXT,
  p_auth_user_id UUID,           -- Si email_password : ID Supabase Auth créé en parallèle
  p_pin_clair TEXT DEFAULT NULL  -- Si pin_seul : code 6 chiffres choisi par staff
)
RETURNS UUID AS $$
DECLARE
  v_invit invitations%ROWTYPE;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_invit FROM invitations
  WHERE token = p_token AND utilise_le IS NULL AND expire_le > NOW();

  IF v_invit.id IS NULL THEN
    RAISE EXCEPTION 'Invitation invalide ou expirée';
  END IF;

  INSERT INTO utilisateurs (
    auth_user_id, email, nom, prenom,
    role_id, auth_mode, statut_validation,
    code_pin_hash, code_pin_genere_le, valide_par_id, valide_le
  ) VALUES (
    p_auth_user_id,
    v_invit.email,
    v_invit.nom,
    v_invit.prenom,
    v_invit.role_id,
    v_invit.auth_mode,
    'valide',
    CASE WHEN p_pin_clair IS NOT NULL THEN crypt(p_pin_clair, gen_salt('bf')) ELSE NULL END,
    CASE WHEN p_pin_clair IS NOT NULL THEN NOW() ELSE NULL END,
    v_invit.invite_par_id,
    NOW()
  )
  RETURNING id INTO v_user_id;

  -- Lier au(x) parc(s)
  IF array_length(v_invit.parcs_assignes, 1) > 0 THEN
    INSERT INTO parcs_utilisateurs (utilisateur_id, parc_id, est_manager)
    SELECT v_user_id, unnest(v_invit.parcs_assignes), v_invit.est_manager;
  END IF;

  -- Marquer invitation utilisée
  UPDATE invitations SET utilise_le = NOW(), utilisateur_cree_id = v_user_id
  WHERE id = v_invit.id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
