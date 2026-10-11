/*
  # Notifications push (téléphone / tablette)

  1. push_abonnements : appareils abonnés (Web Push) par utilisateur.
     Enregistrement / désactivation via RPC (un appareil partagé passe au
     dernier utilisateur qui l'active).
  2. push_notifications : notifications à envoyer (journal + idempotence).
     `notifier_push()` insère la notification et appelle l'edge function
     envoyer-push (pg_net, après commit) avec son id uniquement : l'edge
     function relit la notification en base, on ne peut donc pas envoyer un
     message arbitraire via l'API.
  3. Clé privée VAPID : stockée dans Vault (secret « vapid_private_key »),
     lisible uniquement par service_role via `vapid_cle_privee()`.
  4. Déclencheurs :
     - ticket assigné à quelqu'un (autre que soi) → ce technicien ;
     - nouvelle commande → chefs d'équipe actifs ;
     - commande validée / commandée / livrée / refusée → le demandeur.
*/

CREATE TABLE IF NOT EXISTS public.push_abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  actif boolean NOT NULL DEFAULT true,
  cree_le timestamptz NOT NULL DEFAULT now(),
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_abonnements_utilisateur ON public.push_abonnements(utilisateur_id) WHERE actif;
ALTER TABLE public.push_abonnements ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_abonnements_lecture_soi ON public.push_abonnements FOR SELECT TO authenticated
  USING (utilisateur_id = (SELECT current_utilisateur_id()));

CREATE TABLE IF NOT EXISTS public.push_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  utilisateur_id uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  titre text NOT NULL,
  corps text,
  url text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  envoye_le timestamptz,
  resultat text
);
CREATE INDEX IF NOT EXISTS idx_push_notifications_utilisateur ON public.push_notifications(utilisateur_id, cree_le DESC);
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_notifications_lecture_soi ON public.push_notifications FOR SELECT TO authenticated
  USING (utilisateur_id = (SELECT current_utilisateur_id()));

-- Abonnement de l'appareil courant
CREATE OR REPLACE FUNCTION public.enregistrer_abonnement_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_utilisateur_id uuid := current_utilisateur_id();
BEGIN
  IF v_utilisateur_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  INSERT INTO push_abonnements (utilisateur_id, endpoint, p256dh, auth, user_agent)
  VALUES (v_utilisateur_id, p_endpoint, p_p256dh, p_auth, p_user_agent)
  ON CONFLICT (endpoint) DO UPDATE
     SET utilisateur_id = EXCLUDED.utilisateur_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         actif = true,
         modifie_le = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.desactiver_abonnement_push(p_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  UPDATE push_abonnements SET actif = false, modifie_le = now()
   WHERE endpoint = p_endpoint AND utilisateur_id = current_utilisateur_id();
$$;

REVOKE EXECUTE ON FUNCTION public.enregistrer_abonnement_push(text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desactiver_abonnement_push(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_abonnement_push(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desactiver_abonnement_push(text) TO authenticated;

-- Clé privée VAPID (Vault), pour l'edge function uniquement
CREATE OR REPLACE FUNCTION public.vapid_cle_privee()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vapid_private_key' LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.vapid_cle_privee() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vapid_cle_privee() TO service_role;

-- Création + envoi asynchrone d'une notification
CREATE OR REPLACE FUNCTION public.notifier_push(p_utilisateur_id uuid, p_titre text, p_corps text, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_id bigint;
  v_project_url text := 'https://xhpykmhbahiikqbzwfkc.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocHlrbWhiYWhpaWtxYnp3ZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTMzNzEsImV4cCI6MjA5MTgyOTM3MX0.w4oRRpCBC3KUUcmH00Af7nRgrz0RnuO5T1iXT36-bTo';
BEGIN
  IF p_utilisateur_id IS NULL THEN
    RETURN;
  END IF;
  -- Personne d'abonné : rien à envoyer
  IF NOT EXISTS (SELECT 1 FROM push_abonnements WHERE utilisateur_id = p_utilisateur_id AND actif) THEN
    RETURN;
  END IF;
  INSERT INTO push_notifications (utilisateur_id, titre, corps, url)
  VALUES (p_utilisateur_id, p_titre, p_corps, p_url)
  RETURNING id INTO v_id;
  BEGIN
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/envoyer-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key),
      body := jsonb_build_object('notification_id', v_id),
      timeout_milliseconds := 30000
    );
  EXCEPTION WHEN OTHERS THEN
    -- La notification ne doit jamais bloquer l'action métier
    NULL;
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notifier_push(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- Déclencheur : ticket assigné
CREATE OR REPLACE FUNCTION public.fn_push_ticket_assigne()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.assigne_a_id IS NULL OR NEW.est_formation OR NEW.est_brouillon THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.assigne_a_id IS NOT DISTINCT FROM OLD.assigne_a_id THEN
    RETURN NEW;
  END IF;
  IF NEW.assigne_a_id = current_utilisateur_id() THEN
    RETURN NEW; -- on ne se notifie pas soi-même
  END IF;
  PERFORM notifier_push(
    NEW.assigne_a_id,
    'Ticket assigné · ' || NEW.numero_bt,
    NEW.titre,
    '/gmao/operations/' || NEW.numero_bt
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_ticket_assigne
  AFTER INSERT OR UPDATE OF assigne_a_id ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.fn_push_ticket_assigne();

-- Déclencheurs : commandes
CREATE OR REPLACE FUNCTION public.fn_push_commande()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_parc text;
  v_chef record;
  v_libelle text;
BEGIN
  SELECT nom INTO v_parc FROM parcs WHERE id = NEW.parc_id;

  IF TG_OP = 'INSERT' THEN
    FOR v_chef IN
      SELECT u.id FROM utilisateurs u JOIN roles r ON r.id = u.role_id
      WHERE u.actif AND r.code = 'chef_maintenance' AND u.id IS DISTINCT FROM NEW.demandeur_id
    LOOP
      PERFORM notifier_push(v_chef.id, 'Nouvelle commande · ' || NEW.numero,
        COALESCE(v_parc, '') , '/gmao/commander?onglet=a_traiter');
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.statut IS NOT DISTINCT FROM OLD.statut OR NEW.demandeur_id = current_utilisateur_id() THEN
    RETURN NEW;
  END IF;
  v_libelle := CASE NEW.statut
    WHEN 'validee' THEN 'validée'
    WHEN 'commandee' THEN 'commandée'
    WHEN 'livree' THEN 'livrée'
    WHEN 'refusee' THEN 'refusée'
    ELSE NULL END;
  IF v_libelle IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM notifier_push(NEW.demandeur_id, 'Commande ' || NEW.numero || ' ' || v_libelle,
    CASE WHEN NEW.statut = 'refusee' AND NEW.motif_refus IS NOT NULL THEN 'Motif : ' || NEW.motif_refus ELSE COALESCE(v_parc, '') END,
    '/gmao/commander?onglet=mes_commandes');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_commande
  AFTER INSERT OR UPDATE OF statut ON public.commandes
  FOR EACH ROW EXECUTE FUNCTION public.fn_push_commande();

REVOKE EXECUTE ON FUNCTION public.fn_push_ticket_assigne() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_push_commande() FROM PUBLIC, anon, authenticated;
