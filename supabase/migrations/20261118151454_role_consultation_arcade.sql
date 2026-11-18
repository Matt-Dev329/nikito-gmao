-- Nouveau rôle « Staff Arcade » : consultation seule des tickets arcade de ses parcs
ALTER TYPE public.role_utilisateur ADD VALUE IF NOT EXISTS 'consultation_arcade';