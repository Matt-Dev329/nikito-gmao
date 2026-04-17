/*
  # Seed incidents, interventions et fiches 5 Pourquoi de formation

  1. Incidents (~55 sur 12 mois) + 6 ouverts
  2. Interventions liees
  3. Fiches 5P auto-generees par trigger puis enrichies
*/

DO $$
DECLARE
  v_inc_id UUID;
  v_prio_bloquant UUID := 'c685b344-7ef2-4869-9130-1fc994985d73';
  v_prio_majeur UUID := 'cd2da6e9-17ad-4ec0-9319-37b910a8f8c0';
  v_prio_mineur UUID := '43cf65ba-a899-4796-82db-eedf91785128';
  v_user_id UUID := '18c05406-10c8-48af-bc84-42e25a889042';
  v_bt INT := 2000;
  v_date TIMESTAMPTZ;
  v_titres TEXT[];
  v_equips_fra UUID[] := ARRAY[
    'a0000001-0001-0001-0001-000000000001'::uuid,
    'a0000001-0001-0001-0001-000000000002'::uuid,
    'a0000001-0001-0001-0001-000000000003'::uuid,
    'a0000001-0001-0001-0001-000000000004'::uuid,
    'a0000001-0001-0001-0001-000000000005'::uuid
  ];
  v_equips_dom UUID[] := ARRAY[
    'a0000001-0003-0001-0001-000000000001'::uuid,
    'a0000001-0003-0001-0001-000000000002'::uuid,
    'a0000001-0003-0001-0001-000000000003'::uuid,
    'a0000001-0003-0001-0001-000000000004'::uuid,
    'a0000001-0003-0001-0001-000000000005'::uuid
  ];
  v_equips_alf UUID[] := ARRAY[
    'a0000001-0004-0001-0001-000000000001'::uuid,
    'a0000001-0004-0001-0001-000000000002'::uuid,
    'a0000001-0004-0001-0001-000000000003'::uuid,
    'a0000001-0004-0001-0001-000000000004'::uuid,
    'a0000001-0004-0001-0001-000000000005'::uuid,
    'a0000001-0004-0001-0001-000000000006'::uuid
  ];
  i INT;
BEGIN

  -- FRA-TRAMP-02 : 5 pannes en 30 jours = RECURRENCE
  v_titres := ARRAY['Pad de protection dechire', 'Ressort deforme', 'Filet decroche', 'Coussin securite use', 'Mousse fissure'];
  FOR i IN 1..5 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((30 - i * 5) || ' days')::interval;
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt, 'a0000001-0001-0001-0001-000000000002'::uuid,
      CASE WHEN i <= 2 THEN v_prio_majeur ELSE v_prio_mineur END,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Defaut controle quotidien.',
      'controle_ouverture', v_user_id, v_date,
      CASE WHEN i <= 3 THEN 'ferme'::statut_incident ELSE 'resolu'::statut_incident END,
      v_date + INTERVAL '4 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '1 hour', v_date + INTERVAL '3 hours', 'Usure prematuree.', 'Remplacement piece.', i > 3);
  END LOOP;

  -- FRA-LASER-01 : 4 pannes en 60 jours
  v_titres := ARRAY['Gilet laser HS', 'Pistolet defaillant', 'Capteur gilet HS', 'Batterie gilet HS'];
  FOR i IN 1..4 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((50 - i * 12) || ' days')::interval;
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt, 'a0000001-0001-0001-0001-000000000009'::uuid, v_prio_mineur,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Gilet laser defaillant.',
      'tech_terrain', v_user_id, v_date, 'ferme'::statut_incident, v_date + INTERVAL '2 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '30 minutes', v_date + INTERVAL '90 minutes', 'Batterie defaillante.', 'Remplacement.', true);
  END LOOP;

  -- SGB-TRAMP-02 : 3 pannes en 25 jours
  v_titres := ARRAY['Coussin use', 'Pad decolle', 'Mousse abimee'];
  FOR i IN 1..3 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((25 - i * 7) || ' days')::interval;
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt, 'a0000001-0002-0001-0001-000000000002'::uuid, v_prio_majeur,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Usure anormale.',
      'controle_hebdo', v_user_id, v_date, 'ferme'::statut_incident, v_date + INTERVAL '6 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '2 hours', v_date + INTERVAL '5 hours', 'Coussins uses.', 'Remplacement.', false);
  END LOOP;

  -- FRA 12 incidents varies
  v_titres := ARRAY['Pad dechire', 'Ressort deforme', 'Filet decroche', 'Tapis decolle', 'Structure rouille', 'Eclairage grille', 'Monnayeur bloque', 'Ecran noir', 'Joystick casse', 'HP gresille', 'Mousse usee', 'Sortie secours bloquee'];
  FOR i IN 1..12 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((360 - i * 30) || ' days')::interval + (random() * INTERVAL '15 days');
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, ferme_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt, v_equips_fra[1 + (i % 5)],
      CASE WHEN i % 7 = 0 THEN v_prio_bloquant WHEN i % 3 = 0 THEN v_prio_majeur ELSE v_prio_mineur END,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Defaut controle.',
      CASE WHEN i % 3 = 0 THEN 'controle_hebdo' WHEN i % 3 = 1 THEN 'controle_ouverture' ELSE 'tech_terrain' END,
      v_user_id, v_date, 'ferme'::statut_incident, v_date + INTERVAL '5 hours', v_date + INTERVAL '24 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '1 hour', v_date + INTERVAL '4 hours', 'Usure constatee.', 'Piece remplacee.', i % 3 != 0);
  END LOOP;

  -- SGB 10 incidents bowling
  v_titres := ARRAY['Piste huileuse', 'Ecran scoring eteint', 'Machine quilles bloquee', 'Bumper bloque', 'Retour boule lent', 'LED piste HS', 'Capteur vitesse HS', 'Rigole bouchee', 'Moteur gresille', 'Quille coincee'];
  FOR i IN 1..10 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((350 - i * 35) || ' days')::interval + (random() * INTERVAL '15 days');
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, ferme_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt,
      CASE WHEN i % 2 = 0 THEN 'a0000001-0002-0001-0001-000000000003'::uuid ELSE 'a0000001-0002-0001-0001-000000000004'::uuid END,
      CASE WHEN i % 4 = 0 THEN v_prio_majeur ELSE v_prio_mineur END,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Anomalie bowling.',
      'controle_hebdo', v_user_id, v_date, 'ferme'::statut_incident, v_date + INTERVAL '3 hours', v_date + INTERVAL '12 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '30 minutes', v_date + INTERVAL '150 minutes', 'Defaut mecanique.', 'Reglage et nettoyage.', i % 4 != 0);
  END LOOP;

  -- DOM 8 incidents
  v_titres := ARRAY['Fuite air gonflable', 'Mousse usee', 'Filet detache', 'Structure abimee', 'Couture ouverte', 'Eclairage HS', 'Tapis decolle', 'Signaletique manquante'];
  FOR i IN 1..8 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((340 - i * 40) || ' days')::interval + (random() * INTERVAL '20 days');
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, ferme_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt, v_equips_dom[1 + (i % 5)],
      CASE WHEN i % 5 = 0 THEN v_prio_bloquant WHEN i % 3 = 0 THEN v_prio_majeur ELSE v_prio_mineur END,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Defaut Rosny.',
      CASE WHEN i % 2 = 0 THEN 'controle_ouverture' ELSE 'tech_terrain' END,
      v_user_id, v_date, 'ferme'::statut_incident, v_date + INTERVAL '4 hours', v_date + INTERVAL '18 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '45 minutes', v_date + INTERVAL '180 minutes', 'Defaut repare.', 'Reparation effectuee.', i % 3 != 0);
  END LOOP;

  -- ALF 8 incidents
  v_titres := ARRAY['Pad trampoline dechire', 'Borne arcade panne', 'Gilet laser HS', 'Toboggan fissure', 'Eclairage secours HS', 'Robinet fuit', 'Seche-main HS', 'Couture gonflable'];
  FOR i IN 1..8 LOOP
    v_bt := v_bt + 1;
    v_inc_id := gen_random_uuid();
    v_date := CURRENT_TIMESTAMP - ((320 - i * 35) || ' days')::interval + (random() * INTERVAL '15 days');
    INSERT INTO incidents (id, numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, resolu_le, ferme_le, est_formation)
    VALUES (v_inc_id, 'FORM-' || v_bt, v_equips_alf[1 + (i % 6)],
      CASE WHEN i % 5 = 0 THEN v_prio_bloquant ELSE v_prio_mineur END,
      'correctif_curatif'::type_maintenance, v_titres[i], 'Incident Alfortville.',
      'controle_ouverture', v_user_id, v_date, 'ferme'::statut_incident, v_date + INTERVAL '3 hours', v_date + INTERVAL '10 hours', true);
    INSERT INTO interventions (incident_id, technicien_id, debut, fin, diagnostic, actions_realisees, resolu_premier_coup)
    VALUES (v_inc_id, v_user_id, v_date + INTERVAL '1 hour', v_date + INTERVAL '150 minutes', 'Standard.', 'Reparation OK.', i % 3 != 0);
  END LOOP;

  -- 6 incidents OUVERTS
  FOR i IN 1..6 LOOP
    v_bt := v_bt + 1;
    INSERT INTO incidents (numero_bt, equipement_id, priorite_id, type_maintenance, titre, description, source, declare_par_id, declare_le, statut, est_formation)
    VALUES ('FORM-' || v_bt,
      (ARRAY['a0000001-0001-0001-0001-000000000007'::uuid, 'a0000001-0002-0001-0001-000000000005'::uuid,
             'a0000001-0003-0001-0001-000000000003'::uuid, 'a0000001-0004-0001-0001-000000000004'::uuid,
             'a0000001-0001-0001-0001-000000000010'::uuid, 'a0000001-0002-0001-0001-000000000008'::uuid])[i],
      CASE WHEN i <= 2 THEN v_prio_bloquant WHEN i <= 4 THEN v_prio_majeur ELSE v_prio_mineur END,
      'correctif_curatif'::type_maintenance,
      (ARRAY['Ecran noir borne arcade', 'Kart ne demarre plus', 'Fuite gonflable', 'Gilet laser batterie HS', 'Robinet fuite continue', 'Monnayeur bloque'])[i],
      'En attente intervention.', 'tech_terrain', v_user_id,
      CURRENT_TIMESTAMP - ((i * 2) || ' hours')::interval,
      CASE WHEN i <= 3 THEN 'ouvert'::statut_incident ELSE 'en_cours'::statut_incident END, true);
  END LOOP;

END $$;

-- Enrichir les fiches 5P auto-generees par trigger
DO $$
DECLARE
  v_fp RECORD;
  v_counter INT := 0;
  v_user_id UUID := '18c05406-10c8-48af-bc84-42e25a889042';
BEGIN
  FOR v_fp IN
    SELECT id, ouvert_le FROM fiches_5_pourquoi
    WHERE est_formation = true AND statut = 'ouvert'::statut_5_pourquoi
    ORDER BY ouvert_le ASC
  LOOP
    v_counter := v_counter + 1;
    IF v_counter = 1 THEN
      UPDATE fiches_5_pourquoi SET q1 = 'Pourquoi cet equipement tombe en panne regulierement ?', q2 = 'Parce que les composants susent vite' WHERE id = v_fp.id;
    ELSIF v_counter = 2 THEN
      UPDATE fiches_5_pourquoi SET q1 = 'Pourquoi la panne se repete ?' WHERE id = v_fp.id;
    ELSIF v_counter <= 4 THEN
      UPDATE fiches_5_pourquoi SET q1='Pourquoi la panne se repete ?', q2='Parce que la piece est sur-sollicitee', q3='Parce que lusage est intensif', q4='Parce que le fournisseur na pas ete informe', q5='Parce que la specification dachat est incomplete',
        cause_racine='Specification achat inadaptee', contre_mesure='Revoir specification avec fournisseur',
        type_action='amelioration'::type_maintenance, validee_par_id=v_user_id, validee_le=v_fp.ouvert_le+INTERVAL '12 days', statut='valide'::statut_5_pourquoi WHERE id = v_fp.id;
    ELSIF v_counter <= 6 THEN
      UPDATE fiches_5_pourquoi SET q1='Pourquoi la panne se reproduit ?', q2='Parce que le preventif na pas ete respecte', q3='Parce que le planning etait incomplet', q4='Parce que labsence na pas ete signalee', q5='Parce quil ny a pas dalerte automatique',
        cause_racine='Absence dalerte sur retard preventif', contre_mesure='Alertes automatiques et suivi hebdomadaire',
        type_action='preventif_systematique'::type_maintenance, validee_par_id=v_user_id, validee_le=v_fp.ouvert_le+INTERVAL '8 days', audit_90j_le=v_fp.ouvert_le+INTERVAL '98 days', statut='audit_en_cours'::statut_5_pourquoi WHERE id = v_fp.id;
    ELSE
      UPDATE fiches_5_pourquoi SET q1='Pourquoi encore ?', q2='Qualite lot inferieure', q3='Fournisseur a change sous-traitant', q4='Controle qualite na pas detecte', q5='Pas de controle qualite reception',
        cause_racine='Absence controle qualite reception', contre_mesure='Controle qualite systematique et audit fournisseur',
        type_action='amelioration'::type_maintenance, validee_par_id=v_user_id, validee_le=v_fp.ouvert_le+INTERVAL '10 days', audit_90j_le=v_fp.ouvert_le+INTERVAL '100 days',
        audit_resultat=CASE WHEN v_counter%2=0 THEN 'efficace' ELSE 'partiel' END, statut='clos'::statut_5_pourquoi WHERE id = v_fp.id;
    END IF;
  END LOOP;
END $$;
