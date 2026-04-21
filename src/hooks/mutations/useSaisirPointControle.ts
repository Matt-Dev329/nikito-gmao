import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type EtatControleItem = 'non_saisi' | 'ok' | 'degrade' | 'hs'

export interface SaisirPointControleParams {
  controleId: string
  pointId: string
  etat: EtatControleItem
  equipementId?: string | null
  commentaire?: string | null
  photoUrl?: string | null
}

export interface SaisirPointControleResult {
  item_id: string
  controle_id: string
  point_id: string
  etat: EtatControleItem
  incident_genere_id: string | null
  saisi_le: string
  controle_statut: string
}

export function useSaisirPointControle() {
  const queryClient = useQueryClient()
  const { utilisateur } = useAuth()

  return useMutation<SaisirPointControleResult, Error, SaisirPointControleParams>({
    mutationFn: async (params) => {
      if (!utilisateur?.id) {
        throw new Error('Utilisateur non connecté — saisie impossible')
      }

      const { data, error } = await supabase.rpc('saisir_point_controle', {
        p_controle_id: params.controleId,
        p_point_id: params.pointId,
        p_etat: params.etat,
        p_equipement_id: params.equipementId ?? null,
        p_commentaire: params.commentaire ?? null,
        p_photo_url: params.photoUrl ?? null,
        p_saisi_par_id: utilisateur.id,
      })

      if (error) {
        const code = (error as any).code
        if (code === 'P0002') throw new Error('Ce contrôle a déjà été validé — impossible de le modifier')
        if (code === 'P0003') throw new Error('Ce contrôle a été remplacé — utilisez le nouveau')
        if (code === 'P0001' || code === 'P0004') throw new Error('Référence introuvable — vérifie que tu es sur le bon contrôle')
        throw error
      }

      return data as SaisirPointControleResult
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['controle', variables.controleId] })
      queryClient.invalidateQueries({ queryKey: ['controle-items', variables.controleId] })
      queryClient.invalidateQueries({ queryKey: ['controles'] })
      if (data?.incident_genere_id) {
        queryClient.invalidateQueries({ queryKey: ['incidents'] })
        queryClient.invalidateQueries({ queryKey: ['incident', data.incident_genere_id] })
      }
    },
  })
}
