import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface ValiderControleParams {
  controleId: string
  signatureUrl?: string | null
}

export interface ValiderControleResult {
  controle_id: string
  statut: 'valide'
  points_saisis: number
  nb_hs: number
  nb_degrade: number
  hash_integrite: string
  date_validation: string
}

export function useValiderControle() {
  const queryClient = useQueryClient()
  const { utilisateur } = useAuth()

  return useMutation<ValiderControleResult, Error, ValiderControleParams>({
    mutationFn: async (params) => {
      if (!utilisateur?.id) throw new Error('Utilisateur non connecté')

      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

      const { data, error } = await supabase.rpc('valider_controle', {
        p_controle_id: params.controleId,
        p_valide_par_id: utilisateur.id,
        p_signature_url: params.signatureUrl ?? null,
        p_signature_ip: null,
        p_signature_user_agent: userAgent,
        p_force: false,
      })

      if (error) {
        const code = (error as any).code
        if (code === 'P0002') throw new Error('Ce contrôle est déjà validé')
        if (code === 'P0005') throw new Error("Aucun point n'a été saisi — saisis au moins un point avant de valider")
        if (code === 'P0001') throw new Error('Contrôle introuvable')
        throw error
      }

      return data as ValiderControleResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['controle', variables.controleId] })
      queryClient.invalidateQueries({ queryKey: ['controles'] })
      queryClient.invalidateQueries({ queryKey: ['avancement-hebdo'] })
      queryClient.invalidateQueries({ queryKey: ['kpi-performance'] })
    },
  })
}
