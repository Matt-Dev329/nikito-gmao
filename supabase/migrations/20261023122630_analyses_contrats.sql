-- Analyse automatique des contrats prestataires : à quoi sert le contrat,
-- prestations, durée, reconduction, préavis, prix, délais d'intervention,
-- obligations et points d'attention. Écrite par l'edge function
-- analyser-contrat ; lisible par ceux qui voient le contrat (directeurs de
-- parc sur leurs parcs, chef d'équipe, direction, admin IT).

CREATE TABLE public.analyses_contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL UNIQUE REFERENCES public.documents_techniques(id) ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'en_cours', 'terminee', 'echec')),
  resume text,
  objet text,
  prestations jsonb NOT NULL DEFAULT '[]',
  frequence_interventions text,
  delais_intervention text,
  date_debut date,
  date_fin date,
  duree text,
  reconduction text,
  preavis text,
  date_limite_resiliation date,
  montant text,
  conditions_paiement text,
  obligations_nikito jsonb NOT NULL DEFAULT '[]',
  exclusions jsonb NOT NULL DEFAULT '[]',
  penalites text,
  contacts text,
  points_attention jsonb NOT NULL DEFAULT '[]',
  prestataire_detecte text,
  erreur text,
  modele text,
  cree_le timestamptz NOT NULL DEFAULT now(),
  analyse_le timestamptz
);

ALTER TABLE public.analyses_contrats ENABLE ROW LEVEL SECURITY;

CREATE POLICY analyses_contrats_lecture ON public.analyses_contrats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.documents_techniques d
                 WHERE d.id = analyses_contrats.document_id AND acces_direction_parc(d.parc_id)));

REVOKE ALL ON public.analyses_contrats FROM anon, authenticated;
GRANT SELECT ON public.analyses_contrats TO authenticated;
