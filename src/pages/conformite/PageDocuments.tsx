import { useState, useMemo } from 'react';
import { useDocumentsChantier, useCreateDocument, type DocumentChantier } from '@/hooks/queries/useConformite';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const CATEGORIE_LABELS: Record<string, { label: string; icon: string }> = {
  plan_architecte: { label: 'Plan architecte', icon: 'M' },
  dossier_erp: { label: 'Dossier ERP', icon: 'D' },
  attestation_controle_technique: { label: 'Attestation controle technique', icon: 'A' },
  rapport_bet: { label: 'Rapport BET', icon: 'R' },
  pv_commission: { label: 'PV commission', icon: 'P' },
  arrete_ouverture: { label: 'Arrete ouverture', icon: 'O' },
  bail: { label: 'Bail', icon: 'B' },
  attestation_ssi: { label: 'Attestation SSI', icon: 'S' },
  photo_chantier: { label: 'Photo chantier', icon: 'C' },
  autre: { label: 'Autre', icon: '?' },
};

export function PageDocuments() {
  const { data: documents, isLoading } = useDocumentsChantier();
  const [filtreParc, setFiltreParc] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [showModale, setShowModale] = useState(false);

  const parcsUniques = useMemo(() => {
    if (!documents) return [];
    const map = new Map<string, string>();
    documents.forEach((d) => {
      if (d.parcs) map.set(d.parc_id, `${d.parcs.code} - ${d.parcs.nom}`);
    });
    return Array.from(map.entries());
  }, [documents]);

  const filtered = useMemo(() => {
    if (!documents) return [];
    return documents.filter((d) => {
      if (filtreParc && d.parc_id !== filtreParc) return false;
      if (filtreCategorie && d.categorie !== filtreCategorie) return false;
      return true;
    });
  }, [documents, filtreParc, filtreCategorie]);

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Documents conformite</h1>
        <button
          onClick={() => setShowModale(true)}
          className="bg-gradient-cta text-bg-app px-4 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
        >
          + Uploader un document
        </button>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        <select value={filtreParc} onChange={(e) => setFiltreParc(e.target.value)} className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[40px]">
          <option value="">Tous les parcs</option>
          {parcsUniques.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[40px]">
          <option value="">Toutes categories</option>
          {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-bg-card rounded-xl h-32 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm">Aucun document</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      {showModale && <ModaleUploadDocument onClose={() => setShowModale(false)} />}
    </div>
  );
}

function DocumentCard({ doc }: { doc: DocumentChantier }) {
  const cat = CATEGORIE_LABELS[doc.categorie] ?? CATEGORIE_LABELS.autre;
  return (
    <div className="bg-bg-card rounded-xl p-4 border border-white/[0.06] hover:border-nikito-cyan/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-nikito-cyan/10 text-nikito-cyan flex items-center justify-center text-[14px] font-bold flex-shrink-0">
          {cat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate">{doc.intitule}</p>
          <p className="text-[11px] text-dim mt-0.5">{cat.label}</p>
          <div className="flex items-center gap-2 mt-2">
            {doc.parcs && (
              <span className="text-[9px] font-bold font-mono bg-nikito-cyan/10 text-nikito-cyan px-1.5 py-0.5 rounded">
                {doc.parcs.code}
              </span>
            )}
            {doc.date_document && (
              <span className="text-[10px] text-dim">{formatDate(doc.date_document)}</span>
            )}
            {doc.est_obligatoire_ouverture && (
              <span className="text-[9px] font-bold bg-amber/15 text-amber px-1.5 py-0.5 rounded">Obligatoire</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModaleUploadDocument({ onClose }: { onClose: () => void }) {
  const createDocument = useCreateDocument();
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
    categorie: 'autre',
    intitule: '',
    date_document: '',
    emis_par: '',
    est_obligatoire_ouverture: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parc_id || !form.intitule) return;
    createDocument.mutate(
      {
        parc_id: form.parc_id,
        categorie: form.categorie,
        intitule: form.intitule,
        fichier_url: '#placeholder',
        date_document: form.date_document || null,
        emis_par: form.emis_par || null,
        est_obligatoire_ouverture: form.est_obligatoire_ouverture,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold mb-4">Uploader un document</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Parc *">
            <select value={form.parc_id} onChange={(e) => setForm((f) => ({ ...f, parc_id: e.target.value }))} required className="input-field">
              <option value="">Selectionner</option>
              {parcs?.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.nom}</option>)}
            </select>
          </Field>
          <Field label="Categorie *">
            <select value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} className="input-field">
              {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Intitule *">
            <input type="text" value={form.intitule} onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))} required className="input-field" />
          </Field>
          <Field label="Date du document">
            <input type="date" value={form.date_document} onChange={(e) => setForm((f) => ({ ...f, date_document: e.target.value }))} className="input-field" />
          </Field>
          <Field label="Emis par">
            <input type="text" value={form.emis_par} onChange={(e) => setForm((f) => ({ ...f, emis_par: e.target.value }))} className="input-field" />
          </Field>
          <label className="flex items-center gap-2 text-[12px] text-dim cursor-pointer">
            <input type="checkbox" checked={form.est_obligatoire_ouverture} onChange={(e) => setForm((f) => ({ ...f, est_obligatoire_ouverture: e.target.checked }))} className="rounded" />
            Obligatoire pour ouverture
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
            <button type="submit" disabled={createDocument.isPending} className="bg-gradient-cta text-bg-app px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-50">
              {createDocument.isPending ? 'Creation...' : 'Creer'}
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
