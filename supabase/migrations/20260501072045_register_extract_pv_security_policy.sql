/*
  # Note Conformite ERP IA
  Les edge functions (extract-pv-prescriptions, send-conformite-email,
  check-conformite-deadlines) sont autonomes et n'exposent aucune RPC SQL.
  Rien a ajouter dans functions_security_policy pour ces edge functions.
*/

SELECT 1;
