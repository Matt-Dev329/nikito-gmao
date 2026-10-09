import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface CloturerInterventionParams {
  incidentId: string;
  /** id de l'intervention existante a mettre a jour, sinon une nouvelle est creee */
  interventionId?: string | null;
  diagnostic: string;
  actions: string;
  resoluPremierCoup: boolean | null;
  photoAvantUrl?: string | null;
  photoApresUrl?: string | null;
  /** Pièces du stock consommées pendant la réparation (sortie de stock automatique) */
  pieces?: Array<{ pieceId: string; quantite: number }>;
}

/**
 * Cloture une intervention :
 *  1. enregistre l'intervention (diagnostic, actions, photos, resolu 1er coup, fin)
 *  2. enregistre les pièces utilisées → le trigger decrement_stock les sort du stock
 *  3. passe l'incident en statut 'resolu'
 *
 * Aucune RPC dediee n'existe cote Supabase : on ecrit directement dans les tables
 * (les policies RLS autorisent le role technicien en ecriture sur les deux tables).
 */
export function useCloturerIntervention() {
  const queryClient = useQueryClient();
  const { utilisateur } = useAuth();

  return useMutation<{ interventionId: string }, Error, CloturerInterventionParams>({
    mutationFn: async (params) => {
      if (!utilisateur?.id) throw new Error('Utilisateur non connecte');

      const nowISO = new Date().toISOString();
      const photosAvant = params.photoAvantUrl ? [params.photoAvantUrl] : [];
      const photosApres = params.photoApresUrl ? [params.photoApresUrl] : [];

      let interventionId = params.interventionId ?? null;

      if (interventionId) {
        const { error } = await supabase
          .from('interventions')
          .update({
            fin: nowISO,
            diagnostic: params.diagnostic || null,
            actions_realisees: params.actions || null,
            resolu_premier_coup: params.resoluPremierCoup,
            photos_avant: photosAvant,
            photos_apres: photosApres,
          })
          .eq('id', interventionId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from('interventions')
          .insert({
            incident_id: params.incidentId,
            technicien_id: utilisateur.id,
            debut: nowISO,
            fin: nowISO,
            diagnostic: params.diagnostic || null,
            actions_realisees: params.actions || null,
            resolu_premier_coup: params.resoluPremierCoup,
            photos_avant: photosAvant,
            photos_apres: photosApres,
          })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        interventionId = data.id as string;
      }

      if (params.pieces && params.pieces.length > 0) {
        // Idempotent en cas de nouvel essai : on n'insère pas une pièce déjà
        // enregistrée sur cette intervention (sinon double sortie de stock).
        const { data: deja, error: dejaErr } = await supabase
          .from('pieces_utilisees')
          .select('piece_id')
          .eq('intervention_id', interventionId);
        if (dejaErr) throw new Error(dejaErr.message);
        const dejaIds = new Set((deja ?? []).map((d) => d.piece_id as string));
        const aInserer = params.pieces
          .filter((p) => p.quantite > 0 && !dejaIds.has(p.pieceId))
          .map((p) => ({ intervention_id: interventionId, piece_id: p.pieceId, quantite: p.quantite }));
        if (aInserer.length > 0) {
          const { error: pErr } = await supabase.from('pieces_utilisees').insert(aInserer);
          if (pErr) throw new Error(`Pièces utilisées : ${pErr.message}`);
        }
      }

      const { error: incErr } = await supabase
        .from('incidents')
        .update({ statut: 'resolu', resolu_le: nowISO, resolu_par_id: utilisateur.id })
        .eq('id', params.incidentId);
      if (incErr) throw new Error(incErr.message);

      return { interventionId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['pieces_detachees'] });
    },
  });
}
