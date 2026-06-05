
ALTER FUNCTION public.generer_tous_controles_mensuel(date) SET search_path = public, pg_temp;
ALTER FUNCTION public.generer_tous_controles_quotidiens(date) SET search_path = public, pg_temp;
ALTER FUNCTION public.generer_tous_controles_hebdo(date) SET search_path = public, pg_temp;
ALTER FUNCTION public.generer_controle_par_type(uuid, type_controle, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.generer_controle_quotidien(uuid, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_numero_bt() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_recurrence() SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_stock() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_certification() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_plaintes_recurrence() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_modifie_le() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_utilisateur_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_role_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_parc_ids() SET search_path = public, pg_temp;
ALTER FUNCTION public.verifier_pin_staff(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.accepter_invitation(text, uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_create_incident() SET search_path = public, pg_temp;
;
