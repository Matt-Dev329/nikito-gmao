-- Retrait d'une demande prestataire (masquée, pas effacée), comme les documents
ALTER TABLE public.demandes_prestataires ADD COLUMN actif boolean NOT NULL DEFAULT true;
