-- Intervention d'urgence envoyée comme bon d'intervention : bon créé et date d'envoi
ALTER TABLE public.interventions_urgence
  ADD COLUMN bon_id uuid REFERENCES public.bons_intervention(id) ON DELETE SET NULL,
  ADD COLUMN envoye_le timestamptz;
CREATE INDEX interventions_urgence_bon_idx ON public.interventions_urgence(bon_id);