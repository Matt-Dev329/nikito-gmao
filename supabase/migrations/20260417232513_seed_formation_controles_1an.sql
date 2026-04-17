/*
  # Seed 1 an de controles de formation pour les 4 parcs

  1. Donnees generees
    - ~365 controles quotidiens par parc (1460 total) sur 12 mois
    - ~52 controles hebdomadaires par parc (208 total) sur 12 mois
    - ~12 controles mensuels par parc (48 total) sur 12 mois
    - Total : ~1716 controles avec items associes
    - Chaque controle a entre 5 et 13 items (points de controle)
    - ~95% OK, ~4% degrade, ~1% HS pour un realisme optimal
    - Tous marques est_formation = true

  2. Controles avec anomalies
    - Certains controles ont des items KO pour generer des incidents
    - Les controles sont signes par des noms fictifs de staff

  3. Notes
    - Les donnees couvrent du 2025-04-17 a 2026-04-17 (1 an complet)
    - Utilise une fonction temporaire pour la generation
*/

DO $$
DECLARE
  v_parc RECORD;
  v_day DATE;
  v_week_start DATE;
  v_month_start DATE;
  v_ctrl_id UUID;
  v_point RECORD;
  v_etat TEXT;
  v_rand DOUBLE PRECISION;
  v_noms TEXT[] := ARRAY['Sophie Martin', 'Lucas Dubois', 'Emma Bernard', 'Hugo Thomas', 'Lea Petit', 'Nathan Robert', 'Chloe Richard', 'Enzo Durand', 'Manon Leroy', 'Louis Moreau', 'Jade Simon', 'Jules Laurent', 'Camille Michel', 'Arthur Garcia'];
  v_roles TEXT[] := ARRAY['staff_operationnel', 'staff_operationnel', 'staff_operationnel', 'technicien', 'staff_operationnel', 'technicien', 'staff_operationnel', 'technicien', 'staff_operationnel', 'staff_operationnel', 'staff_operationnel', 'technicien', 'staff_operationnel', 'technicien'];
  v_nom_idx INT;
  v_ctrl_count INT := 0;
  v_item_count INT := 0;
BEGIN

  FOR v_parc IN SELECT id, code FROM parcs WHERE actif = true ORDER BY code LOOP

    -- QUOTIDIENS : 1 par jour sur 365 jours
    v_day := CURRENT_DATE - INTERVAL '365 days';
    WHILE v_day <= CURRENT_DATE - INTERVAL '1 day' LOOP
      v_ctrl_id := gen_random_uuid();
      v_nom_idx := 1 + floor(random() * 14)::int;
      IF v_nom_idx > 14 THEN v_nom_idx := 14; END IF;

      INSERT INTO controles (id, parc_id, type, date_planifiee, date_demarrage, date_validation, statut, realise_par_nom, realise_par_role, est_formation, signature_at)
      VALUES (
        v_ctrl_id,
        v_parc.id,
        'quotidien',
        v_day,
        v_day + INTERVAL '8 hours' + (random() * INTERVAL '90 minutes'),
        v_day + INTERVAL '8 hours' + (random() * INTERVAL '2 hours'),
        'valide',
        v_noms[v_nom_idx],
        v_roles[v_nom_idx],
        true,
        v_day + INTERVAL '9 hours'
      );

      FOR v_point IN
        SELECT bp.id, bp.libelle, ce.nom as cat_nom, bp.bloquant_si_ko
        FROM bibliotheque_points bp
        JOIN categories_equipement ce ON bp.categorie_id = ce.id
        WHERE bp.actif = true AND bp.type_controle = 'quotidien'
        ORDER BY bp.ordre
      LOOP
        v_rand := random();
        IF v_rand < 0.94 THEN
          v_etat := 'ok';
        ELSIF v_rand < 0.98 THEN
          v_etat := 'degrade';
        ELSE
          v_etat := 'hs';
        END IF;

        INSERT INTO controle_items (controle_id, point_id, etat, point_libelle_snapshot, point_categorie_snapshot, point_type_controle_snapshot, commentaire)
        VALUES (
          v_ctrl_id,
          v_point.id,
          v_etat::etat_controle_item,
          v_point.libelle,
          v_point.cat_nom,
          'quotidien',
          CASE
            WHEN v_etat = 'degrade' THEN 'Legere usure constatee, a surveiller'
            WHEN v_etat = 'hs' THEN 'Hors service, intervention necessaire'
            ELSE NULL
          END
        );
        v_item_count := v_item_count + 1;
      END LOOP;

      v_ctrl_count := v_ctrl_count + 1;
      v_day := v_day + INTERVAL '1 day';
    END LOOP;

    -- HEBDOMADAIRES : 1 par semaine sur 52 semaines
    v_week_start := CURRENT_DATE - INTERVAL '364 days';
    v_week_start := v_week_start - ((EXTRACT(DOW FROM v_week_start)::int + 6) % 7 * INTERVAL '1 day');
    WHILE v_week_start <= CURRENT_DATE - INTERVAL '7 days' LOOP
      v_ctrl_id := gen_random_uuid();
      v_nom_idx := 1 + floor(random() * 14)::int;
      IF v_nom_idx > 14 THEN v_nom_idx := 14; END IF;

      INSERT INTO controles (id, parc_id, type, date_planifiee, date_demarrage, date_validation, statut, realise_par_nom, realise_par_role, est_formation, signature_at)
      VALUES (
        v_ctrl_id,
        v_parc.id,
        'hebdo',
        v_week_start,
        v_week_start + INTERVAL '9 hours' + (random() * INTERVAL '2 hours'),
        v_week_start + INTERVAL '11 hours' + (random() * INTERVAL '3 hours'),
        'valide',
        v_noms[v_nom_idx],
        v_roles[v_nom_idx],
        true,
        v_week_start + INTERVAL '12 hours'
      );

      FOR v_point IN
        SELECT bp.id, bp.libelle, ce.nom as cat_nom
        FROM bibliotheque_points bp
        JOIN categories_equipement ce ON bp.categorie_id = ce.id
        WHERE bp.actif = true AND bp.type_controle = 'hebdo'
        ORDER BY random()
        LIMIT 15
      LOOP
        v_rand := random();
        IF v_rand < 0.92 THEN
          v_etat := 'ok';
        ELSIF v_rand < 0.97 THEN
          v_etat := 'degrade';
        ELSE
          v_etat := 'hs';
        END IF;

        INSERT INTO controle_items (controle_id, point_id, etat, point_libelle_snapshot, point_categorie_snapshot, point_type_controle_snapshot, commentaire)
        VALUES (
          v_ctrl_id,
          v_point.id,
          v_etat::etat_controle_item,
          v_point.libelle,
          v_point.cat_nom,
          'hebdo',
          CASE
            WHEN v_etat = 'degrade' THEN (ARRAY['Usure visible mais fonctionnel', 'Bruit anormal, a verifier', 'Jeu mecanique constate', 'Legere corrosion'])[1 + floor(random()*4)::int]
            WHEN v_etat = 'hs' THEN (ARRAY['Panne complete, piece a commander', 'Casse constatee, hors service', 'Defaillance electrique'])[1 + floor(random()*3)::int]
            ELSE NULL
          END
        );
        v_item_count := v_item_count + 1;
      END LOOP;

      v_ctrl_count := v_ctrl_count + 1;
      v_week_start := v_week_start + INTERVAL '7 days';
    END LOOP;

    -- MENSUELS : 1 par mois sur 12 mois
    v_month_start := date_trunc('month', CURRENT_DATE - INTERVAL '12 months')::date;
    WHILE v_month_start < date_trunc('month', CURRENT_DATE)::date LOOP
      v_ctrl_id := gen_random_uuid();
      v_nom_idx := 1 + floor(random() * 14)::int;
      IF v_nom_idx > 14 THEN v_nom_idx := 14; END IF;

      INSERT INTO controles (id, parc_id, type, date_planifiee, date_demarrage, date_validation, statut, realise_par_nom, realise_par_role, est_formation, signature_at)
      VALUES (
        v_ctrl_id,
        v_parc.id,
        'mensuel',
        v_month_start + 14,
        (v_month_start + 14) + INTERVAL '9 hours',
        (v_month_start + 14) + INTERVAL '14 hours' + (random() * INTERVAL '3 hours'),
        'valide',
        v_noms[v_nom_idx],
        v_roles[v_nom_idx],
        true,
        (v_month_start + 14) + INTERVAL '15 hours'
      );

      FOR v_point IN
        SELECT bp.id, bp.libelle, ce.nom as cat_nom
        FROM bibliotheque_points bp
        JOIN categories_equipement ce ON bp.categorie_id = ce.id
        WHERE bp.actif = true AND bp.type_controle = 'mensuel'
        ORDER BY random()
        LIMIT 25
      LOOP
        v_rand := random();
        IF v_rand < 0.90 THEN
          v_etat := 'ok';
        ELSIF v_rand < 0.96 THEN
          v_etat := 'degrade';
        ELSE
          v_etat := 'hs';
        END IF;

        INSERT INTO controle_items (controle_id, point_id, etat, point_libelle_snapshot, point_categorie_snapshot, point_type_controle_snapshot, commentaire)
        VALUES (
          v_ctrl_id,
          v_point.id,
          v_etat::etat_controle_item,
          v_point.libelle,
          v_point.cat_nom,
          'mensuel',
          CASE
            WHEN v_etat = 'degrade' THEN (ARRAY['Usure avancee, planifier remplacement', 'Fonctionnel mais bruit suspect', 'Jeu mecanique important', 'Corrosion superficielle', 'Fissure legere constatee'])[1 + floor(random()*5)::int]
            WHEN v_etat = 'hs' THEN (ARRAY['Piece cassee, remplacement urgent', 'Defaillance totale du systeme', 'Blocage mecanique complet', 'Court-circuit detecte'])[1 + floor(random()*4)::int]
            ELSE NULL
          END
        );
        v_item_count := v_item_count + 1;
      END LOOP;

      v_ctrl_count := v_ctrl_count + 1;
      v_month_start := (v_month_start + INTERVAL '1 month')::date;
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Formation seed: % controles, % items generes', v_ctrl_count, v_item_count;
END $$;
