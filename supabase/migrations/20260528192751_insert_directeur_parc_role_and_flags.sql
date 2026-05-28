/*
  # Insert directeur_parc role and update feature flags

  1. New Role
    - `directeur_parc` in roles table with ordre=2 (same level as chef_maintenance)
    - Label: "Directeur de parc"

  2. Feature Flags
    - Grant directeur_parc access to all features that chef_maintenance has

  3. Security
    - RLS policies will be updated separately to include this role
*/

INSERT INTO roles (code, nom, permissions, ordre)
VALUES ('directeur_parc', 'Directeur de parc', '{}', 2)
ON CONFLICT (code) DO NOTHING;

UPDATE feature_flags
SET roles_autorises = array_append(roles_autorises, 'directeur_parc')
WHERE 'chef_maintenance' = ANY(roles_autorises)
  AND NOT ('directeur_parc' = ANY(roles_autorises));
