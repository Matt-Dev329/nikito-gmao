-- 2 · TYPES ÉNUMÉRÉS
CREATE TYPE etat_controle_item AS ENUM ('ok', 'degrade', 'hs');
CREATE TYPE statut_incident AS ENUM ('ouvert', 'assigne', 'en_cours', 'resolu', 'ferme', 'annule');
CREATE TYPE statut_controle AS ENUM ('a_faire', 'en_cours', 'valide', 'echec');
CREATE TYPE type_controle AS ENUM ('quotidien', 'hebdo', 'mensuel');
CREATE TYPE type_maintenance AS ENUM (
  'preventif_systematique','preventif_conditionnel','preventif_previsionnel',
  'correctif_palliatif','correctif_curatif','reglementaire','amelioration','travaux_neufs'
);
CREATE TYPE statut_5_pourquoi AS ENUM ('ouvert', 'valide', 'audit_en_cours', 'clos');
CREATE TYPE role_utilisateur AS ENUM ('direction','chef_maintenance','manager_parc','technicien','staff_operationnel');

-- DOMAINE 1 · RÉFÉRENTIEL
CREATE TABLE parcs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, nom TEXT NOT NULL, adresse TEXT NOT NULL,
  ville TEXT NOT NULL, code_postal TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
  surface_m2 INTEGER, google_place_id TEXT,
  ouvert_7j7 BOOLEAN DEFAULT FALSE, actif BOOLEAN DEFAULT TRUE,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parc_id UUID NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  nom TEXT NOT NULL, ordre INTEGER NOT NULL,
  coordonnees_plan JSONB, cree_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parc_id, ordre)
);
CREATE INDEX idx_zones_parc ON zones(parc_id);
CREATE TABLE categories_equipement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT UNIQUE NOT NULL, description TEXT,
  criticite_defaut TEXT CHECK (criticite_defaut IN ('bloquant','majeur','mineur')) DEFAULT 'mineur',
  norme_associee TEXT, fournisseur_principal_id UUID,
  cree_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE fournisseurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT UNIQUE NOT NULL, type TEXT,
  contact_nom TEXT, contact_email TEXT, contact_tel TEXT,
  numero_contrat TEXT, sla_h INTEGER, notes TEXT,
  actif BOOLEAN DEFAULT TRUE, cree_le TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categories_equipement ADD CONSTRAINT fk_cat_fournisseur
  FOREIGN KEY (fournisseur_principal_id) REFERENCES fournisseurs(id);

-- DOMAINE 2 · ÉQUIPEMENTS
CREATE TABLE equipements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parc_id UUID NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  categorie_id UUID NOT NULL REFERENCES categories_equipement(id),
  code TEXT NOT NULL, libelle TEXT NOT NULL,
  numero_serie TEXT, date_mise_service DATE, date_fin_garantie DATE,
  statut TEXT CHECK (statut IN ('actif','maintenance','hors_service','archive')) DEFAULT 'actif',
  a_surveiller BOOLEAN DEFAULT FALSE, meta JSONB DEFAULT '{}'::jsonb,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parc_id, code)
);
CREATE INDEX idx_equip_parc ON equipements(parc_id);
CREATE INDEX idx_equip_categorie ON equipements(categorie_id);
CREATE INDEX idx_equip_statut ON equipements(statut);
CREATE INDEX idx_equip_surveiller ON equipements(a_surveiller) WHERE a_surveiller = TRUE;
CREATE TABLE pieces_detachees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT UNIQUE NOT NULL, nom TEXT NOT NULL, description TEXT,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  stock_actuel INTEGER NOT NULL DEFAULT 0, stock_min INTEGER NOT NULL DEFAULT 1,
  prix_unitaire_ht NUMERIC(10,2), delai_reappro_jours INTEGER, emplacement TEXT,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pieces_stock_low ON pieces_detachees(stock_actuel) WHERE stock_actuel < stock_min;
CREATE TABLE fixtures_lumiere (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipement_id UUID NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
  adresse_dmx INTEGER NOT NULL, univers_dmx INTEGER NOT NULL DEFAULT 1,
  type_fixture TEXT, modele TEXT, fabricant TEXT, puissance_w INTEGER,
  position_plan JSONB, cree_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(univers_dmx, adresse_dmx)
);
CREATE INDEX idx_fixtures_equip ON fixtures_lumiere(equipement_id);

-- DOMAINE 3 · TICKETS
CREATE TABLE niveaux_priorite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, nom TEXT NOT NULL,
  sla_h INTEGER NOT NULL, couleur_hex TEXT NOT NULL, ordre INTEGER NOT NULL
);
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_bt TEXT UNIQUE NOT NULL,
  equipement_id UUID NOT NULL REFERENCES equipements(id),
  priorite_id UUID NOT NULL REFERENCES niveaux_priorite(id),
  type_maintenance type_maintenance NOT NULL DEFAULT 'correctif_curatif',
  titre TEXT NOT NULL, description TEXT, symptome TEXT,
  source TEXT CHECK (source IN ('controle_ouverture','controle_hebdo','controle_mensuel',
    'staff_caisse','plainte_client','previsionnel_auto','tech_terrain','capteur')),
  declare_par_id UUID, declare_le TIMESTAMPTZ DEFAULT NOW(),
  echeance_sla TIMESTAMPTZ, statut statut_incident NOT NULL DEFAULT 'ouvert',
  resolu_le TIMESTAMPTZ, ferme_le TIMESTAMPTZ,
  photos_urls TEXT[] DEFAULT ARRAY[]::TEXT[], meta JSONB DEFAULT '{}'::jsonb,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inc_equip ON incidents(equipement_id);
CREATE INDEX idx_inc_statut ON incidents(statut);
CREATE INDEX idx_inc_declare_le ON incidents(declare_le DESC);
CREATE INDEX idx_inc_priorite ON incidents(priorite_id);
CREATE INDEX idx_inc_sla ON incidents(echeance_sla) WHERE statut NOT IN ('resolu','ferme','annule');

CREATE SEQUENCE seq_numero_bt START 1;
CREATE OR REPLACE FUNCTION generate_numero_bt() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_bt IS NULL OR NEW.numero_bt = '' THEN
    NEW.numero_bt := 'BT-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('seq_numero_bt')::TEXT,4,'0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_generate_numero_bt BEFORE INSERT ON incidents
  FOR EACH ROW EXECUTE FUNCTION generate_numero_bt();

CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  technicien_id UUID NOT NULL, binome_id UUID,
  debut TIMESTAMPTZ NOT NULL DEFAULT NOW(), fin TIMESTAMPTZ,
  diagnostic TEXT, actions_realisees TEXT, resolu_premier_coup BOOLEAN,
  photos_avant TEXT[] DEFAULT ARRAY[]::TEXT[],
  photos_apres TEXT[] DEFAULT ARRAY[]::TEXT[],
  signature_url TEXT, signature_binome_url TEXT,
  cree_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_int_incident ON interventions(incident_id);
CREATE INDEX idx_int_tech ON interventions(technicien_id);
CREATE INDEX idx_int_debut ON interventions(debut DESC);
CREATE TABLE pieces_utilisees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  piece_id UUID NOT NULL REFERENCES pieces_detachees(id),
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  cree_le TIMESTAMPTZ DEFAULT NOW()
);

-- DOMAINE 4 · PRÉVENTIF
CREATE TABLE maintenances_preventives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipement_id UUID NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
  type type_maintenance NOT NULL DEFAULT 'preventif_systematique',
  libelle TEXT NOT NULL, description TEXT,
  frequence_jours INTEGER, derniere_execution DATE,
  prochaine_echeance DATE NOT NULL, duree_min_estimee INTEGER,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  actif BOOLEAN DEFAULT TRUE,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prev_echeance ON maintenances_preventives(prochaine_echeance) WHERE actif = TRUE;
CREATE INDEX idx_prev_equip ON maintenances_preventives(equipement_id);
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipement_id UUID NOT NULL REFERENCES equipements(id) ON DELETE CASCADE,
  norme TEXT NOT NULL, organisme_certificateur TEXT, numero_certificat TEXT,
  date_certif DATE NOT NULL, prochaine_echeance DATE NOT NULL,
  document_pdf_url TEXT, notes TEXT,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cert_echeance ON certifications(prochaine_echeance);

-- DOMAINE 5 · CONTRÔLES
CREATE TABLE bibliotheque_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categorie_id UUID NOT NULL REFERENCES categories_equipement(id),
  libelle TEXT NOT NULL, description TEXT,
  type_controle type_controle NOT NULL,
  assigne_a TEXT CHECK (assigne_a IN ('staff','tech','mixte')) DEFAULT 'staff',
  obligation_constructeur BOOLEAN DEFAULT FALSE, norme_associee TEXT,
  bloquant_si_ko BOOLEAN DEFAULT FALSE, photo_obligatoire BOOLEAN DEFAULT TRUE,
  ordre INTEGER NOT NULL DEFAULT 0, verrouille BOOLEAN DEFAULT FALSE,
  actif BOOLEAN DEFAULT TRUE,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_biblio_cat ON bibliotheque_points(categorie_id);
CREATE INDEX idx_biblio_type ON bibliotheque_points(type_controle);
CREATE TABLE controles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parc_id UUID NOT NULL REFERENCES parcs(id),
  type type_controle NOT NULL, date_planifiee DATE NOT NULL,
  date_demarrage TIMESTAMPTZ, date_validation TIMESTAMPTZ,
  realise_par_id UUID, valide_par_id UUID,
  statut statut_controle DEFAULT 'a_faire',
  gps_latitude DOUBLE PRECISION, gps_longitude DOUBLE PRECISION,
  signature_url TEXT, pdf_signe_url TEXT, meta JSONB DEFAULT '{}'::jsonb,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ctrl_parc_date ON controles(parc_id, date_planifiee);
CREATE INDEX idx_ctrl_statut ON controles(statut);
CREATE TABLE controle_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  controle_id UUID NOT NULL REFERENCES controles(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES bibliotheque_points(id),
  equipement_id UUID REFERENCES equipements(id),
  etat etat_controle_item NOT NULL,
  photo_url TEXT, commentaire TEXT, saisi_par_id UUID,
  saisi_le TIMESTAMPTZ DEFAULT NOW(),
  signataires UUID[] DEFAULT ARRAY[]::UUID[],
  incident_genere_id UUID REFERENCES incidents(id)
);
CREATE INDEX idx_citem_ctrl ON controle_items(controle_id);
CREATE INDEX idx_citem_equip ON controle_items(equipement_id);
CREATE TABLE parc_attractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parc_id UUID NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  categorie_id UUID NOT NULL REFERENCES categories_equipement(id) ON DELETE CASCADE,
  quantite INTEGER NOT NULL DEFAULT 1, meta JSONB DEFAULT '{}'::jsonb,
  UNIQUE(parc_id, categorie_id)
);
CREATE INDEX idx_pa_parc ON parc_attractions(parc_id);

-- DOMAINE 6 · HUMAIN
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code role_utilisateur UNIQUE NOT NULL, nom TEXT NOT NULL,
  permissions JSONB DEFAULT '{}'::jsonb, ordre INTEGER NOT NULL
);
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE, email TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL, prenom TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  telephone TEXT, trigramme TEXT UNIQUE, actif BOOLEAN DEFAULT TRUE,
  consentement_gps BOOLEAN DEFAULT FALSE, consentement_gps_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE parcs_utilisateurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  parc_id UUID NOT NULL REFERENCES parcs(id) ON DELETE CASCADE,
  est_manager BOOLEAN DEFAULT FALSE, cree_le TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(utilisateur_id, parc_id)
);
CREATE INDEX idx_pu_user ON parcs_utilisateurs(utilisateur_id);
CREATE INDEX idx_pu_parc ON parcs_utilisateurs(parc_id);

-- DOMAINE 7 · LEAN + ARCHIVES
CREATE TABLE fiches_5_pourquoi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  equipement_id UUID NOT NULL REFERENCES equipements(id),
  ouvert_par_id UUID NOT NULL, ouvert_le TIMESTAMPTZ DEFAULT NOW(),
  q1 TEXT, q2 TEXT, q3 TEXT, q4 TEXT, q5 TEXT,
  cause_racine TEXT, contre_mesure TEXT, type_action type_maintenance,
  validee_par_id UUID, validee_le TIMESTAMPTZ,
  audit_90j_le DATE,
  audit_resultat TEXT CHECK (audit_resultat IN ('efficace','inefficace','partiel',NULL)),
  statut statut_5_pourquoi DEFAULT 'ouvert',
  cree_le TIMESTAMPTZ DEFAULT NOW(), modifie_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_5pq_incident ON fiches_5_pourquoi(incident_id);
CREATE INDEX idx_5pq_statut ON fiches_5_pourquoi(statut);
CREATE TABLE standards_evolutifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  point_id UUID NOT NULL REFERENCES bibliotheque_points(id),
  fiche_5pq_id UUID REFERENCES fiches_5_pourquoi(id),
  ancien_libelle TEXT, nouveau_libelle TEXT NOT NULL,
  ancien_assigne_a TEXT, nouveau_assigne_a TEXT,
  modifie_par_id UUID NOT NULL,
  modifie_le TIMESTAMPTZ DEFAULT NOW(), motif TEXT
);
CREATE TABLE plaintes_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipement_id UUID REFERENCES equipements(id),
  parc_id UUID NOT NULL REFERENCES parcs(id),
  declare_le TIMESTAMPTZ DEFAULT NOW(),
  canal TEXT CHECK (canal IN ('caisse','google_review','email','tel','app_client')),
  commentaire TEXT, saisi_par_id UUID,
  ticket_genere_id UUID REFERENCES incidents(id),
  cree_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pl_equip ON plaintes_clients(equipement_id);
CREATE INDEX idx_pl_declare ON plaintes_clients(declare_le DESC);
CREATE TABLE archives_pdf (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('controle_quotidien','controle_hebdo',
    'controle_mensuel','intervention','certification','audit_constructeur')),
  parc_id UUID REFERENCES parcs(id),
  controle_id UUID REFERENCES controles(id),
  intervention_id UUID REFERENCES interventions(id),
  date_generation TIMESTAMPTZ DEFAULT NOW(),
  url_storage TEXT NOT NULL, signature_sha256 TEXT,
  conservation_jusqua DATE NOT NULL, taille_octets INTEGER,
  cree_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_arch_type ON archives_pdf(type);
CREATE INDEX idx_arch_parc ON archives_pdf(parc_id);
CREATE TABLE gps_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  technicien_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
  precision_m INTEGER, capture_le TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_gps_tech_date ON gps_positions(technicien_id, capture_le DESC);;
