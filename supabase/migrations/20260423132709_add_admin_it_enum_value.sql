/*
  # Add admin_it enum value to role_utilisateur

  1. Changes
    - Add 'admin_it' value to the role_utilisateur enum type
  2. Notes
    - Must be committed separately before being used in data operations
*/

ALTER TYPE public.role_utilisateur ADD VALUE IF NOT EXISTS 'admin_it';
