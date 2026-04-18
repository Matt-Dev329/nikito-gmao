import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useParcs, useEquipements, useFournisseurs } from '@/hooks/queries/useReferentiel';
import { useFormationFilter } from '@/hooks/useFormation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import type { MaintenancePreventiveAvecJoins } from '@/types/database';

type FiltreStatut = 'tous' | 'planifie' | 'en_retard' | 'fait';

const FREQ_LABELS: Record<number, string> = {
  7: 'Hebdo',
  14: '2 semaines',
  30: 'Mensuel',
  90: 'Trimestriel',
  180: 'Semestriel',
  365: 'Annuel',
};

function freqLabel(jours: number | null): string {
  if (!jours) return '—';
  return FREQ_LABELS[jours] ?? `${jours}j`;
}

function useMaintenancesPreventives() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['maintenances_preventives', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenances_preventives')
        .select('*, equipements(code, libelle, parc_id, parcs(code, nom)), fournisseurs(nom)')
        .eq('actif', true)
        .eq('est_formation', estFormation)
        .order('prochaine_echeance');
      if (error) throw error;
      return (data ?? []) as MaintenancePreventiveAvecJoins[];
    },
  });
}

function useCreerMaintenance() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (payload: {
      equipement_id: string;
      libelle: string;
      description?: string | null;
      frequence_jours?: number | null;
      prochaine_echeance: string;
      fournisseur_id?: string | null;
      duree_min_estimee?: number | null;
    }) => {
      const { data, error } = await supabase
        .from('maintenances_preventives')
        .insert({ ...payload, type: 'preventif_systematique', actif: true, est_formation: estFormation })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenances_preventives'] });
    },
  });
}

function useMarquerFait() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, frequence_jours }: { id: string; frequence_jours: number | null }) => {
      const today = new Date().toISOString().slice(0, 10);
      const nextDate = frequence_jours
        ? new Date(Date.now() + frequence_jours * 86400000).toISOString().slice(0, 10)
        : today;
      const { error } = await supabase
        .from('maintenances_preventives')
        .update({ derniere_execution: today, prochaine_echeance: nextDate })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenances_preventives'] });
    },
  });
}

function getStatut(m: MaintenancePreventiveAvecJoins): 'planifie' | 'en_retard' | 'fait' {
  const today = new Date().toISOString().slice(0, 10);
  if (m.derniere_execution === today) return 'fait';
  if (m.prochaine_echeance < today) return 'en_retard';
  return 'planifie';
}

const STATUT_BADGE = {
  planifie: { label: 'Planifie', cls: 'bg-nikito-cyan/15 text-nikito-cyan' },
  en_retard: { label: 'En retard', cls: 'bg-red/15 text-red' },
  fait: { label: 'Fait', cls: 'bg-green/15 text-green' },
};

export function PagePreventif() {
  const { data: maintenances, isLoading } = useMaintenancesPreventives();
  const { data: parcs } = useParcs();
  const marquerFait = useMarquerFait();

  const [parcFilter, setParcFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState<FiltreStatut>('tous');
  const [recherche, setRecherche] = useState('');
  const [modaleCreer, setModaleCreer] = useState(false);

  const enrichies = useMemo(() => {
    return (maintenances ?? []).map((m) => ({ ...m, _statut: getStatut(m) }));
  }, [maintenances]);

  const filtrees = useMemo(() => {
    let result = enrichies;
    if (parcFilter) result = result.filter((m) => m.equipements?.parc_id === parcFilter);
    if (statutFilter !== 'tous') result = result.filter((m) => m._statut === statutFilter);
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((m) =>
        [m.libelle, m.equipements?.code, m.equipements?.libelle].filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    return result;
  }, [enrichies, parcFilter, statutFilter, recherche]);

  const compteurs = useMemo(() => ({
    total: enrichies.length,
    enRetard: enrichies.filter((m) => m._statut === 'en_retard').length,
    planifie: enrichies.filter((m) => m._statut === 'planifie').length,
    fait: enrichies.filter((m) => m._statut === 'fait').length,
  }), [enrichies]);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Maintenance preventive</h1>
          <p className="text-[13px] text-dim mt-1">
            Planning des maintenances periodiques
          </p>
        </div>
        <button
          onClick={() => setModaleCreer(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
        >
          <span className="text-base leading-none">+</span> Planifier
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Compteur label="Total" value={compteurs.total} />
        <Compteur label="En retard" value={compteurs.enRetard} color="red" />
        <Compteur label="Planifie" value={compteurs.planifie} color="cyan" />
        <Compteur label="Fait auj." value={compteurs.fait} color="green" />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <select
            value={parcFilter}
            onChange={(e) => setParcFilter(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[200px]"
          >
            <option value="">Tous les parcs</option>
            {parcs?.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-px">
          {(['tous', 'en_retard', 'planifie', 'fait'] as FiltreStatut[]).map((v) => (
            <Pill key={v} active={statutFilter === v} variant="cyan" onClick={() => setStatutFilter(v)} className="min-h-[36px]">
              {v === 'tous' ? 'Tous' : v === 'en_retard' ? 'En retard' : v === 'planifie' ? 'Planifie' : 'Fait'}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune maintenance preventive.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtrees.map((m) => {
            const badge = STATUT_BADGE[m._statut];
            const echeance = new Date(m.prochaine_echeance).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric',
            });
            const derniere = m.derniere_execution
              ? new Date(m.derniere_execution).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
              : null;

            return (
              <Card key={m.id} borderLeft={m._statut === 'en_retard' ? 'red' : m._statut === 'fait' ? undefined : 'cyan'} className="p-4 px-[18px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', badge.cls)}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-dim bg-bg-deep px-2 py-0.5 rounded">
                        {freqLabel(m.frequence_jours)}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium leading-snug">{m.libelle}</p>
                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-dim mt-1">
                      {m.equipements && (
                        <span>
                          <span className="text-nikito-cyan font-mono mr-1">{m.equipements.code}</span>
                          {m.equipements.libelle}
                        </span>
                      )}
                      <span>{m.equipements?.parcs?.nom}</span>
                      {m.fournisseurs?.nom && <span>{m.fournisseurs.nom}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-dim mt-1.5">
                      <span className={cn(m._statut === 'en_retard' && 'text-red font-medium')}>
                        Echeance : {echeance}
                      </span>
                      {derniere && <span>Derniere : {derniere}</span>}
                      {m.duree_min_estimee && <span>{m.duree_min_estimee} min</span>}
                    </div>
                  </div>
                  {m._statut !== 'fait' && (
                    <button
                      onClick={() => marquerFait.mutate({ id: m.id, frequence_jours: m.frequence_jours })}
                      disabled={marquerFait.isPending}
                      className="text-green text-[11px] font-bold bg-green/10 border border-green/20 px-3 py-2 rounded-[10px] min-h-[44px] whitespace-nowrap hover:bg-green/20"
                    >
                      Marquer fait
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modaleCreer && (
        <ModaleCreerMaintenance onClose={() => setModaleCreer(false)} />
      )}
    </div>
  );
}

function ModaleCreerMaintenance({ onClose }: { onClose: () => void }) {
  const creer = useCreerMaintenance();
  const { data: parcs } = useParcs();
  const [parcId, setParcId] = useState('');
  const { data: equipements } = useEquipements(parcId || undefined);
  const { data: fournisseurs } = useFournisseurs();

  const [equipementId, setEquipementId] = useState('');
  const [libelle, setLibelle] = useState('');
  const [frequence, setFrequence] = useState(30);
  const [prochaine, setProchaine] = useState(new Date().toISOString().slice(0, 10));
  const [fournisseurId, setFournisseurId] = useState('');
  const [duree, setDuree] = useState('');

  const submit = async () => {
    if (!equipementId || !libelle.trim()) return;
    await creer.mutateAsync({
      equipement_id: equipementId,
      libelle: libelle.trim(),
      frequence_jours: frequence,
      prochaine_echeance: prochaine,
      fournisseur_id: fournisseurId || null,
      duree_min_estimee: duree ? parseInt(duree) : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Preventif</div>
            <div className="text-[19px] font-semibold mt-0.5">Planifier une maintenance</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">&times;</button>
        </div>
        <div className="grid gap-3.5 mb-5">
          <Field label="Parc *">
            <select value={parcId} onChange={(e) => { setParcId(e.target.value); setEquipementId(''); }} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
              <option value="">Selectionner un parc</option>
              {parcs?.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Field>
          <Field label="Equipement *">
            <select value={equipementId} onChange={(e) => setEquipementId(e.target.value)} disabled={!parcId} className={cn('w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]', !parcId && 'opacity-40')}>
              <option value="">Selectionner</option>
              {(equipements ?? []).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
            </select>
          </Field>
          <Field label="Libelle *">
            <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex: Verification courroie" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Frequence">
              <select value={frequence} onChange={(e) => setFrequence(parseInt(e.target.value))} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
                <option value={7}>Hebdo (7j)</option>
                <option value={30}>Mensuel (30j)</option>
                <option value={90}>Trimestriel (90j)</option>
                <option value={180}>Semestriel (180j)</option>
                <option value={365}>Annuel (365j)</option>
              </select>
            </Field>
            <Field label="Prochaine echeance">
              <input type="date" value={prochaine} onChange={(e) => setProchaine(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Fournisseur">
              <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
                <option value="">Aucun</option>
                {fournisseurs?.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </Field>
            <Field label="Duree estimee (min)">
              <input type="number" value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="30" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
          </div>
        </div>
        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">Erreur : {(creer.error as Error).message}</div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button onClick={submit} disabled={!equipementId || !libelle.trim() || creer.isPending} className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]', (!equipementId || !libelle.trim() || creer.isPending) && 'opacity-40 cursor-not-allowed')}>
            {creer.isPending ? 'Creation...' : 'Planifier'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: number; color?: 'red' | 'cyan' | 'green' }) {
  const textCls = color === 'red' ? 'text-red' : color === 'cyan' ? 'text-nikito-cyan' : color === 'green' ? 'text-green' : 'text-text';
  return (
    <div className="bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-[90px]">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={cn('text-lg font-semibold', textCls)}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
