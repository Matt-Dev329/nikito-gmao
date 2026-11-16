-- Staff connecté par code PIN (clé anon) : il doit aussi voir les points
-- DÉSACTIVÉS pour son parc, sinon la vue v_points_applicables_par_parc les
-- considère actifs (COALESCE(ppa.actif, true)) et ils réapparaissent dans
-- ses contrôles (ex. karting désactivé à Rosny revenu dans l'hebdo staff).
ALTER POLICY ppa_lecture_anon ON public.parc_points_actifs USING (true);