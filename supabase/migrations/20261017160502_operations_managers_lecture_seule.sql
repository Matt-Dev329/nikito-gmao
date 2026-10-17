-- Opérations : les managers de parc (principaux ou non) suivent les tickets en
-- lecture seule ; ils ne peuvent plus démarrer, mettre en pause, reprendre,
-- réassigner, mettre en attente de pièce ni confier / clôturer un ticket.
-- On retire 'manager_parc' de la liste des rôles autorisés de chaque fonction,
-- le reste de leur code est inchangé.
DO $migration$
DECLARE
  f record;
  v_def text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('demarrer_intervention_photo', 'mettre_en_pause_incident', 'reprendre_incident',
                        'reassigner_incident', 'cloturer_ticket_exterieur', 'confier_intervenant_exterieur',
                        'mettre_en_attente_piece', 'lever_attente_piece', 'reprendre_ticket_en_interne')
  LOOP
    v_def := pg_get_functiondef(f.oid);
    IF position('''directeur_parc'', ''manager_parc'', ''technicien''' IN v_def) = 0 THEN
      RAISE EXCEPTION 'Liste de rôles inattendue dans %', f.proname;
    END IF;
    EXECUTE replace(v_def, '''directeur_parc'', ''manager_parc'', ''technicien''', '''directeur_parc'', ''technicien''');
  END LOOP;
END
$migration$;