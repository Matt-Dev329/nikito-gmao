/*
  # Add directeur_parc enum value

  1. Changes
    - Add 'directeur_parc' value to role_utilisateur enum type

  2. Description
    - "Directeur de parc" is a leadership role above manager_parc
    - Has the same permissions as chef_maintenance (chef d'equipe)
    - Enum value must be committed separately before it can be used in data
*/

ALTER TYPE role_utilisateur ADD VALUE IF NOT EXISTS 'directeur_parc' AFTER 'chef_maintenance';
