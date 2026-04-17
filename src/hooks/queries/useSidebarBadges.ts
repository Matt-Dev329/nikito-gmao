import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface SidebarBadges {
  recurrences: number;
  cinqPourquoi: number;
  operations: number;
  invitationsPending: number;
}

export function useSidebarBadges() {
  return useQuery({
    queryKey: ['sidebar-badges'],
    queryFn: async (): Promise<SidebarBadges> => {
      const [recRes, fpRes, incRes, invRes] = await Promise.all([
        supabase
          .from('vue_recurrences_actives')
          .select('equipement_id', { count: 'exact', head: true }),
        supabase
          .from('fiches_5_pourquoi')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'ouvert'),
        supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['ouvert', 'a_faire']),
        supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .is('utilise_le', null)
          .gt('expire_le', new Date().toISOString()),
      ]);

      return {
        recurrences: recRes.count ?? 0,
        cinqPourquoi: fpRes.count ?? 0,
        operations: incRes.count ?? 0,
        invitationsPending: invRes.count ?? 0,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
