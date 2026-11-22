-- Bon d'intervention envoyé par mail au parc : date du dernier envoi
ALTER TABLE public.bons_intervention ADD COLUMN envoye_le timestamptz;