/*
  # Enregistrement des fonctions trigger Conformite dans functions_security_policy

  Enregistre les triggers Conformite ERP comme non-exposees (admin-only),
  puis applique la politique de securite globale.
*/

DELETE FROM functions_security_policy
WHERE function_name IN (
  'fn_destinataires_conformite',
  'fn_notify_prescription_creee',
  'fn_notify_prescription_levee',
  'fn_notify_commission_creee',
  'fn_notify_commission_pv_recu',
  'fn_notify_phase_changement',
  'fn_send_conformite_email_async'
);

INSERT INTO functions_security_policy (function_name, function_args, expose_to_anon, expose_to_authenticated, comment)
VALUES
  ('fn_destinataires_conformite', 'uuid', false, false, 'Helper trigger - liste des destinataires de notifications Conformite'),
  ('fn_notify_prescription_creee', '', false, false, 'Trigger notification prescription creee'),
  ('fn_notify_prescription_levee', '', false, false, 'Trigger notification prescription levee validee'),
  ('fn_notify_commission_creee', '', false, false, 'Trigger notification commission creee'),
  ('fn_notify_commission_pv_recu', '', false, false, 'Trigger notification PV commission recu'),
  ('fn_notify_phase_changement', '', false, false, 'Trigger notification changement de phase'),
  ('fn_send_conformite_email_async', '', false, false, 'Trigger envoi email asynchrone via pg_net');

SELECT apply_function_security_policy();
