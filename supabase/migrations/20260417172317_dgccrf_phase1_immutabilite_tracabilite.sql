/*
  # DGCCRF Phase 1 -- Immutabilite, tracabilite et snapshots des controles

  Migration critique pour la conformite DGCCRF. Les registres de controle
  doivent avoir valeur probante pour un controleur.

  ## Sections

  1. **A -- Colonnes controles**
     - `realise_par_nom` (text) : snapshot du nom au moment du controle
     - `realise_par_role` (text) : snapshot du role
     - `signature_at` (timestamptz) : horodatage precis de la signature
     - `signature_ip` (text) : IP du signataire
     - `signature_user_agent` (text) : navigateur du signataire
     - `hash_integrite` (text) : SHA-256 calcule cote app a la validation
     - `remplace_id` (uuid, FK controles) : lien vers le controle corrige
     - `motif_correction` (text) : motif obligatoire si correction
     - Ajout valeur `remplace` a l'enum statut_controle
     - CHECK constraint : remplace_id NOT NULL => motif_correction NOT NULL

  2. **B -- Colonnes controle_items**
     - `point_libelle_snapshot` (text) : libelle du point au moment du controle
     - `point_categorie_snapshot` (text) : categorie du point
     - `point_type_controle_snapshot` (text) : quotidien/hebdo/mensuel

  3. **C -- Table controles_audit_log**
     - Journal append-only de toutes les actions sur les controles
     - Colonnes : id, controle_id, action, utilisateur_id/nom/role, details, ip, user_agent, created_at
     - Index sur (controle_id, created_at DESC)
     - RLS active

  4. **D -- Trigger immutabilite controles**
     - Empeche UPDATE/DELETE sur controles valides
     - Exception : passage au statut 'remplace'

  5. **E -- Trigger immutabilite controle_items**
     - Empeche UPDATE/DELETE sur items dont le controle parent est valide

  6. **F -- Trigger correction**
     - A l'insertion d'un controle avec remplace_id, passe l'ancien en 'remplace'

  7. **G -- Policies RLS**
     - Remplacement des policies existantes par des policies granulaires
     - Aucun DELETE autorise sur controles, controle_items, controles_audit_log
     - Audit log : append-only (INSERT seulement)

  8. **H -- Backfill**
     - Remplit realise_par_nom/role pour les controles existants ayant un realise_par_id

  ## Securite
  - RLS active sur controles_audit_log
  - Aucune policy DELETE sur les 3 tables
  - Triggers d'immutabilite sur controles et controle_items
  - Audit log append-only
*/

-- ============================================================
-- SECTION A : Ajout de colonnes a controles
-- ============================================================

-- A.1 Ajouter la valeur 'remplace' a l'enum statut_controle
ALTER TYPE statut_controle ADD VALUE IF NOT EXISTS 'remplace';

-- A.2 Colonnes de snapshot identite
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'realise_par_nom') THEN
    ALTER TABLE controles ADD COLUMN realise_par_nom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'realise_par_role') THEN
    ALTER TABLE controles ADD COLUMN realise_par_role text;
  END IF;
END $$;

-- A.3 Colonnes de signature
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'signature_at') THEN
    ALTER TABLE controles ADD COLUMN signature_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'signature_ip') THEN
    ALTER TABLE controles ADD COLUMN signature_ip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'signature_user_agent') THEN
    ALTER TABLE controles ADD COLUMN signature_user_agent text;
  END IF;
END $$;

-- A.4 Hash d'integrite
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'hash_integrite') THEN
    ALTER TABLE controles ADD COLUMN hash_integrite text;
  END IF;
END $$;

-- A.5 Mecanisme de correction
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'remplace_id') THEN
    ALTER TABLE controles ADD COLUMN remplace_id uuid REFERENCES controles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controles' AND column_name = 'motif_correction') THEN
    ALTER TABLE controles ADD COLUMN motif_correction text;
  END IF;
END $$;

-- A.6 CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_correction_motif_requis') THEN
    ALTER TABLE controles ADD CONSTRAINT chk_correction_motif_requis
      CHECK (remplace_id IS NULL OR motif_correction IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- SECTION B : Ajout de colonnes a controle_items
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controle_items' AND column_name = 'point_libelle_snapshot') THEN
    ALTER TABLE controle_items ADD COLUMN point_libelle_snapshot text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controle_items' AND column_name = 'point_categorie_snapshot') THEN
    ALTER TABLE controle_items ADD COLUMN point_categorie_snapshot text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'controle_items' AND column_name = 'point_type_controle_snapshot') THEN
    ALTER TABLE controle_items ADD COLUMN point_type_controle_snapshot text;
  END IF;
END $$;

-- ============================================================
-- SECTION C : Creation de la table controles_audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS controles_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  controle_id uuid NOT NULL REFERENCES controles(id),
  action text NOT NULL CHECK (action IN ('created', 'item_added', 'item_updated', 'photo_added', 'validated', 'corrected')),
  utilisateur_id uuid REFERENCES utilisateurs(id),
  utilisateur_nom text,
  utilisateur_role text,
  details jsonb DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_controle_date
  ON controles_audit_log (controle_id, created_at DESC);

ALTER TABLE controles_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION D : Trigger d'immutabilite sur controles
-- ============================================================

CREATE OR REPLACE FUNCTION fn_immutabilite_controles()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.statut = 'valide' THEN
      RAISE EXCEPTION 'Controle deja valide -- suppression interdite. Utilisez la procedure de correction.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.statut = 'valide' THEN
    IF NEW.statut = 'remplace' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Controle deja valide -- modification interdite. Utilisez la procedure de correction.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutabilite_controles ON controles;

CREATE TRIGGER trg_immutabilite_controles
  BEFORE UPDATE OR DELETE ON controles
  FOR EACH ROW
  EXECUTE FUNCTION fn_immutabilite_controles();

-- ============================================================
-- SECTION E : Trigger d'immutabilite sur controle_items
-- ============================================================

CREATE OR REPLACE FUNCTION fn_immutabilite_items()
RETURNS trigger AS $$
DECLARE
  v_statut text;
BEGIN
  SELECT statut::text INTO v_statut FROM controles WHERE id = OLD.controle_id;

  IF v_statut = 'valide' THEN
    RAISE EXCEPTION 'Controle parent deja valide -- modification des items interdite.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutabilite_items ON controle_items;

CREATE TRIGGER trg_immutabilite_items
  BEFORE UPDATE OR DELETE ON controle_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_immutabilite_items();

-- ============================================================
-- SECTION F : Trigger de correction
-- ============================================================

CREATE OR REPLACE FUNCTION fn_correction_controles()
RETURNS trigger AS $$
BEGIN
  IF NEW.remplace_id IS NOT NULL THEN
    UPDATE controles SET statut = 'remplace' WHERE id = NEW.remplace_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_correction_controles ON controles;

CREATE TRIGGER trg_correction_controles
  BEFORE INSERT ON controles
  FOR EACH ROW
  EXECUTE FUNCTION fn_correction_controles();

-- ============================================================
-- SECTION G : Policies RLS
-- ============================================================

-- G.1 Supprimer les anciennes policies sur controles
DROP POLICY IF EXISTS "ctrl_direction_total" ON controles;
DROP POLICY IF EXISTS "ctrl_manager_parc" ON controles;
DROP POLICY IF EXISTS "ctrl_staff_parc" ON controles;

-- G.2 Nouvelles policies SELECT sur controles
CREATE POLICY "ctrl_select_direction_cm"
  ON controles FOR SELECT TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'));

CREATE POLICY "ctrl_select_technicien"
  ON controles FOR SELECT TO authenticated
  USING (
    current_role_code() = 'technicien'
    AND parc_id = ANY (current_parc_ids())
  );

CREATE POLICY "ctrl_select_manager"
  ON controles FOR SELECT TO authenticated
  USING (
    current_role_code() = 'manager_parc'
    AND parc_id = ANY (current_parc_ids())
  );

CREATE POLICY "ctrl_select_staff"
  ON controles FOR SELECT TO authenticated
  USING (
    current_role_code() = 'staff_operationnel'
    AND parc_id = ANY (current_parc_ids())
  );

-- G.3 Policy INSERT sur controles
CREATE POLICY "ctrl_insert_roles_metier"
  ON controles FOR INSERT TO authenticated
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  );

-- G.4 Policy UPDATE sur controles
CREATE POLICY "ctrl_update_roles_metier"
  ON controles FOR UPDATE TO authenticated
  USING (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  )
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  );

-- G.5 Pas de DELETE sur controles

-- G.6 Supprimer les anciennes policies sur controle_items
DROP POLICY IF EXISTS "items_lecture_authentifies" ON controle_items;
DROP POLICY IF EXISTS "items_ecriture_roles_metier" ON controle_items;
DROP POLICY IF EXISTS "items_modification_roles_metier" ON controle_items;

-- G.7 Nouvelles policies sur controle_items
CREATE POLICY "items_select_par_acces_controle"
  ON controle_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM controles c WHERE c.id = controle_items.controle_id
    )
  );

CREATE POLICY "items_insert_roles_metier"
  ON controle_items FOR INSERT TO authenticated
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  );

CREATE POLICY "items_update_roles_metier"
  ON controle_items FOR UPDATE TO authenticated
  USING (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  )
  WITH CHECK (
    current_role_code() IN ('direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel')
  );

-- G.8 Pas de DELETE sur controle_items

-- G.9 Policies sur controles_audit_log (append-only)
CREATE POLICY "audit_insert_authentifie"
  ON controles_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "audit_select_direction_cm"
  ON controles_audit_log FOR SELECT TO authenticated
  USING (current_role_code() IN ('direction', 'chef_maintenance'));

CREATE POLICY "audit_select_par_parc"
  ON controles_audit_log FOR SELECT TO authenticated
  USING (
    current_role_code() IN ('manager_parc', 'technicien', 'staff_operationnel')
    AND EXISTS (
      SELECT 1 FROM controles c
      WHERE c.id = controles_audit_log.controle_id
      AND c.parc_id = ANY (current_parc_ids())
    )
  );

-- Pas d'UPDATE ni DELETE sur controles_audit_log

-- ============================================================
-- SECTION H : Backfill des controles existants
-- ============================================================

UPDATE controles c
SET
  realise_par_nom = u.prenom || ' ' || u.nom,
  realise_par_role = r.code::text
FROM utilisateurs u
JOIN roles r ON r.id = u.role_id
WHERE c.realise_par_id = u.id
  AND c.realise_par_nom IS NULL;
