/*
  # Fix fiches 5P auto-generees et creer fiches manuelles de formation

  1. Corrections
    - Les 3 fiches auto-generees par trigger check_recurrence ont est_formation=false
    - On les corrige en est_formation=true et on les enrichit

  2. Nouvelles fiches 5P (5 supplementaires)
    - Total 8 fiches 5P de formation a differents statuts
    - 2 ouvertes, 2 validees, 2 audit_en_cours, 2 closes

  3. Fix trigger
    - Mise a jour du trigger pour propager est_formation de l'incident a la fiche 5P
*/

-- Fix les 3 fiches auto-generees
UPDATE fiches_5_pourquoi SET est_formation = true
WHERE incident_id IN (SELECT id FROM incidents WHERE est_formation = true)
  AND est_formation = false;

-- Enrichir fiche 1 (FRA-TRAMP-02) -> ouvert avec q1+q2
UPDATE fiches_5_pourquoi SET
  q1 = 'Pourquoi le trampoline B tombe en panne regulierement ?',
  q2 = 'Parce que les pads de protection susent plus vite que prevu sur ce modele'
WHERE equipement_id = 'a0000001-0001-0001-0001-000000000002' AND est_formation = true
  AND statut = 'ouvert'::statut_5_pourquoi;

-- Enrichir fiche 2 (FRA-LASER-01) -> ouvert avec q1
UPDATE fiches_5_pourquoi SET
  q1 = 'Pourquoi les gilets laser tombent en panne de maniere recurrente ?'
WHERE equipement_id = 'a0000001-0001-0001-0001-000000000009' AND est_formation = true
  AND statut = 'ouvert'::statut_5_pourquoi;

-- Enrichir fiche 3 (SGB-TRAMP-02) -> valide complete
UPDATE fiches_5_pourquoi SET
  q1 = 'Pourquoi les coussins du trampoline dodgeball susent prematurement ?',
  q2 = 'Parce que le tissu subit un frottement repetitif lors des parties de dodgeball',
  q3 = 'Parce que la frequentation dodgeball a double en 6 mois',
  q4 = 'Parce que le dimensionnement initial ne prevoyait pas ce volume',
  q5 = 'Parce que le fournisseur na pas ete consulte sur les conditions reelles dutilisation',
  cause_racine = 'Sous-dimensionnement du materiau des coussins par rapport a la frequentation reelle du dodgeball',
  contre_mesure = 'Commander des coussins renforcees haute-frequentation chez Airspace et mettre en place un controle visuel hebdomadaire dedie',
  type_action = 'amelioration'::type_maintenance,
  validee_par_id = '18c05406-10c8-48af-bc84-42e25a889042',
  validee_le = ouvert_le + INTERVAL '10 days',
  statut = 'valide'::statut_5_pourquoi
WHERE equipement_id = 'a0000001-0002-0001-0001-000000000002' AND est_formation = true;

-- Creer 5 fiches 5P supplementaires

-- Fiche 4 : valide (bowling SGB)
INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id, ouvert_le,
  q1, q2, q3, q4, q5, cause_racine, contre_mesure, type_action,
  validee_par_id, validee_le, statut, est_formation)
SELECT i.id, i.equipement_id, '18c05406-10c8-48af-bc84-42e25a889042', i.declare_le + INTERVAL '3 days',
  'Pourquoi la piste de bowling est huileuse de maniere irreguliere ?',
  'Parce que la machine dhuilage nest pas reglee correctement',
  'Parce que la maintenance preventive de la machine na pas ete realisee depuis 4 mois',
  'Parce que le planning preventif ne couvrait pas cette tache specifique',
  'Parce que labsence de gamme preventive bowling na jamais ete remontee par le technicien',
  'Absence de gamme preventive sur la machine dhuilage des pistes de bowling',
  'Creer une maintenance preventive mensuelle pour le reglage et le nettoyage de la machine dhuilage',
  'preventif_systematique'::type_maintenance,
  '18c05406-10c8-48af-bc84-42e25a889042', i.declare_le + INTERVAL '8 days',
  'valide'::statut_5_pourquoi, true
FROM incidents i WHERE i.est_formation = true AND i.equipement_id = 'a0000001-0002-0001-0001-000000000003'
ORDER BY i.declare_le ASC LIMIT 1;

-- Fiche 5 : audit_en_cours (FRA trampoline)
INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id, ouvert_le,
  q1, q2, q3, q4, q5, cause_racine, contre_mesure, type_action,
  validee_par_id, validee_le, audit_90j_le, statut, est_formation)
SELECT i.id, i.equipement_id, '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '60 days',
  'Pourquoi le ressort du trampoline sest deforme ?',
  'Parce quil est sollicite au-dela de sa capacite nominale',
  'Parce que les utilisateurs font du double-bounce malgre linterdiction',
  'Parce que la surveillance est insuffisante aux heures de pointe du samedi',
  'Parce que le staffing nest pas adapte aux pics de frequentation week-end',
  'Staffing insuffisant aux heures de pointe permettant des usages non conformes du trampoline',
  'Renforcer la surveillance avec 1 staff supplementaire le samedi 14h-18h et afficher les regles dutilisation en grand format',
  'amelioration'::type_maintenance,
  '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '50 days',
  CURRENT_DATE + INTERVAL '30 days',
  'audit_en_cours'::statut_5_pourquoi, true
FROM incidents i WHERE i.est_formation = true AND i.equipement_id = 'a0000001-0001-0001-0001-000000000001'
ORDER BY i.declare_le ASC LIMIT 1;

-- Fiche 6 : audit_en_cours (DOM gonflable)
INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id, ouvert_le,
  q1, q2, q3, q4, q5, cause_racine, contre_mesure, type_action,
  validee_par_id, validee_le, audit_90j_le, statut, est_formation)
SELECT i.id, i.equipement_id, '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '75 days',
  'Pourquoi le chateau gonflable perd de lair regulierement ?',
  'Parce que des coutures sont ouvertes a la base',
  'Parce que le materiau PVC est fragilise par lexposition aux UV',
  'Parce que le gonflable nest pas couvert par une bache lorsquil nest pas utilise',
  'Parce quil ny a pas de procedure de rangement ni de protection definie pour les gonflables',
  'Absence de procedure de protection UV et de rangement pour les structures gonflables',
  'Acheter une bache de protection UV et mettre en place une checklist de rangement en fin de journee',
  'preventif_conditionnel'::type_maintenance,
  '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '65 days',
  CURRENT_DATE + INTERVAL '15 days',
  'audit_en_cours'::statut_5_pourquoi, true
FROM incidents i WHERE i.est_formation = true AND i.equipement_id = 'a0000001-0003-0001-0001-000000000003'
ORDER BY i.declare_le ASC LIMIT 1;

-- Fiche 7 : clos efficace (FRA securite)
INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id, ouvert_le,
  q1, q2, q3, q4, q5, cause_racine, contre_mesure, type_action,
  validee_par_id, validee_le, audit_90j_le, audit_resultat, statut, est_formation)
SELECT i.id, i.equipement_id, '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '130 days',
  'Pourquoi la sortie de secours etait bloquee par du materiel ?',
  'Parce que du materiel de stockage avait ete pose devant la porte',
  'Parce que le stock de pieces detachees deborde de la zone dediee au sous-sol',
  'Parce que la zone de stockage est devenue trop petite avec la croissance du parc',
  'Parce que la croissance dactivite du parc na pas ete anticipee dans lamenagement',
  'Zone de stockage sous-dimensionnee causant un encombrement des issues de secours',
  'Reorganiser le stockage avec un nouveau local dedie et former tout le staff aux regles ERP de degagement des issues',
  'amelioration'::type_maintenance,
  '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '120 days',
  CURRENT_DATE - INTERVAL '30 days', 'efficace',
  'clos'::statut_5_pourquoi, true
FROM incidents i WHERE i.est_formation = true AND i.equipement_id = 'a0000001-0001-0001-0001-000000000005'
ORDER BY i.declare_le ASC LIMIT 1;

-- Fiche 8 : clos efficace (SGB karting)
INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id, ouvert_le,
  q1, q2, q3, q4, q5, cause_racine, contre_mesure, type_action,
  validee_par_id, validee_le, audit_90j_le, audit_resultat, statut, est_formation)
SELECT i.id, i.equipement_id, '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '160 days',
  'Pourquoi le kart electrique ne demarrait plus ?',
  'Parce que la batterie etait completement a plat',
  'Parce que le chargeur de la borne ne fonctionnait pas correctement depuis plusieurs semaines',
  'Parce que le chargeur na jamais ete controle depuis son installation il y a 2 ans',
  'Parce quil ny avait aucune maintenance preventive planifiee sur les bornes de recharge karting',
  'Absence totale de maintenance preventive sur les bornes de recharge des karts electriques',
  'Creer un plan de maintenance preventive trimestriel pour la verification et le test de toutes les bornes de recharge',
  'preventif_systematique'::type_maintenance,
  '18c05406-10c8-48af-bc84-42e25a889042', CURRENT_DATE - INTERVAL '150 days',
  CURRENT_DATE - INTERVAL '60 days', 'efficace',
  'clos'::statut_5_pourquoi, true
FROM incidents i WHERE i.est_formation = true AND i.equipement_id = 'a0000001-0002-0001-0001-000000000005'
ORDER BY i.declare_le ASC LIMIT 1;

-- Fix trigger check_recurrence pour propager est_formation
CREATE OR REPLACE FUNCTION check_recurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM incidents
  WHERE equipement_id = NEW.equipement_id
    AND declare_le >= (NOW() - INTERVAL '30 days')
    AND id != NEW.id;

  IF v_count >= 2 THEN
    UPDATE equipements SET a_surveiller = true WHERE id = NEW.equipement_id;

    IF NOT EXISTS (
      SELECT 1 FROM fiches_5_pourquoi
      WHERE equipement_id = NEW.equipement_id
        AND statut IN ('ouvert', 'valide', 'audit_en_cours')
    ) THEN
      INSERT INTO fiches_5_pourquoi (incident_id, equipement_id, ouvert_par_id, est_formation)
      VALUES (NEW.id, NEW.equipement_id, NEW.declare_par_id, NEW.est_formation);
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
