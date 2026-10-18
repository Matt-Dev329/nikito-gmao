-- Opérations visible pour les managers de parc (suivi en lecture seule)
UPDATE public.feature_flags
SET roles_autorises = array_append(roles_autorises, 'manager_parc')
WHERE feature_code = 'interventions'
  AND NOT ('manager_parc' = ANY (roles_autorises));
