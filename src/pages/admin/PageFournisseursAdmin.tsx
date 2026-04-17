import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFournisseurs } from '@/hooks/queries/useReferentiel';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const types = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'pieces', label: 'Pieces detachees' },
  { value: 'norme', label: 'Conformite norme' },
  { value: 'audit', label: 'Audit constructeur' },
  { value: 'reglementaire', label: 'Reglementaire' },
];

interface Fournisseur {
  id: string;
  nom: string;
  type: string | null;
  contact_nom: string | null;
  contact_email: string | null;
  contact_tel: string | null;
  numero_contrat: string | null;
  sla_h: number | null;
  notes: string | null;
  actif: boolean;
}

export function PageFournisseursAdmin() {
  const { data: fournisseurs } = useFournisseurs();
  const [editeurOuvert, setEditeurOuvert] = useState(false);
  const [editFournisseur, setEditFournisseur] = useState<Fournisseur | null>(null);
  const [recherche, setRecherche] = useState('');

  const filtered = useMemo(() => {
    if (!fournisseurs) return [];
    const q = recherche.toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter(
      (f) =>
        f.nom.toLowerCase().includes(q) ||
        f.contact_nom?.toLowerCase().includes(q) ||
        f.contact_email?.toLowerCase().includes(q) ||
        f.type?.toLowerCase().includes(q)
    );
  }, [fournisseurs, recherche]);

  const openEdit = (f: Fournisseur) => {
    setEditFournisseur(f);
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Fournisseurs</h1>
          <div className="text-[13px] text-dim mt-1">
            {fournisseurs?.length ?? 0} fournisseurs - contrats et SLA
          </div>
        </div>
        <button
          onClick={() => setEditeurOuvert(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center sm:justify-start"
        >
          <span className="text-base">+</span> Nouveau fournisseur
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un fournisseur..."
          className="w-full sm:max-w-xs bg-bg-card border border-white/[0.08] rounded-[10px] p-2.5 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
        />
      </div>

      {filtered.length === 0 && (
        <div className="text-dim text-sm py-8 text-center">Aucun fournisseur trouve</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((f) => (
          <button
            key={f.id}
            onClick={() => openEdit(f as Fournisseur)}
            className="bg-bg-card rounded-2xl p-4 px-5 text-left hover:bg-bg-card/80 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-base font-semibold">{f.nom}</div>
                <div className="text-[11px] text-dim mt-0.5">{f.type ?? 'Non defini'}</div>
              </div>
              {f.sla_h && (
                <span className="bg-nikito-cyan/15 text-nikito-cyan px-2 py-0.5 rounded-md text-[10px] font-semibold">
                  SLA {f.sla_h}h
                </span>
              )}
            </div>
            <div className="text-xs text-dim space-y-1">
              {f.contact_nom && <div>{f.contact_nom}</div>}
              {f.contact_tel && <div>{f.contact_tel}</div>}
              {f.contact_email && <div>{f.contact_email}</div>}
              {f.numero_contrat && <div>Contrat {f.numero_contrat}</div>}
            </div>
          </button>
        ))}
      </div>

      {editeurOuvert && (
        <ModaleFournisseur
          onClose={() => setEditeurOuvert(false)}
          onSaved={() => setEditeurOuvert(false)}
        />
      )}

      {editFournisseur && (
        <ModaleFournisseur
          fournisseur={editFournisseur}
          onClose={() => setEditFournisseur(null)}
          onSaved={() => setEditFournisseur(null)}
        />
      )}
    </div>
  );
}

export function ModaleNouveauFournisseur({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (fournisseur: { id: string; nom: string }) => void;
}) {
  return (
    <ModaleFournisseur
      onClose={onClose}
      onSaved={(data) => {
        if (data) onCreated?.(data);
      }}
    />
  );
}

function ModaleFournisseur({
  fournisseur,
  onClose,
  onSaved,
}: {
  fournisseur?: Fournisseur;
  onClose: () => void;
  onSaved?: (data?: { id: string; nom: string }) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!fournisseur;
  const [nom, setNom] = useState(fournisseur?.nom ?? '');
  const [type, setType] = useState(fournisseur?.type ?? 'maintenance');
  const [contactNom, setContactNom] = useState(fournisseur?.contact_nom ?? '');
  const [contactEmail, setContactEmail] = useState(fournisseur?.contact_email ?? '');
  const [contactTel, setContactTel] = useState(fournisseur?.contact_tel ?? '');
  const [numeroContrat, setNumeroContrat] = useState(fournisseur?.numero_contrat ?? '');
  const [slaH, setSlaH] = useState<number | ''>(fournisseur?.sla_h ?? '');
  const [notes, setNotes] = useState(fournisseur?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const enregistrer = async () => {
    setSubmitting(true);
    const payload = {
      nom,
      type,
      contact_nom: contactNom || null,
      contact_email: contactEmail || null,
      contact_tel: contactTel || null,
      numero_contrat: numeroContrat || null,
      sla_h: slaH || null,
      notes: notes || null,
    };

    if (isEdit) {
      const { error } = await supabase
        .from('fournisseurs')
        .update(payload)
        .eq('id', fournisseur.id);
      setSubmitting(false);
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
        onSaved?.();
      }
    } else {
      const { data, error } = await supabase
        .from('fournisseurs')
        .insert(payload)
        .select('id, nom')
        .single();
      setSubmitting(false);
      if (!error && data) {
        queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
        onSaved?.(data);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[560px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-white/[0.08] p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              {isEdit ? 'Modifier' : 'Nouveau'} fournisseur
            </div>
            <div className="text-[19px] font-semibold mt-0.5">
              {isEdit ? fournisseur.nom : 'Ajouter un fournisseur'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            x
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">
          <Field label="Nom" wide>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoFocus
              placeholder="Ex: SODIKART"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Type" wide>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Contact (nom)">
            <input
              type="text"
              value={contactNom}
              onChange={(e) => setContactNom(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Telephone">
            <input
              type="tel"
              value={contactTel}
              onChange={(e) => setContactTel(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="N de contrat">
            <input
              type="text"
              value={numeroContrat}
              onChange={(e) => setNumeroContrat(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="SLA (heures)">
            <input
              type="number"
              value={slaH}
              onChange={(e) => setSlaH(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="24, 48, 72..."
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y"
          />
        </Field>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-5">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={enregistrer}
            disabled={!nom || submitting}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!nom || submitting) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {submitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Creer le fournisseur'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
