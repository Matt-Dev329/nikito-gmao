import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useCommissions, useCreateCommission, type Commission } from '@/hooks/queries/useConformite';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const TYPE_LABELS: Record<string, string> = {
  initiale_ouverture: 'Initiale (ouverture)',
  periodique: 'Periodique',
  travaux_modif: 'Travaux / modif.',
  levee_reserves: 'Levee de reserves',
  controle_inopine: 'Controle inopine',
};

const RESULTAT_LABELS: Record<string, { label: string; color: string }> = {
  favorable: { label: 'Favorable', color: 'text-green' },
  favorable_avec_reserves: { label: 'Favorable avec reserves', color: 'text-amber' },
  defavorable: { label: 'Defavorable', color: 'text-red' },
  differe: { label: 'Differe', color: 'text-dim' },
  en_attente_pv: { label: 'En attente PV', color: 'text-nikito-cyan' },
};

export function PageCommissions() {
  const { data: commissions, isLoading } = useCommissions();
  const [vue, setVue] = useState<'liste' | 'calendrier'>('liste');
  const [filtreParc, setFiltreParc] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtreResultat, setFiltreResultat] = useState('');
  const [showModale, setShowModale] = useState(false);

  const filtered = useMemo(() => {
    if (!commissions) return [];
    return commissions.filter((c) => {
      if (filtreParc && c.parc_id !== filtreParc) return false;
      if (filtreType && c.type_commission !== filtreType) return false;
      if (filtreResultat && c.resultat !== filtreResultat) return false;
      return true;
    });
  }, [commissions, filtreParc, filtreType, filtreResultat]);

  const parcsUniques = useMemo(() => {
    if (!commissions) return [];
    const map = new Map<string, string>();
    commissions.forEach((c) => {
      if (c.parcs) map.set(c.parc_id, `${c.parcs.code} - ${c.parcs.nom}`);
    });
    return Array.from(map.entries());
  }, [commissions]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Commissions de securite</h1>
        <button
          onClick={() => setShowModale(true)}
          className="bg-gradient-cta text-bg-app px-4 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
        >
          + Nouvelle commission
        </button>
      </header>

      {/* Onglets + filtres */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
        <div className="flex gap-1 bg-bg-deep rounded-lg p-1">
          <button
            onClick={() => setVue('liste')}
            className={cn('px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors min-h-[36px]', vue === 'liste' ? 'bg-bg-card text-text' : 'text-dim hover:text-text')}
          >
            Liste
          </button>
          <button
            onClick={() => setVue('calendrier')}
            className={cn('px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors min-h-[36px]', vue === 'calendrier' ? 'bg-bg-card text-text' : 'text-dim hover:text-text')}
          >
            Calendrier
          </button>
        </div>
        <div className="flex flex-wrap gap-2 flex-1">
          <select value={filtreParc} onChange={(e) => setFiltreParc(e.target.value)} className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[36px]">
            <option value="">Tous les parcs</option>
            {parcsUniques.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[36px]">
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filtreResultat} onChange={(e) => setFiltreResultat(e.target.value)} className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[36px]">
            <option value="">Tous les resultats</option>
            {Object.entries(RESULTAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {vue === 'liste' ? (
        <VueListe commissions={filtered} isLoading={isLoading} />
      ) : (
        <VueCalendrier commissions={filtered} />
      )}

      {showModale && <ModaleCreerCommission onClose={() => setShowModale(false)} />}
    </div>
  );
}

function VueListe({ commissions, isLoading }: { commissions: Commission[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="bg-bg-card rounded-xl h-64 animate-pulse" />;
  }

  if (commissions.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
        <p className="text-dim text-sm">Aucune commission</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-dim text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Parc</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Resultat</th>
              <th className="px-4 py-3 font-medium">Prochaine visite</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => {
              const res = c.resultat ? RESULTAT_LABELS[c.resultat] : null;
              return (
                <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium">{formatDate(c.date_visite)}</td>
                  <td className="px-4 py-3">
                    {c.parcs && (
                      <span className="text-[10px] font-bold font-mono bg-nikito-cyan/10 text-nikito-cyan px-1.5 py-0.5 rounded">
                        {c.parcs.code}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-dim">{TYPE_LABELS[c.type_commission] ?? c.type_commission}</td>
                  <td className="px-4 py-3">
                    {res ? <span className={cn('font-medium', res.color)}>{res.label}</span> : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-4 py-3 text-dim">{c.prochaine_visite_prevue ? formatDate(c.prochaine_visite_prevue) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VueCalendrier({ commissions }: { commissions: Commission[] }) {
  const [moisOffset, setMoisOffset] = useState(0);
  const now = new Date();
  const moisCourant = new Date(now.getFullYear(), now.getMonth() + moisOffset, 1);
  const nomMois = moisCourant.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const joursParSemaine = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const premierJour = new Date(moisCourant.getFullYear(), moisCourant.getMonth(), 1);
  const dernierJour = new Date(moisCourant.getFullYear(), moisCourant.getMonth() + 1, 0);
  const startOffset = (premierJour.getDay() + 6) % 7;

  const cells: Array<{ day: number | null; commissions: Commission[] }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null, commissions: [] });
  for (let d = 1; d <= dernierJour.getDate(); d++) {
    const dateStr = `${moisCourant.getFullYear()}-${String(moisCourant.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayComm = commissions.filter((c) => c.date_visite === dateStr);
    cells.push({ day: d, commissions: dayComm });
  }

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMoisOffset((o) => o - 1)} className="text-dim hover:text-text px-2 py-1 min-h-[44px]">&larr;</button>
        <span className="text-[14px] font-medium capitalize">{nomMois}</span>
        <button onClick={() => setMoisOffset((o) => o + 1)} className="text-dim hover:text-text px-2 py-1 min-h-[44px]">&rarr;</button>
      </div>
      <div className="grid grid-cols-7 gap-px">
        {joursParSemaine.map((j) => (
          <div key={j} className="text-center text-[10px] text-dim py-2 font-medium">{j}</div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              'min-h-[60px] p-1 rounded-lg border border-transparent',
              cell.day ? 'bg-bg-deep/50' : ''
            )}
          >
            {cell.day && (
              <>
                <span className="text-[10px] text-dim">{cell.day}</span>
                {cell.commissions.map((c) => (
                  <div
                    key={c.id}
                    className="mt-0.5 text-[8px] font-medium px-1 py-0.5 rounded bg-nikito-cyan/15 text-nikito-cyan truncate"
                    title={`${c.parcs?.code ?? ''} - ${TYPE_LABELS[c.type_commission] ?? ''}`}
                  >
                    {c.parcs?.code}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModaleCreerCommission({ onClose }: { onClose: () => void }) {
  const createCommission = useCreateCommission();
  const { data: parcs } = useQuery({
    queryKey: ['conformite', 'parcs-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parcs').select('id, code, nom').eq('actif', true).order('code');
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    parc_id: '',
    type_commission: 'periodique',
    date_visite: '',
    resultat: '',
    president_commission: '',
    numero_pv: '',
    prochaine_visite_prevue: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parc_id || !form.date_visite) return;
    createCommission.mutate(
      {
        parc_id: form.parc_id,
        type_commission: form.type_commission,
        date_visite: form.date_visite,
        date_pv: null,
        numero_pv: form.numero_pv || null,
        pv_url: null,
        president_commission: form.president_commission || null,
        presents_externes: [],
        presents_internes: [],
        resultat: form.resultat || null,
        prochaine_visite_prevue: form.prochaine_visite_prevue || null,
        notes: form.notes || null,
        cree_par_id: null,
        modifie_par_id: null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold mb-4">Nouvelle commission</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Parc *">
            <select
              value={form.parc_id}
              onChange={(e) => setForm((f) => ({ ...f, parc_id: e.target.value }))}
              required
              className="input-field"
            >
              <option value="">Selectionner un parc</option>
              {parcs?.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.nom}</option>)}
            </select>
          </Field>
          <Field label="Type *">
            <select
              value={form.type_commission}
              onChange={(e) => setForm((f) => ({ ...f, type_commission: e.target.value }))}
              className="input-field"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Date de visite *">
            <input
              type="date"
              value={form.date_visite}
              onChange={(e) => setForm((f) => ({ ...f, date_visite: e.target.value }))}
              required
              className="input-field"
            />
          </Field>
          <Field label="Resultat">
            <select
              value={form.resultat}
              onChange={(e) => setForm((f) => ({ ...f, resultat: e.target.value }))}
              className="input-field"
            >
              <option value="">En attente</option>
              {Object.entries(RESULTAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="President de commission">
            <input
              type="text"
              value={form.president_commission}
              onChange={(e) => setForm((f) => ({ ...f, president_commission: e.target.value }))}
              className="input-field"
            />
          </Field>
          <Field label="Numero PV">
            <input
              type="text"
              value={form.numero_pv}
              onChange={(e) => setForm((f) => ({ ...f, numero_pv: e.target.value }))}
              className="input-field"
            />
          </Field>
          <Field label="Prochaine visite prevue">
            <input
              type="date"
              value={form.prochaine_visite_prevue}
              onChange={(e) => setForm((f) => ({ ...f, prochaine_visite_prevue: e.target.value }))}
              className="input-field"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input-field min-h-[80px] resize-none"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
            <button type="submit" disabled={createCommission.isPending} className="bg-gradient-cta text-bg-app px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-50">
              {createCommission.isPending ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-dim mb-1">{label}</label>
      {children}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
