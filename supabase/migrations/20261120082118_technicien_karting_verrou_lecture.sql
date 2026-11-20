-- Technicien Karting : aucune lecture des données hors karting, même en
-- passant par l'API (contrôles, plaintes, 5 pourquoi, notifications
-- d'interventions, préventif, certifications, chantier, bons, documents…).
-- Les tickets, rapports, équipements, stock et commandes sont déjà limités
-- au karting par leurs propres règles.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plaintes_clients', 'fiches_5_pourquoi', 'notifications_interventions', 'notifications_controle_manquant',
    'controles', 'controle_items', 'maintenances_preventives', 'certifications', 'archives_pdf',
    'documents_chantier', 'acteurs_chantier', 'commissions_securite', 'prescriptions_securite',
    'parc_revenue', 'roller_catalogue', 'roller_role_mapping', 'roller_sync_log', 'invitations',
    'bons_intervention', 'bibliotheque_points', 'parc_points_actifs', 'documents_techniques'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY technicien_karting_aucune_lecture ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (SELECT est_technicien_karting()))',
      t);
  END LOOP;
END $$;

-- Fichiers : plans, manuels, contrôles, bons et documents fermés au technicien Karting
CREATE POLICY technicien_karting_fichiers ON storage.objects AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (NOT (SELECT est_technicien_karting())
         OR bucket_id NOT IN ('alba-techniques', 'alba-controles', 'alba-bons', 'alba-documents'));