-- Onglet « Stats » (Ryad) : activité de chaque compte (tickets ouverts,
-- clôturés, interventions, connexions). Journal des connexions tenu à partir
-- de maintenant (comptes et staff par code PIN).
CREATE TABLE public.journal_connexions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  utilisateur_id uuid NOT NULL REFERENCES public.utilisateurs(id) ON DELETE CASCADE,
  le timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'compte' CHECK (mode IN ('compte', 'pin')),
  appareil text
);
CREATE INDEX journal_connexions_utilisateur_le_idx ON public.journal_connexions (utilisateur_id, le DESC);
ALTER TABLE public.journal_connexions ENABLE ROW LEVEL SECURITY;
-- Aucun accès direct : écriture par les fonctions ci-dessous, lecture par stats_equipe

-- Connexion d'un compte (une entrée au plus toutes les 30 minutes)
CREATE OR REPLACE FUNCTION public.noter_connexion(p_appareil text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid := current_utilisateur_id();
BEGIN
  IF v_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM journal_connexions WHERE utilisateur_id = v_id AND le > now() - interval '30 minutes') THEN
    RETURN;
  END IF;
  INSERT INTO journal_connexions (utilisateur_id, mode, appareil) VALUES (v_id, 'compte', left(p_appareil, 40));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.noter_connexion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.noter_connexion(text) TO authenticated;

-- Connexion du staff par code PIN (sans compte), même limite
CREATE OR REPLACE FUNCTION public.noter_connexion_staff(p_utilisateur uuid, p_appareil text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM utilisateurs u JOIN roles r ON r.id = u.role_id
                 WHERE u.id = p_utilisateur AND u.actif AND r.code = 'staff_operationnel') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM journal_connexions WHERE utilisateur_id = p_utilisateur AND le > now() - interval '30 minutes') THEN
    RETURN;
  END IF;
  INSERT INTO journal_connexions (utilisateur_id, mode, appareil) VALUES (p_utilisateur, 'pin', left(p_appareil, 40));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.noter_connexion_staff(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.noter_connexion_staff(uuid, text) TO anon, authenticated;

-- Statistiques par compte sur une période (Ryad uniquement)
CREATE OR REPLACE FUNCTION public.stats_equipe(p_depuis timestamptz)
 RETURNS TABLE(
   utilisateur_id uuid, prenom text, nom text, role_code text, parcs text, actif boolean,
   tickets_ouverts bigint, tickets_clotures bigint, interventions bigint, minutes_intervention bigint,
   connexions bigint, derniere_connexion timestamptz
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT coalesce(acces_tableau_de_bord(), false) THEN
    RAISE EXCEPTION 'Réservé' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.prenom::text, u.nom::text, r.code::text,
         (SELECT string_agg(p.code, ', ' ORDER BY p.code) FROM parcs_utilisateurs pu JOIN parcs p ON p.id = pu.parc_id WHERE pu.utilisateur_id = u.id)::text,
         u.actif,
         (SELECT count(*) FROM incidents i WHERE i.declare_par_id = u.id AND i.declare_le >= p_depuis AND i.supprime_le IS NULL AND NOT i.est_formation),
         (SELECT count(*) FROM incidents i WHERE i.resolu_par_id = u.id AND i.resolu_le >= p_depuis AND i.supprime_le IS NULL AND NOT i.est_formation),
         (SELECT count(*) FROM interventions iv WHERE (iv.technicien_id = u.id OR iv.binome_id = u.id) AND iv.debut >= p_depuis),
         (SELECT coalesce(sum(greatest(0, extract(epoch FROM (iv.fin - iv.debut)) / 60)), 0)::bigint FROM interventions iv
            WHERE (iv.technicien_id = u.id OR iv.binome_id = u.id) AND iv.debut >= p_depuis AND iv.fin IS NOT NULL AND iv.fin - iv.debut < interval '24 hours'),
         (SELECT count(*) FROM journal_connexions j WHERE j.utilisateur_id = u.id AND j.le >= p_depuis),
         greatest((SELECT max(j.le) FROM journal_connexions j WHERE j.utilisateur_id = u.id),
                  (SELECT au.last_sign_in_at FROM auth.users au WHERE au.id = u.auth_user_id))
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  WHERE coalesce(u.statut_validation, 'valide') <> 'en_attente';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.stats_equipe(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stats_equipe(timestamptz) TO authenticated;
