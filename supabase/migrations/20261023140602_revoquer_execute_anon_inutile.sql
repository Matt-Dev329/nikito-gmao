-- Sécurité : fonctions SECURITY DEFINER inutilement appelables sans connexion.
-- - Tickets (pause, réassignation, reprise, brouillon) : utilisées seulement
--   par des comptes connectés (page Opérations) → plus d'accès anonyme.
-- - Fonctions de trigger : jamais appelées directement → ni anonyme ni
--   connecté (les triggers continuent de fonctionner).
-- Les fonctions du staff PIN, de la 2FA et des invitations restent ouvertes.

REVOKE EXECUTE ON FUNCTION public.mettre_en_pause_incident(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reassigner_incident(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reprendre_incident(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.valider_brouillon_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mettre_en_pause_incident(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassigner_incident(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reprendre_incident(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_brouillon_incident(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_notifier_controle_fait() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_ticket_creation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_role_cache() FROM PUBLIC, anon, authenticated;
