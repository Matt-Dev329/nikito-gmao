import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFournisseurs } from '@/hooks/queries/useReferentiel';
import { useFormationFilter } from '@/hooks/useFormation';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';
import type { PieceDetacheeAvecJoins } from '@/types/database';

type FiltreCritique = 'tous' | 'critique' | 'ok';

function usePiecesDetachees() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['pieces_detachees', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pieces_detachees')
        .select('*, fournisseurs(nom, contact_tel)')
        .eq('est_formation', estFormation)
        .order('nom');
      if (error) throw error;
      return (data ?? []) as PieceDetacheeAvecJoins[];
    },
  });
}

function useModifierStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, delta }: { id: string; delta: number }) => {
      const { data: current, error: fetchErr } = await supabase
        .from('pieces_detachees')
        .select('stock_actuel')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;
      const newQty = Math.max(0, (current.stock_actuel ?? 0) + delta);
      const { error } = await supabase
        .from('pieces_detachees')
        .update({ stock_actuel: newQty })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces_detachees'] });
    },
  });
}

function useCreerPiece() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (payload: {
      reference: string;
      nom: string;
      description?: string | null;
      fournisseur_id?: string | null;
      stock_actuel?: number;
      stock_min?: number;
      prix_unitaire_ht?: number | null;
      emplacement?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('pieces_detachees')
        .insert({ ...payload, est_formation: estFormation })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pieces_detachees'] });
    },
  });
}

export function PageStock() {
  const { data: pieces, isLoading } = usePiecesDetachees();
  const { data: fournisseurs } = useFournisseurs();
  const modStock = useModifierStock();

  const [recherche, setRecherche] = useState('');
  const [fournisseurFilter, setFournisseurFilter] = useState('');
  const [filtreCrit, setFiltreCrit] = useState<FiltreCritique>('tous');
  const [modaleCreer, setModaleCreer] = useState(false);
  const [mouvementPiece, setMouvementPiece] = useState<{ id: string; nom: string; type: 'entree' | 'sortie' } | null>(null);
  const [mouvementQty, setMouvementQty] = useState(1);

  const filtrees = useMemo(() => {
    let result = pieces ?? [];
    if (filtreCrit === 'critique') result = result.filter((p) => p.stock_actuel < p.stock_min);
    if (filtreCrit === 'ok') result = result.filter((p) => p.stock_actuel >= p.stock_min);
    if (fournisseurFilter) result = result.filter((p) => p.fournisseur_id === fournisseurFilter);
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((p) =>
        [p.reference, p.nom, p.emplacement].filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    return result;
  }, [pieces, filtreCrit, fournisseurFilter, recherche]);

  const kpis = useMemo(() => {
    const all = pieces ?? [];
    const critique = all.filter((p) => p.stock_actuel < p.stock_min).length;
    const valeurTotale = all.reduce((sum, p) => sum + (p.prix_unitaire_ht ?? 0) * p.stock_actuel, 0);
    return { total: all.length, critique, valeurTotale };
  }, [pieces]);

  const submitMouvement = async () => {
    if (!mouvementPiece) return;
    const delta = mouvementPiece.type === 'entree' ? mouvementQty : -mouvementQty;
    await modStock.mutateAsync({ id: mouvementPiece.id, delta });
    setMouvementPiece(null);
    setMouvementQty(1);
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Stock pieces detachees</h1>
          <p className="text-[13px] text-dim mt-1">
            {kpis.total} references &middot;{' '}
            <span className="text-red font-medium">{kpis.critique} en rupture</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModaleCreer(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
          >
            <span className="text-base leading-none">+</span> Nouvelle piece
          </button>
          <div className="hidden md:flex items-center gap-2 ml-1">
            <div className="h-8 w-px bg-white/[0.08]" />
            <SignalerInlineButton />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Compteur label="Total" value={String(kpis.total)} />
        <Compteur label="Stock critique" value={String(kpis.critique)} color="red" />
        <Compteur label="Valeur totale" value={`${kpis.valeurTotale.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR`} />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (reference, nom, emplacement)..."
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <select
            value={fournisseurFilter}
            onChange={(e) => setFournisseurFilter(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[200px]"
          >
            <option value="">Tous les fournisseurs</option>
            {fournisseurs?.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {(['tous', 'critique', 'ok'] as FiltreCritique[]).map((v) => (
            <Pill key={v} active={filtreCrit === v} variant="cyan" onClick={() => setFiltreCrit(v)} className="min-h-[36px]">
              {v === 'tous' ? 'Tous' : v === 'critique' ? 'Stock critique' : 'Stock OK'}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune piece trouvee.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="text-[10px] text-dim uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left py-2.5 px-4 font-medium">Reference</th>
                <th className="text-left py-2.5 px-3 font-medium">Nom</th>
                <th className="text-left py-2.5 px-3 font-medium">Fournisseur</th>
                <th className="text-right py-2.5 px-3 font-medium">Stock</th>
                <th className="text-right py-2.5 px-3 font-medium">Seuil</th>
                <th className="text-right py-2.5 px-3 font-medium">Prix HT</th>
                <th className="text-left py-2.5 px-3 font-medium">Emplacement</th>
                <th className="text-right py-2.5 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((p) => {
                const critique = p.stock_actuel < p.stock_min;
                return (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-nikito-cyan">{p.reference}</td>
                    <td className="py-3 px-3">{p.nom}</td>
                    <td className="py-3 px-3 text-dim">{p.fournisseurs?.nom ?? '—'}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={cn('font-semibold', critique ? 'text-red' : 'text-text')}>
                        {p.stock_actuel}
                      </span>
                      {critique && (
                        <span className="ml-1.5 text-[10px] bg-red/15 text-red px-1.5 py-0.5 rounded">
                          Critique
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-dim">{p.stock_min}</td>
                    <td className="py-3 px-3 text-right text-dim">
                      {p.prix_unitaire_ht != null ? `${Number(p.prix_unitaire_ht).toFixed(2)} EUR` : '—'}
                    </td>
                    <td className="py-3 px-3 text-dim">{p.emplacement ?? '—'}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setMouvementPiece({ id: p.id, nom: p.nom, type: 'entree' })}
                        className="text-green text-[11px] font-medium mr-3 hover:underline"
                      >
                        +Entree
                      </button>
                      <button
                        onClick={() => setMouvementPiece({ id: p.id, nom: p.nom, type: 'sortie' })}
                        className="text-red text-[11px] font-medium hover:underline"
                      >
                        -Sortie
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mouvementPiece && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
          <div className="w-full md:max-w-[400px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5">
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              {mouvementPiece.type === 'entree' ? 'Entree de stock' : 'Sortie de stock'}
            </div>
            <div className="text-[17px] font-semibold mt-1 mb-4">{mouvementPiece.nom}</div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">Quantite</label>
            <input
              type="number"
              min={1}
              value={mouvementQty}
              onChange={(e) => setMouvementQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] mb-4"
            />
            {modStock.isError && (
              <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
                Erreur : {(modStock.error as Error).message}
              </div>
            )}
            <div className="flex gap-2.5 justify-end">
              <button onClick={() => { setMouvementPiece(null); setMouvementQty(1); }} className="text-dim text-[12px] px-3 py-2 min-h-[44px]">
                Annuler
              </button>
              <button
                onClick={submitMouvement}
                disabled={modStock.isPending}
                className={cn(
                  'px-5 py-2 rounded-[10px] text-[12px] font-bold min-h-[44px]',
                  mouvementPiece.type === 'entree'
                    ? 'bg-green/15 text-green border border-green/30'
                    : 'bg-red/15 text-red border border-red/30',
                  modStock.isPending && 'opacity-40'
                )}
              >
                {modStock.isPending ? '...' : mouvementPiece.type === 'entree' ? `+${mouvementQty}` : `-${mouvementQty}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {modaleCreer && (
        <ModaleCreerPiece
          fournisseurs={fournisseurs ?? []}
          onClose={() => setModaleCreer(false)}
        />
      )}
    </div>
  );
}

function ModaleCreerPiece({
  fournisseurs,
  onClose,
}: {
  fournisseurs: Array<{ id: string; nom: string }>;
  onClose: () => void;
}) {
  const creer = useCreerPiece();
  const [reference, setReference] = useState('');
  const [nom, setNom] = useState('');
  const [fournisseurId, setFournisseurId] = useState('');
  const [stockMin, setStockMin] = useState(1);
  const [prixHt, setPrixHt] = useState('');
  const [emplacement, setEmplacement] = useState('');

  const submit = async () => {
    if (!reference.trim() || !nom.trim()) return;
    await creer.mutateAsync({
      reference: reference.trim(),
      nom: nom.trim(),
      fournisseur_id: fournisseurId || null,
      stock_actuel: 0,
      stock_min: stockMin,
      prix_unitaire_ht: prixHt ? parseFloat(prixHt) : null,
      emplacement: emplacement.trim() || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Stock</div>
            <div className="text-[19px] font-semibold mt-0.5">Nouvelle piece</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">
            &times;
          </button>
        </div>
        <div className="grid gap-3.5 mb-5">
          <Field label="Reference *">
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="REF-001" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
          <Field label="Nom *">
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la piece" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
          <Field label="Fournisseur">
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
              <option value="">Aucun</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Stock min">
              <input type="number" min={0} value={stockMin} onChange={(e) => setStockMin(parseInt(e.target.value) || 0)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
            <Field label="Prix HT (EUR)">
              <input type="text" value={prixHt} onChange={(e) => setPrixHt(e.target.value)} placeholder="0.00" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
          </div>
          <Field label="Emplacement">
            <input type="text" value={emplacement} onChange={(e) => setEmplacement(e.target.value)} placeholder="Ex: Etagere A3" className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
        </div>
        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(creer.error as Error).message}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button
            onClick={submit}
            disabled={!reference.trim() || !nom.trim() || creer.isPending}
            className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]', (!reference.trim() || !nom.trim() || creer.isPending) && 'opacity-40 cursor-not-allowed')}
          >
            {creer.isPending ? 'Creation...' : 'Creer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: string; color?: 'red' }) {
  return (
    <div className="bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-[100px]">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={cn('text-lg font-semibold', color === 'red' ? 'text-red' : 'text-text')}>{value}</div>
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
