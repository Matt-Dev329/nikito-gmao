import { useState, useMemo } from 'react';
import { useActeursChantier, useCreateActeur } from '@/hooks/queries/useConformite';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const TYPE_ACTEUR_LABELS: Record<string, string> = {
  architecte: 'Architecte',
  bet_structure: 'BET Structure',
  bet_fluides: 'BET Fluides',
  controleur_technique: 'Controleur technique',
  coordonnateur_sps: 'Coordonnateur SPS',
  mainteneur_ssi: 'Mainteneur SSI',
  mairie: 'Mairie',
  sdis: 'SDIS',
  sous_commission_erp: 'Sous-commission ERP',
  maitre_oeuvre: 'Maitre d\'oeuvre',
  autre: 'Autre',
};

export function PageActeurs() {
  const { data: acteurs, isLoading } = useActeursChantier();
  const [filtreType, setFiltreType] = useState('');
  const [showModale, setShowModale] = useState(false);

  const filtered = useMemo(() => {
    if (!acteurs) return [];
    if (!filtreType) return acteurs;
    return acteurs.filter((a) => a.type_acteur === filtreType);
  }, [acteurs, filtreType]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Acteurs externes</h1>
        <button
          onClick={() => setShowModale(true)}
          className="bg-gradient-cta text-bg-app px-4 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
        >
          + Ajouter un acteur
        </button>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[40px]">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_ACTEUR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="bg-bg-card rounded-xl h-64 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm">Aucun acteur</p>
        </div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-dim text-left">
                  <th className="px-4 py-3 font-medium">Societe</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Parc</th>
                  <th className="px-4 py-3 font-medium">Mission</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium">{a.nom_societe}</td>
                    <td className="px-4 py-3 text-dim">{TYPE_ACTEUR_LABELS[a.type_acteur] ?? a.type_acteur}</td>
                    <td className="px-4 py-3">
                      <div className="text-text">{a.contact_nom ?? '—'}</div>
                      {a.contact_email && <div className="text-dim text-[10px]">{a.contact_email}</div>}
                      {a.contact_tel && <div className="text-dim text-[10px]">{a.contact_tel}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {a.parcs && (
                        <span className="text-[10px] font-bold font-mono bg-nikito-cyan/10 text-nikito-cyan px-1.5 py-0.5 rounded">
                          {a.parcs.code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-dim">
                      {a.date_debut_mission ? formatDate(a.date_debut_mission) : '—'}
                      {a.date_fin_mission && ` → ${formatDate(a.date_fin_mission)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModale && <ModaleCreerActeur onClose={() => setShowModale(false)} />}
    </div>
  );
}

function ModaleCreerActeur({ onClose }: { onClose: () => void }) {
  const createActeur = useCreateActeur();
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
    type_acteur: 'autre',
    nom_societe: '',
    contact_nom: '',
    contact_email: '',
    contact_tel: '',
    date_debut_mission: '',
    date_fin_mission: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parc_id || !form.nom_societe) return;
    createActeur.mutate(
      {
        parc_id: form.parc_id,
        type_acteur: form.type_acteur,
        nom_societe: form.nom_societe,
        contact_nom: form.contact_nom || null,
        contact_email: form.contact_email || null,
        contact_tel: form.contact_tel || null,
        date_debut_mission: form.date_debut_mission || null,
        date_fin_mission: form.date_fin_mission || null,
        notes: form.notes || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold mb-4">Ajouter un acteur</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Parc *">
            <select value={form.parc_id} onChange={(e) => setForm((f) => ({ ...f, parc_id: e.target.value }))} required className="input-field">
              <option value="">Selectionner</option>
              {parcs?.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.nom}</option>)}
            </select>
          </Field>
          <Field label="Type *">
            <select value={form.type_acteur} onChange={(e) => setForm((f) => ({ ...f, type_acteur: e.target.value }))} className="input-field">
              {Object.entries(TYPE_ACTEUR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Nom societe *">
            <input type="text" value={form.nom_societe} onChange={(e) => setForm((f) => ({ ...f, nom_societe: e.target.value }))} required className="input-field" />
          </Field>
          <Field label="Contact nom">
            <input type="text" value={form.contact_nom} onChange={(e) => setForm((f) => ({ ...f, contact_nom: e.target.value }))} className="input-field" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} className="input-field" />
          </Field>
          <Field label="Telephone">
            <input type="tel" value={form.contact_tel} onChange={(e) => setForm((f) => ({ ...f, contact_tel: e.target.value }))} className="input-field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Debut mission">
              <input type="date" value={form.date_debut_mission} onChange={(e) => setForm((f) => ({ ...f, date_debut_mission: e.target.value }))} className="input-field" />
            </Field>
            <Field label="Fin mission">
              <input type="date" value={form.date_fin_mission} onChange={(e) => setForm((f) => ({ ...f, date_fin_mission: e.target.value }))} className="input-field" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="input-field min-h-[60px] resize-none" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
            <button type="submit" disabled={createActeur.isPending} className="bg-gradient-cta text-bg-app px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-50">
              {createActeur.isPending ? 'Creation...' : 'Creer'}
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
