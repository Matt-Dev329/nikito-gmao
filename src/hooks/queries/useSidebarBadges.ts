import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';

interface SidebarBadges {
  recurrences: number;
  cinqPourquoi: number;
  operations: number;
  invitationsPending: number;
  controlesManquants: number;
  notificationsIA: number;
  interventionsEnCours: number;
}

export function useSidebarBadges() {
  const { estFormation } = useFormationFilter();
  const now = new Date();
  const heure = now.getHours();
  const today = now.toISOString().slice(0, 10);

  return useQuery({
    queryKey: ['sidebar-badges', estFormation, today],
    queryFn: async (): Promise<SidebarBadges> => {
      const [recRes, fpRes, incRes, invRes, notifRes, enCoursRes] = await Promise.all([
        supabase
          .from('vue_recurrences_actives')
          .select('equipement_id', { count: 'exact', head: true })
          .eq('est_formation', estFormation),
        supabase
          .from('fiches_5_pourquoi')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'ouvert')
          .eq('est_formation', estFormation),
        supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['ouvert', 'assigne'])
          .eq('est_formation', estFormation),
        supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .is('utilise_le', null)
          .gt('expire_le', new Date().toISOString()),
        supabase
          .from('hypotheses_ia')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'en_attente')
          .eq('est_formation', estFormation),
        supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'en_cours')
          .eq('est_formation', estFormation),
      ]);

      let controlesManquants = 0;
      if (heure >= 10) {
        const [parcsRes, ctrlRes] = await Promise.all([
          supabase.from('parcs').select('id', { count: 'exact', head: true }).eq('actif', true).neq('code', 'ECO'),
          supabase.from('controles').select('parc_id').eq('type', 'quotidien').eq('date_planifiee', today).eq('statut', 'valide').eq('est_formation', estFormation),
        ]);
        const totalParcs = parcsRes.count ?? 0;
        const parcsAvecControle = new Set((ctrlRes.data ?? []).map((c) => c.parc_id));
        controlesManquants = totalParcs - parcsAvecControle.size;
        if (controlesManquants < 0) controlesManquants = 0;
      }

      return {
        recurrences: recRes.count ?? 0,
        cinqPourquoi: fpRes.count ?? 0,
        operations: incRes.count ?? 0,
        invitationsPending: invRes.count ?? 0,
        controlesManquants,
        notificationsIA: notifRes.count ?? 0,
        interventionsEnCours: enCoursRes.count ?? 0,
      };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
