/*
  # Create RPC to delete all recognized devices for the current user

  1. New Functions
    - `supprimer_devices_utilisateur_courant()` - Deletes all rows from `devices_reconnus`
      belonging to the authenticated user. Called after a password reset to force
      2FA re-verification on all devices.

  2. Security
    - Function is restricted to `authenticated` role
    - Uses `auth.uid()` to scope deletion to the calling user only
    - Uses `security_invoker = true` so RLS policies apply
*/

CREATE OR REPLACE FUNCTION public.supprimer_devices_utilisateur_courant()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM devices_reconnus
  WHERE utilisateur_id = (
    SELECT id FROM utilisateurs WHERE auth_user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.supprimer_devices_utilisateur_courant() TO authenticated;
