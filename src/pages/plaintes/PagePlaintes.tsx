import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useParcs, useEquipements } from '@/hooks/queries/useReferentiel';
import { useFormationFilter } from '@/hooks/useFormation';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import type { PlainteClientAvecJoins, CanalPlainte } from '@/types/database';

const CANAUX: Array<{ value: CanalPlainte; label: string }> = [
  { value: 'caisse', label: 'Caisse' },
  { value: 'google_review', label: 'Google' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Telephone' },
  { value: 'app_client', label: 'App' },
];

const CANAL_BADGE: Record<string, string> = {
  caisse: 'bg-nikito-pink/15 text-nikito-pink',
  google_review: 'bg-amber/15 text-amber',
  email: 'bg-nikito-cyan/15 text-nikito-cyan',
  tel: 'bg-green/15 text-green',
  app_client: 'bg-white/10 text-dim',
};

function usePlaintes() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['plaintes_clients', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plaintes_clients')
        .select('*, parcs(code, nom), equipements(code, libelle), incidents!ticket_genere_id(numero_bt)')
        .eq('est_formation', estFormation)
        .order('declare_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlainteClientAvecJoins[];
    },
  });
}

function useCreerPlainte() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (payload: {
      parc_id: string;
      equipement_id?: string | null;
      canal?: CanalPlainte | null;
      commentaire?: string | null;
      saisi_par_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('plaintes_clients')
        .insert({ ...payload, est_formation: estFormation })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plaintes_clients'] });
    },
  });
}

export function PagePlaintes() {
  const { data: plaintes, isLoading } = usePlaintes();
  const { data: parcs } = useParcs();
  const [parcFilter, setParcFilter] = useState('');
  const [canalFilter, setCanalFilter] = useState('');
  const [recherche, setRecherche] = useState('');
  const [modaleCreer, setModaleCreer] = useState(false);

  const filtrees = useMemo(() => {
    let result = plaintes ?? [];
    if (parcFilter) result = result.filter((p) => p.parc_id === parcFilter);
    if (canalFilter) result = result.filter((p) => p.canal === canalFilter);
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((p) =>
        [p.commentaire, p.equipements?.code, p.equipements?.libelle]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    return result;
  }, [plaintes, parcFilter, canalFilter, recherche]);

  const compteurs = useMemo(() => {
    const all = plaintes ?? [];
    const now = new Date();
    const _7jAgo = new Date(now.getTime() - 7 * 86400000);
    const _30jAgo = new Date(now.getTime() - 30 * 86400000);
    return {
      total: all.length,
      _7j: all.filter((p) => new Date(p.declare_le) >= _7jAgo).length,
      _30j: all.filter((p) => new Date(p.declare_le) >= _30jAgo).length,
      avecBT: all.filter((p) => p.ticket_genere_id).length,
    };
  }, [plaintes]);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Plaintes clients</h1>
          <p className="text-[13px] text-dim mt-1">
            Reclamations et retours clients
          </p>
        </div>
        <button
          onClick={() => setModaleCreer(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
        >
          <span className="text-base leading-none">+</span> Nouvelle plainte
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Compteur label="Total" value={compteurs.total} />
        <Compteur label="7 derniers jours" value={compteurs._7j} color="red" />
        <Compteur label="30 derniers jours" value={compteurs._30j} color="amber" />
        <Compteur label="Avec BT" value={compteurs.avecBT} color="cyan" />
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
          <Pill active={!canalFilter} variant="cyan" onClick={() => setCanalFilter('')} className="min-h-[36px]">
            Tous
          </Pill>
          {CANAUX.map((c) => (
            <Pill key={c.value} active={canalFilter === c.value} variant="cyan" onClick={() => setCanalFilter(c.value)} className="min-h-[36px]">
              {c.label}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune plainte.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtrees.map((p) => {
            const dateStr = new Date(p.declare_le).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const canalCls = p.canal ? CANAL_BADGE[p.canal] ?? 'bg-white/10 text-dim' : '';
            const canalLabel = p.canal ? CANAUX.find((c) => c.value === p.canal)?.label ?? p.canal : null;

            return (
              <Card key={p.id} className="p-4 px-[18px]">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] text-faint">{dateStr}</span>
                      {canalLabel && (
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', canalCls)}>
                          {canalLabel}
                        </span>
                      )}
                      {p.incidents && (
                        <span className="text-[10px] text-nikito-pink font-mono bg-nikito-pink/10 px-2 py-0.5 rounded-md">
                          {(p.incidents as unknown as { numero_bt: string }).numero_bt}
                        </span>
                      )}
                    </div>
                    {p.commentaire && (
                      <p className="text-[13px] text-text leading-snug mb-1.5">{p.commentaire}</p>
                    )}
                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-dim">
                      <span>{p.parcs?.nom}</span>
                      {p.equipements && (
                        <span>
                          <span className="text-nikito-cyan font-mono mr-1">{p.equipements.code}</span>
                          {p.equipements.libelle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modaleCreer && <ModaleCreerPlainte onClose={() => setModaleCreer(false)} />}
    </div>
  );
}

function ModaleCreerPlainte({ onClose }: { onClose: () => void }) {
  const creer = useCreerPlainte();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const [parcId, setParcId] = useState('');
  const { data: equipements } = useEquipements(parcId || undefined);

  const [equipementId, setEquipementId] = useState('');
  const [canal, setCanal] = useState<CanalPlainte | ''>('');
  const [commentaire, setCommentaire] = useState('');

  const submit = async () => {
    if (!parcId) return;
    await creer.mutateAsync({
      parc_id: parcId,
      equipement_id: equipementId || null,
      canal: (canal as CanalPlainte) || null,
      commentaire: commentaire.trim() || null,
      saisi_par_id: utilisateur?.id ?? null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Clients</div>
            <div className="text-[19px] font-semibold mt-0.5">Enregistrer une plainte</div>
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
          <Field label="Equipement concerne">
            <select value={equipementId} onChange={(e) => setEquipementId(e.target.value)} disabled={!parcId} className={cn('w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]', !parcId && 'opacity-40')}>
              <option value="">Aucun (optionnel)</option>
              {(equipements ?? []).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
            </select>
          </Field>
          <Field label="Canal">
            <select value={canal} onChange={(e) => setCanal(e.target.value as CanalPlainte | '')} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
              <option value="">Non precise</option>
              {CANAUX.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Commentaire">
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3} placeholder="Description de la plainte..." className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[80px]" />
          </Field>
        </div>
        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">Erreur : {(creer.error as Error).message}</div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button onClick={submit} disabled={!parcId || creer.isPending} className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]', (!parcId || creer.isPending) && 'opacity-40 cursor-not-allowed')}>
            {creer.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: number; color?: 'red' | 'amber' | 'cyan' }) {
  const textCls = color === 'red' ? 'text-red' : color === 'amber' ? 'text-amber' : color === 'cyan' ? 'text-nikito-cyan' : 'text-text';
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
