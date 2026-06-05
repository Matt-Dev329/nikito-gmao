
-- Ajout d'une valeur 'non_saisi' (par défaut) pour pouvoir créer les items vides
ALTER TYPE etat_controle_item ADD VALUE IF NOT EXISTS 'non_saisi' BEFORE 'ok';
;
