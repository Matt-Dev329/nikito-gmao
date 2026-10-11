/*
  # PIN staff : limite d'essais par parc (fenêtre glissante)

  Le PIN identifie seul la personne : un PIN faux ne peut être attribué à
  personne. L'ancien code incrémentait le compteur de TOUS les agents PIN du
  parc à chaque erreur, sans jamais l'oublier (remise à zéro seulement à la
  connexion de la personne) : des fautes de frappe accumulées sur des jours
  verrouillaient des agents qui n'y étaient pour rien.

  Désormais :
  - chaque PIN faux est journalisé par parc (table pin_tentatives_echouees,
    sans donnée personnelle, accessible uniquement via la fonction) ;
  - au-delà de 10 PIN faux en 10 minutes sur un parc, les connexions PIN de ce
    parc sont suspendues jusqu'à ce que la fenêtre se libère (protection
    contre l'essai systématique des codes) ;
  - les compteurs / verrous individuels ne sont plus utilisés et sont remis à
    zéro.
*/

CREATE TABLE IF NOT EXISTS public.pin_tentatives_echouees (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parc_id uuid NOT NULL REFERENCES public.parcs(id) ON DELETE CASCADE,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pin_tentatives_parc_date ON public.pin_tentatives_echouees(parc_id, cree_le DESC);
ALTER TABLE public.pin_tentatives_echouees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pin_tentatives_echouees FROM anon, authenticated;

UPDATE public.utilisateurs
   SET pin_failed_attempts = 0, pin_locked_until = NULL
 WHERE pin_failed_attempts <> 0 OR pin_locked_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.verifier_pin_staff(p_parc_code text, p_pin text)
 RETURNS TABLE(utilisateur_id uuid, prenom text, nom text, trigramme text, role_code role_utilisateur, pin_must_change boolean, is_locked boolean, lock_remaining_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_parc_id UUID;
v_user RECORD;
v_seuil CONSTANT int := 10;
v_fenetre CONSTANT interval := interval '10 minutes';
v_nb_echecs int;
v_liberation timestamptz;
BEGIN
SELECT id INTO v_parc_id FROM parcs WHERE code = p_parc_code AND actif = TRUE;
IF v_parc_id IS NULL THEN RETURN; END IF;

-- Trop d'essais récents sur ce parc : connexions PIN suspendues
SELECT count(*) INTO v_nb_echecs
FROM pin_tentatives_echouees
WHERE parc_id = v_parc_id AND cree_le > now() - v_fenetre;

IF v_nb_echecs >= v_seuil THEN
SELECT cree_le + v_fenetre INTO v_liberation
FROM pin_tentatives_echouees
WHERE parc_id = v_parc_id AND cree_le > now() - v_fenetre
ORDER BY cree_le DESC
OFFSET v_seuil - 1 LIMIT 1;

RETURN QUERY SELECT
NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::role_utilisateur, FALSE,
TRUE::boolean,
GREATEST(1, EXTRACT(EPOCH FROM (v_liberation - now()))::int);
RETURN;
END IF;

FOR v_user IN
SELECT u.id, u.prenom, u.nom, u.trigramme, r.code AS role_code,
u.code_pin_hash, u.pin_must_change
FROM utilisateurs u
JOIN roles r ON r.id = u.role_id
JOIN parcs_utilisateurs pu ON pu.utilisateur_id = u.id
WHERE pu.parc_id = v_parc_id
AND u.auth_mode = 'pin_seul'
AND u.statut_validation = 'valide'
AND u.actif = TRUE
LOOP
IF v_user.code_pin_hash = extensions.crypt(p_pin, v_user.code_pin_hash) THEN
RETURN QUERY SELECT
v_user.id, v_user.prenom, v_user.nom, v_user.trigramme,
v_user.role_code, v_user.pin_must_change,
FALSE::boolean, 0;
RETURN;
END IF;
END LOOP;

-- PIN faux : journalisé pour ce parc
INSERT INTO pin_tentatives_echouees (parc_id) VALUES (v_parc_id);

RETURN;
END;
$function$;
