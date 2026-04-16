import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useFournisseurs } from '@/hooks/queries/useReferentiel';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

// ============================================================
// Page Fournisseurs · CRUD complet
// Utilisé aussi en composant (ModaleNouveauFournisseur) ailleurs
// dans l'app pour ajout rapide depuis le wizard parc
// ============================================================

const types = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'pieces', label: 'Pièces détachées' },
  { value: 'norme', label: 'Conformité norme' },
  { value: 'audit', label: 'Audit constructeur' },
  { value: 'reglementaire', label: 'Réglementaire' },
];

export function PageFournisseursAdmin() {
  const { data: fournisseurs } = useFournisseurs();
  const [editeurOuvert, setEditeurOuvert] = useState(false);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Fournisseurs</h1>
          <div className="text-[13px] text-dim mt-1">
            {fournisseurs?.length ?? 0} fournisseurs · contrats et SLA
          </div>
        </div>
        <button
          onClick={() => setEditeurOuvert(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center sm:justify-start"
        >
          <span className="text-base">+</span> Nouveau fournisseur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fournisseurs?.map((f) => (
          <div key={f.id} className="bg-bg-card rounded-2xl p-4 px-5">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-base font-semibold">{f.nom}</div>
                <div className="text-[11px] text-dim mt-0.5">{f.type}</div>
              </div>
              {f.sla_h && (
                <span className="bg-nikito-cyan/15 text-nikito-cyan px-2 py-0.5 rounded-md text-[10px] font-semibold">
                  SLA {f.sla_h}h
                </span>
              )}
            </div>
            <div className="text-xs text-dim space-y-1">
              {f.contact_nom && <div>👤 {f.contact_nom}</div>}
              {f.contact_tel && <div>📞 {f.contact_tel}</div>}
              {f.numero_contrat && <div>📄 Contrat {f.numero_contrat}</div>}
            </div>
          </div>
        ))}
      </div>

      {editeurOuvert && (
        <ModaleNouveauFournisseur
          onClose={() => setEditeurOuvert(false)}
          onCreated={() => setEditeurOuvert(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Modale création fournisseur · réutilisable depuis n'importe où
// ============================================================
export function ModaleNouveauFournisseur({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (fournisseur: { id: string; nom: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [nom, setNom] = useState('');
  const [type, setType] = useState('maintenance');
  const [contactNom, setContactNom] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactTel, setContactTel] = useState('');
  const [numeroContrat, setNumeroContrat] = useState('');
  const [slaH, setSlaH] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const enregistrer = async () => {
    setSubmitting(true);
    const { data, error } = await supabase
      .from('fournisseurs')
      .insert({
        nom,
        type,
        contact_nom: contactNom || null,
        contact_email: contactEmail || null,
        contact_tel: contactTel || null,
        numero_contrat: numeroContrat || null,
        sla_h: slaH || null,
        notes: notes || null,
      })
      .select('id, nom')
      .single();

    setSubmitting(false);
    if (!error && data) {
      queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
      onCreated?.(data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[560px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              Nouveau fournisseur
            </div>
            <div className="text-[19px] font-semibold mt-0.5">Ajouter un fournisseur</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            ×
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
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
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
          <Field label="Téléphone">
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
          <Field label="N° de contrat">
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
            {submitting ? 'Enregistrement...' : 'Créer le fournisseur'}
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
