
-- ═══════════════════════════════════════════════════════════════════
-- CONVERSION DES 9 VUES SECURITY DEFINER → SECURITY INVOKER
-- (les vues utilisent les permissions de l'utilisateur connecté, 
--  pas celles du créateur — bonne pratique RLS)
-- ═══════════════════════════════════════════════════════════════════

ALTER VIEW public.vue_kpi_premier_coup SET (security_invoker = true);
ALTER VIEW public.vue_perf_technicien_30j SET (security_invoker = true);
ALTER VIEW public.v_points_applicables_par_parc SET (security_invoker = true);
ALTER VIEW public.vue_kpi_mttr SET (security_invoker = true);
ALTER VIEW public.vue_kpi_plaintes SET (security_invoker = true);
ALTER VIEW public.vue_avancement_hebdo SET (security_invoker = true);
ALTER VIEW public.vue_recurrences_actives SET (security_invoker = true);
ALTER VIEW public.vue_kpi_performance SET (security_invoker = true);
ALTER VIEW public.vue_kpi_mtbf SET (security_invoker = true);
;
