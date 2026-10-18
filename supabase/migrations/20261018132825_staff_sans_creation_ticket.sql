-- Le staff fait les contrôles quotidiens et hebdo mais ne crée pas de tickets.
-- Les tickets automatiques sur un point de contrôle KO passent par
-- auto_create_incident (SECURITY DEFINER) et ne sont pas concernés.
ALTER POLICY inc_staff_parc_creation ON public.incidents WITH CHECK (false);
