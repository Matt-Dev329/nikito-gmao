import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function VueManagerParc() {
  const { utilisateur } = useAuth();
  const { data: allParcs } = useParcs();
  const navigate = useNavigate();

  const parcsUser = useMemo(() => {
    if (!allParcs || !utilisateur) return [];
    return allParcs.filter((p) => utilisateur.parc_ids.includes(p.id));
  }, [allParcs, utilisateur]);

  const [selectedParcId, setSelectedParcId] = useState<string | null>(null);

  const parcId = parcsUser.length === 1 ? parcsUser[0].id : selectedParcId;
  const parc = parcsUser.find((p) => p.id === parcId) ?? null;

  const { data: stats } = useQuery({
    queryKey: ['manager_parc_stats', parcId],
    queryFn: async () => {
      if (!parcId) return null;

      const [eqRes, incRes, ctrlRes] = await Promise.all([
        supabase
          .from('equipements')
          .select('statut')
          .eq('parc_id', parcId),
        supabase
          .from('incidents')
          .select('id')
          .eq('statut', 'ouvert')
          .in('equipement_id',
            (await supabase.from('equipements').select('id').eq('parc_id', parcId)).data?.map((e) => e.id) ?? []
          ),
        supabase
          .from('controles')
          .select('id, type, date_planifiee, date_validation, realise_par_id')
          .eq('parc_id', parcId)
          .eq('type', 'quotidien')
          .order('date_planifiee', { ascending: false })
          .limit(1),
      ]);

      const equipements = eqRes.data ?? [];
      const actifs = equipements.filter((e) => e.statut === 'actif').length;
      const maintenance = equipements.filter((e) => e.statut === 'maintenance').length;
      const horsService = equipements.filter((e) => e.statut === 'hors_service').length;

      const incidentsOuverts = incRes.data?.length ?? 0;

      const dernierControle = ctrlRes.data?.[0] ?? null;

      return {
        total: equipements.length,
        actifs,
        maintenance,
        horsService,
        incidentsOuverts,
        dernierControle,
      };
    },
    enabled: !!parcId,
  });

  if (!utilisateur) {
    return (
      <div className="p-4 md:p-6 md:px-7">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  if (parcsUser.length === 0) {
    return (
      <div className="p-4 md:p-6 md:px-7">
        <h1 className="text-xl md:text-[22px] font-semibold mb-2">Mon parc</h1>
        <div className="text-dim text-sm">Aucun parc assigne a votre compte.</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Mon parc</h1>
          {parc && (
            <div className="text-[13px] text-dim mt-1">{parc.code} - {parc.nom}</div>
          )}
        </div>
        {parcsUser.length > 1 && (
          <select
            value={parcId ?? ''}
            onChange={(e) => setSelectedParcId(e.target.value || null)}
            className="bg-bg-card border border-white/[0.08] rounded-[10px] p-2.5 px-3.5 text-text text-[13px] min-h-[44px]"
          >
            <option value="">Selectionner un parc</option>
            {parcsUser.map((p) => (
              <option key={p.id} value={p.id}>{p.code} - {p.nom}</option>
            ))}
          </select>
        )}
      </div>

      {!parcId && (
        <div className="text-dim text-sm">Selectionnez un parc pour afficher le resume.</div>
      )}

      {parcId && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard
            label="Equipements actifs"
            value={stats.actifs}
            sub={`${stats.total} total`}
            color="text-green"
            onClick={() => navigate('/gmao/equipements')}
          />
          <StatCard
            label="En maintenance"
            value={stats.maintenance}
            color="text-amber"
            onClick={() => navigate('/gmao/equipements')}
          />
          <StatCard
            label="Hors service"
            value={stats.horsService}
            color={stats.horsService > 0 ? 'text-red' : 'text-dim'}
            onClick={() => navigate('/gmao/equipements')}
          />
          <StatCard
            label="Incidents ouverts"
            value={stats.incidentsOuverts}
            color={stats.incidentsOuverts > 0 ? 'text-red' : 'text-green'}
            onClick={() => navigate('/gmao/operations')}
          />
          <StatCard
            label="Dernier controle quotidien"
            value={stats.dernierControle?.date_planifiee
              ? new Date(stats.dernierControle.date_planifiee).toLocaleDateString('fr-FR')
              : 'Aucun'}
            sub={stats.dernierControle?.date_validation ? 'Valide' : stats.dernierControle ? 'En cours' : undefined}
            color="text-nikito-cyan"
          />
          <StatCard
            label="Alertes equipements"
            value={stats.horsService + stats.maintenance}
            sub="Equipements a surveiller"
            color={stats.horsService + stats.maintenance > 0 ? 'text-amber' : 'text-green'}
            onClick={() => navigate('/gmao/equipements')}
          />
        </div>
      )}

      {parcId && !stats && (
        <div className="text-dim text-sm">Chargement des statistiques...</div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'bg-bg-card rounded-2xl p-4 px-5 text-left transition-colors',
        onClick && 'hover:bg-bg-card/80 cursor-pointer',
        !onClick && 'cursor-default'
      )}
    >
      <div className="text-[11px] text-dim uppercase tracking-wider mb-2">{label}</div>
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      {sub && <div className="text-[11px] text-dim mt-1">{sub}</div>}
    </button>
  );
}
