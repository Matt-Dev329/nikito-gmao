import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { usePlaintes, useQualifierPlainte, useReclasserPlainte, useSyncRoller, type PlainteRow } from './usePlaintesQueries';
import { ModaleCreerPlainte } from './ModaleCreerPlainte';
import { ModaleQualifierMaintenance, ModaleQualifierHorsMaintenance } from './ModaleQualifierPlainte';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';

type StatutFilter = '' | 'a_qualifier' | 'maintenance_confirmee' | 'hors_maintenance' | 'traite';
type SourceFilter = '' | 'roller_gxs' | 'manuel';
type PrioriteFilter = '' | 'critique' | 'haute' | 'normale';
type PeriodeFilter = '7' | '30' | '90' | 'all';

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  nouveau: { label: 'Nouveau', cls: 'bg-nikito-cyan/15 text-nikito-cyan' },
  a_qualifier: { label: 'A qualifier', cls: 'bg-amber/15 text-amber' },
  maintenance_confirmee: { label: 'Maintenance', cls: 'bg-red/15 text-red' },
  hors_maintenance: { label: 'Hors maintenance', cls: 'bg-white/10 text-dim' },
  traite: { label: 'Traite', cls: 'bg-green/15 text-green' },
};

const PRIORITE_BADGE: Record<string, { label: string; cls: string }> = {
  critique: { label: 'CRITIQUE', cls: 'bg-red/15 text-red' },
  haute: { label: 'HAUTE', cls: 'bg-amber/15 text-amber' },
  normale: { label: 'NORMALE', cls: 'bg-white/8 text-dim' },
};

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  roller_gxs: { label: 'Roller GXS', cls: 'bg-nikito-cyan/15 text-nikito-cyan' },
  manuel: { label: 'Manuel', cls: 'bg-white/10 text-dim' },
};

function usePrioriteIds() {
  return useQuery({
    queryKey: ['niveaux_priorite_map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('niveaux_priorite').select('id, code');
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        map[row.code] = row.id;
      }
      return map;
    },
    staleTime: Infinity,
  });
}

function Stars({ note }: { note: number }) {
  return (
    <span className="text-[13px] tracking-wide">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= note ? 'text-amber' : 'text-faint/30'}>
          {n <= note ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}

export function PagePlaintes() {
  const { utilisateur } = useAuth();
  const roleCode = useEffectiveRole(utilisateur?.role_code ?? 'direction');
  const canQualifier = roleCode === 'direction' || roleCode === 'chef_maintenance';
  const canSync = canQualifier;

  const { data: plaintes, isLoading } = usePlaintes();
  const { data: parcs } = useParcs();
  const { data: prioriteIds } = usePrioriteIds();
  const syncRoller = useSyncRoller();
  const marquerTraite = useQualifierPlainte();
  const reclasser = useReclasserPlainte();
  const navigate = useNavigate();

  const [statutFilter, setStatutFilter] = useState<StatutFilter>('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('');
  const [parcFilter, setParcFilter] = useState('');
  const [prioriteFilter, setPrioriteFilter] = useState<PrioriteFilter>('');
  const [periodeFilter, setPeriodeFilter] = useState<PeriodeFilter>('30');
  const [modaleCreer, setModaleCreer] = useState(false);
  const [modaleMaintenance, setModaleMaintenance] = useState<PlainteRow | null>(null);
  const [modaleHorsMaint, setModaleHorsMaint] = useState<PlainteRow | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const filtrees = useMemo(() => {
    let result = plaintes ?? [];
    if (statutFilter) result = result.filter((p) => p.statut === statutFilter);
    if (sourceFilter) result = result.filter((p) => p.source === sourceFilter);
    if (parcFilter) result = result.filter((p) => p.parc_id === parcFilter);
    if (prioriteFilter) result = result.filter((p) => p.priorite === prioriteFilter);
    if (periodeFilter !== 'all') {
      const jours = parseInt(periodeFilter);
      const cutoff = new Date(Date.now() - jours * 86400000);
      result = result.filter((p) => new Date(p.declare_le) >= cutoff);
    }
    return result;
  }, [plaintes, statutFilter, sourceFilter, parcFilter, prioriteFilter, periodeFilter]);

  const compteurs = useMemo(() => {
    const all = plaintes ?? [];
    const now = new Date();
    const debut30j = new Date(now.getTime() - 30 * 86400000);
    return {
      aQualifier: all.filter((p) => p.statut === 'a_qualifier').length,
      maintenanceConfirmee: all.filter((p) => p.statut === 'maintenance_confirmee').length,
      horsMaintenance: all.filter((p) => p.statut === 'hors_maintenance').length,
      traiteCeMois: all.filter((p) => p.statut === 'traite' && new Date(p.qualifie_le ?? p.declare_le) >= debut30j).length,
    };
  }, [plaintes]);

  const handleSync = async () => {
    setSyncResult(null);
    try {
      const res = await syncRoller.mutateAsync();
      setSyncResult(`Sync OK : ${res.inserees ?? 0} nouvelles plaintes, ${res.deja_importees ?? 0} deja importees`);
    } catch (err: any) {
      setSyncResult(`Erreur : ${err.message}`);
    }
  };

  const handleMarquerTraite = async (plainte: PlainteRow) => {
    if (!utilisateur) return;
    await marquerTraite.mutateAsync({
      plainteId: plainte.id,
      statut: 'traite',
      qualifieParId: utilisateur.id,
    });
  };

  const handleReclasser = async (plainte: PlainteRow) => {
    if (!utilisateur) return;
    await reclasser.mutateAsync({
      plainteId: plainte.id,
      qualifieParId: utilisateur.id,
    });
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Plaintes clients</h1>
          <p className="text-[13px] text-dim mt-1">Qualification et suivi des reclamations</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {canSync && (
            <button
              onClick={handleSync}
              disabled={syncRoller.isPending}
              className={cn(
                'bg-bg-card border border-white/[0.08] text-dim hover:text-text px-4 py-2.5 rounded-[10px] text-[13px] flex items-center gap-2 min-h-[44px] justify-center transition-colors',
                syncRoller.isPending && 'opacity-50 cursor-not-allowed'
              )}
            >
              <svg className={cn('w-4 h-4', syncRoller.isPending && 'animate-spin')} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 10a7 7 0 0 1 12.9-3.7M17 10a7 7 0 0 1-12.9 3.7" />
                <path d="M15 3v4h-4M5 17v-4h4" />
              </svg>
              {syncRoller.isPending ? 'Sync...' : 'Sync Roller GXS'}
            </button>
          )}
          <button
            onClick={() => setModaleCreer(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] justify-center"
          >
            <span className="text-base leading-none">+</span> Nouvelle plainte
          </button>
          <div className="hidden md:flex items-center gap-2 ml-1">
            <div className="h-8 w-px bg-white/[0.08]" />
            <SignalerInlineButton />
          </div>
        </div>
      </div>

      {syncResult && (
        <div className={cn(
          'text-[12px] mb-4 rounded-xl p-3 border',
          syncResult.startsWith('Erreur') ? 'bg-red/10 text-red border-red/20' : 'bg-green/10 text-green border-green/20'
        )}>
          {syncResult}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <Compteur
          label="A qualifier"
          value={compteurs.aQualifier}
          color="amber"
          pulse={compteurs.aQualifier > 0}
        />
        <Compteur label="Maintenance" value={compteurs.maintenanceConfirmee} color="red" />
        <Compteur label="Hors maintenance" value={compteurs.horsMaintenance} />
        <Compteur label="Traite (30j)" value={compteurs.traiteCeMois} color="green" />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={parcFilter}
            onChange={(e) => setParcFilter(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[180px]"
          >
            <option value="">Tous les parcs</option>
            {parcs?.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[160px]"
          >
            <option value="">Toutes sources</option>
            <option value="roller_gxs">Roller GXS</option>
            <option value="manuel">Manuel</option>
          </select>
          <select
            value={prioriteFilter}
            onChange={(e) => setPrioriteFilter(e.target.value as PrioriteFilter)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[150px]"
          >
            <option value="">Toutes priorites</option>
            <option value="critique">Critique</option>
            <option value="haute">Haute</option>
            <option value="normale">Normale</option>
          </select>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-px mobile-scroll-x">
          <Pill active={!statutFilter} variant="cyan" onClick={() => setStatutFilter('')} className="min-h-[36px]">Toutes</Pill>
          <Pill active={statutFilter === 'a_qualifier'} variant="cyan" onClick={() => setStatutFilter('a_qualifier')} className="min-h-[36px]">A qualifier</Pill>
          <Pill active={statutFilter === 'maintenance_confirmee'} variant="cyan" onClick={() => setStatutFilter('maintenance_confirmee')} className="min-h-[36px]">Maintenance</Pill>
          <Pill active={statutFilter === 'hors_maintenance'} variant="cyan" onClick={() => setStatutFilter('hors_maintenance')} className="min-h-[36px]">Hors maint.</Pill>
          <Pill active={statutFilter === 'traite'} variant="cyan" onClick={() => setStatutFilter('traite')} className="min-h-[36px]">Traite</Pill>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-px mobile-scroll-x">
          <Pill active={periodeFilter === '7'} variant="outline" onClick={() => setPeriodeFilter('7')} className="min-h-[32px] text-[11px]">7j</Pill>
          <Pill active={periodeFilter === '30'} variant="outline" onClick={() => setPeriodeFilter('30')} className="min-h-[32px] text-[11px]">30j</Pill>
          <Pill active={periodeFilter === '90'} variant="outline" onClick={() => setPeriodeFilter('90')} className="min-h-[32px] text-[11px]">90j</Pill>
          <Pill active={periodeFilter === 'all'} variant="outline" onClick={() => setPeriodeFilter('all')} className="min-h-[32px] text-[11px]">Tout</Pill>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune plainte.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtrees.map((p) => (
            <PlainteCard
              key={p.id}
              plainte={p}
              canQualifier={canQualifier}
              onConfirmMaintenance={() => setModaleMaintenance(p)}
              onConfirmHors={() => setModaleHorsMaint(p)}
              onMarquerTraite={() => handleMarquerTraite(p)}
              onReclasser={() => handleReclasser(p)}
              onCreerIncident={() => setModaleMaintenance(p)}
              onVoirIncident={() => navigate('/gmao/operations')}
            />
          ))}
        </div>
      )}

      {modaleCreer && <ModaleCreerPlainte onClose={() => setModaleCreer(false)} />}

      {modaleMaintenance && utilisateur && prioriteIds && (
        <ModaleQualifierMaintenance
          plainte={modaleMaintenance}
          prioriteIds={prioriteIds}
          userId={utilisateur.id}
          onClose={() => setModaleMaintenance(null)}
        />
      )}

      {modaleHorsMaint && utilisateur && (
        <ModaleQualifierHorsMaintenance
          plainte={modaleHorsMaint}
          userId={utilisateur.id}
          onClose={() => setModaleHorsMaint(null)}
        />
      )}
    </div>
  );
}

function PlainteCard({
  plainte: p,
  canQualifier,
  onConfirmMaintenance,
  onConfirmHors,
  onMarquerTraite,
  onReclasser,
  onCreerIncident,
  onVoirIncident,
}: {
  plainte: PlainteRow;
  canQualifier: boolean;
  onConfirmMaintenance: () => void;
  onConfirmHors: () => void;
  onMarquerTraite: () => void;
  onReclasser: () => void;
  onCreerIncident: () => void;
  onVoirIncident: () => void;
}) {
  const dateStr = new Date(p.declare_le).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const statut = STATUT_BADGE[p.statut ?? 'nouveau'] ?? STATUT_BADGE.nouveau;
  const priorite = PRIORITE_BADGE[p.priorite ?? 'normale'] ?? PRIORITE_BADGE.normale;
  const source = SOURCE_BADGE[p.source ?? 'manuel'] ?? SOURCE_BADGE.manuel;

  const qualifDate = p.qualifie_le
    ? new Date(p.qualifie_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : null;
  const qualifNom = p.qualificateur
    ? `${p.qualificateur.prenom} ${p.qualificateur.nom.charAt(0)}.`
    : null;

  return (
    <Card className="p-4 px-[18px]">
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', source.cls)}>{source.label}</span>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', statut.cls)}>{statut.label}</span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', priorite.cls)}>{priorite.label}</span>
        {p.note_globale != null && p.note_globale > 0 && <Stars note={p.note_globale} />}
      </div>

      {p.commentaire && (
        <p className="text-[13px] text-text leading-snug mb-2 italic">
          &laquo; {p.commentaire} &raquo;
        </p>
      )}

      <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-dim mb-1">
        {p.client_nom && <span className="font-medium text-text/80">{p.client_nom}</span>}
        <span>{p.parcs?.nom}</span>
        {p.date_visite && <span>{new Date(p.date_visite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>}
        <span className="text-faint">{dateStr}</span>
        {p.equipements && (
          <span>
            <span className="text-nikito-cyan font-mono mr-1">{p.equipements.code}</span>
            {p.equipements.libelle}
          </span>
        )}
      </div>

      {qualifNom && qualifDate && (
        <div className="text-[11px] text-dim mt-1">
          {p.statut === 'hors_maintenance'
            ? `Classe hors maintenance par ${qualifNom} le ${qualifDate}`
            : p.statut === 'traite'
              ? `Traite par ${qualifNom} le ${qualifDate}`
              : `Qualifie par ${qualifNom} le ${qualifDate}`}
          {p.motif_qualification && p.statut === 'hors_maintenance' && (
            <span className="text-faint"> : {p.motif_qualification}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-3">
        {p.statut === 'a_qualifier' && canQualifier && (
          <>
            <button
              onClick={onConfirmMaintenance}
              className="bg-green/15 text-green px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-green/25 transition-colors"
            >
              Maintenance
            </button>
            <button
              onClick={onConfirmHors}
              className="bg-white/8 text-dim px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-white/15 transition-colors"
            >
              Hors maintenance
            </button>
          </>
        )}

        {p.statut === 'maintenance_confirmee' && (
          <>
            {p.incident_cree_id && p.incident_lie ? (
              <button
                onClick={onVoirIncident}
                className="bg-nikito-cyan/15 text-nikito-cyan px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-nikito-cyan/25 transition-colors flex items-center gap-1"
              >
                Voir l'incident {p.incident_lie.numero_bt} &rarr;
              </button>
            ) : canQualifier ? (
              <button
                onClick={onCreerIncident}
                className="bg-amber/15 text-amber px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-amber/25 transition-colors"
              >
                Creer l'incident
              </button>
            ) : null}
            {canQualifier && (
              <button
                onClick={onMarquerTraite}
                className="bg-green/15 text-green px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-green/25 transition-colors"
              >
                Marquer traite
              </button>
            )}
          </>
        )}

        {p.statut === 'hors_maintenance' && canQualifier && (
          <button
            onClick={onReclasser}
            className="bg-white/8 text-dim px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-white/15 transition-colors"
          >
            Reclasser en maintenance
          </button>
        )}

        {p.statut === 'traite' && p.incident_lie && (
          <button
            onClick={onVoirIncident}
            className="bg-green/10 text-green px-3 py-1.5 rounded-lg text-[12px] font-semibold min-h-[36px] hover:bg-green/20 transition-colors flex items-center gap-1"
          >
            Incident {p.incident_lie.numero_bt} &rarr;
          </button>
        )}
      </div>
    </Card>
  );
}

function Compteur({ label, value, color, pulse }: { label: string; value: number; color?: 'red' | 'amber' | 'cyan' | 'green'; pulse?: boolean }) {
  const textCls = color === 'red' ? 'text-red' : color === 'amber' ? 'text-amber' : color === 'cyan' ? 'text-nikito-cyan' : color === 'green' ? 'text-green' : 'text-text';
  return (
    <div className={cn('bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-0', pulse && 'ring-1 ring-amber/30')}>
      <div className="text-[10px] text-dim uppercase tracking-wider whitespace-nowrap">{label}</div>
      <div className={cn('text-lg font-semibold', textCls)}>{value}</div>
    </div>
  );
}
