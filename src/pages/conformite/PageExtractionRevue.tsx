import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  useExtraction,
  usePrescriptionsExtraction,
  useUpdatePrescription,
  useUpdateExtraction,
  type Prescription,
} from '@/hooks/queries/useConformite';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['SSI', 'desenfumage', 'evacuation', 'eclairage_secours', 'electrique', 'ascenseur', 'isolement_coupe_feu', 'accessibilite_pmr', 'capacite_accueil', 'autre'] as const;
const GRAVITES = ['bloquante', 'majeure', 'mineure'] as const;

const GRAVITE_COLORS: Record<string, string> = {
  bloquante: 'bg-red/15 text-red',
  majeure: 'bg-amber/15 text-amber',
  mineure: 'bg-yellow-400/15 text-yellow-400',
};

export function PageExtractionRevue() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: extraction, isLoading: extLoading } = useExtraction(id);
  const { data: prescriptions, isLoading: presLoading } = usePrescriptionsExtraction(id);
  const updatePrescription = useUpdatePrescription();
  const updateExtraction = useUpdateExtraction();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtreCategorie, setFiltreCategorie] = useState<Set<string>>(new Set());
  const [filtreGravite, setFiltreGravite] = useState<Set<string>>(new Set());
  const [onlyLowConf, setOnlyLowConf] = useState(false);
  const [editing, setEditing] = useState<Prescription | null>(null);
  const [validating, setValidating] = useState(false);

  const items = useMemo(() => {
    if (!prescriptions) return [];
    return prescriptions.filter((p) => {
      if (filtreCategorie.size > 0 && !filtreCategorie.has(p.categorie)) return false;
      if (filtreGravite.size > 0 && !filtreGravite.has(p.gravite)) return false;
      if (onlyLowConf && (p.confiance_extraction ?? 1) >= 0.7) return false;
      return true;
    });
  }, [prescriptions, filtreCategorie, filtreGravite, onlyLowConf]);

  const brouillons = useMemo(
    () => items.filter((p) => p.statut === 'brouillon'),
    [items],
  );

  const toValidate = useMemo(
    () => brouillons.filter((p) => selected.size === 0 || selected.has(p.id)),
    [brouillons, selected],
  );

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Pre-cocher : tous les brouillons par defaut
  useMemo(() => {
    if (selected.size === 0 && brouillons.length > 0) {
      setSelected(new Set(brouillons.map((p) => p.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brouillons.length]);

  const handleRejeter = async (p: Prescription) => {
    if (!confirm(`Rejeter cette prescription ?\n\n${p.intitule}`)) return;
    await updatePrescription.mutateAsync({ id: p.id, patch: { statut: 'rejete_extraction' } });
    setSelected((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
  };

  const handleToutRejeter = async () => {
    if (!confirm(`Rejeter toutes les ${brouillons.length} prescriptions detectees ?`)) return;
    await Promise.all(
      brouillons.map((p) => supabase.from('prescriptions_securite').update({ statut: 'rejete_extraction' }).eq('id', p.id)),
    );
    if (id) {
      await updateExtraction.mutateAsync({
        id,
        patch: { statut: 'partiellement_validee', nb_prescriptions_rejetees: brouillons.length, validee_le: new Date().toISOString() },
      });
    }
    qc.invalidateQueries({ queryKey: ['conformite'] });
  };

  const handleToutValider = async () => {
    if (toValidate.length === 0) return;
    if (!confirm(`Valider ${toValidate.length} prescription(s) ? Elles passeront au statut "A lever".`)) return;
    setValidating(true);
    try {
      await Promise.all(
        toValidate.map((p) =>
          supabase.from('prescriptions_securite').update({ statut: 'a_lever' }).eq('id', p.id),
        ),
      );

      const rejected = brouillons.filter((p) => !selected.has(p.id)).length;
      const allPrescriptions = prescriptions ?? [];
      const totalRejected = allPrescriptions.filter((p) => p.statut === 'rejete_extraction').length + rejected;

      if (id) {
        await updateExtraction.mutateAsync({
          id,
          patch: {
            statut: rejected > 0 ? 'partiellement_validee' : 'validee',
            nb_prescriptions_validees: toValidate.length,
            nb_prescriptions_rejetees: totalRejected,
            validee_le: new Date().toISOString(),
          },
        });
      }

      qc.invalidateQueries({ queryKey: ['conformite'] });
      navigate('/gmao/conformite/reserves');
    } finally {
      setValidating(false);
    }
  };

  if (extLoading || presLoading) {
    return <div className="p-8"><div className="bg-bg-card rounded-xl h-64 animate-pulse" /></div>;
  }

  if (!extraction) {
    return (
      <div className="p-8">
        <p className="text-dim">Extraction introuvable.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-nikito-cyan hover:underline">Retour</button>
      </div>
    );
  }

  const commission = extraction.commissions_securite;
  const duree = extraction.duree_traitement_ms ? Math.round(extraction.duree_traitement_ms / 100) / 10 : null;
  const nbDetected = prescriptions?.length ?? 0;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-[12px] text-dim hover:text-text mb-3 inline-flex items-center gap-1">
          &larr; Retour
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-cyan-400">
                <RobotIcon className="w-4 h-4 text-white" />
              </span>
              Extraction du PV {extraction.pv_filename ?? ''}
            </h1>
            <p className="text-[12px] text-dim mt-1">
              {commission?.parcs?.code} - {commission?.date_visite ? new Date(commission.date_visite + 'T00:00:00').toLocaleDateString('fr-FR') : ''} - {commission?.type_commission}
            </p>
            <p className="text-[12px] text-nikito-cyan mt-1">
              {nbDetected} prescription{nbDetected > 1 ? 's' : ''} detectee{nbDetected > 1 ? 's' : ''}{duree ? ` en ${duree}s` : ''}
              {extraction.cout_estime ? ` - cout estime ${extraction.cout_estime.toFixed(3)} EUR` : ''}
            </p>
          </div>
          <StatutBadge statut={extraction.statut} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={handleToutValider}
          disabled={toValidate.length === 0 || validating}
          className="bg-gradient-to-br from-pink-500 to-cyan-400 text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {validating ? 'Validation...' : `Tout valider (${toValidate.length})`}
        </button>
        <button
          onClick={handleToutRejeter}
          disabled={brouillons.length === 0}
          className="border border-red/40 text-red hover:bg-red/10 px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-40"
        >
          Tout rejeter
        </button>
        <button
          onClick={() => navigate('/gmao/conformite/commissions')}
          className="border border-white/[0.08] text-dim hover:text-text px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]"
        >
          Annuler
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-5 text-[11px]">
        <FilterDropdown label="Categories" options={[...CATEGORIES]} selected={filtreCategorie} onChange={setFiltreCategorie} />
        <FilterDropdown label="Gravites" options={[...GRAVITES]} selected={filtreGravite} onChange={setFiltreGravite} />
        <label className="flex items-center gap-2 text-dim cursor-pointer min-h-[36px] px-3 bg-bg-deep border border-white/[0.08] rounded-lg">
          <input type="checkbox" checked={onlyLowConf} onChange={(e) => setOnlyLowConf(e.target.checked)} />
          Uniquement faible confiance (&lt; 70%)
        </label>
      </div>

      {/* Liste */}
      {items.length === 0 ? (
        <div className="bg-bg-card rounded-xl p-8 text-center border border-white/[0.06]">
          <p className="text-dim text-sm">
            {prescriptions && prescriptions.length === 0
              ? 'Aucune prescription detectee par Claude dans ce PV.'
              : 'Aucune prescription ne correspond aux filtres.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <ExtractionCard
              key={p.id}
              item={p}
              checked={selected.has(p.id)}
              onToggle={() => toggleSel(p.id)}
              onEdit={() => setEditing(p)}
              onReject={() => handleRejeter(p)}
            />
          ))}
        </div>
      )}

      {editing && <ModaleEditPrescription prescription={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    en_cours: { label: 'Extraction en cours', color: 'bg-nikito-cyan/15 text-nikito-cyan' },
    reussie: { label: 'A valider', color: 'bg-amber/15 text-amber' },
    echec: { label: 'Echec', color: 'bg-red/15 text-red' },
    validee: { label: 'Validee', color: 'bg-green/15 text-green' },
    partiellement_validee: { label: 'Partiellement validee', color: 'bg-amber/15 text-amber' },
  };
  const c = cfg[statut] ?? { label: statut, color: 'bg-white/[0.06] text-dim' };
  return <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full', c.color)}>{c.label}</span>;
}

function ExtractionCard({
  item,
  checked,
  onToggle,
  onEdit,
  onReject,
}: {
  item: Prescription;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onReject: () => void;
}) {
  const confiance = item.confiance_extraction ?? null;
  const conf = confiance != null ? Math.round(confiance * 100) : null;
  const confColor = conf == null ? 'text-dim' : conf >= 80 ? 'text-green' : conf >= 60 ? 'text-amber' : 'text-red';
  const isRejected = item.statut === 'rejete_extraction';
  const isValidated = item.statut !== 'brouillon' && !isRejected;

  return (
    <div
      className={cn(
        'bg-bg-card rounded-xl p-4 border transition-all',
        isRejected ? 'border-red/20 opacity-40' : isValidated ? 'border-green/30' : 'border-white/[0.06] hover:border-white/[0.12]',
      )}
    >
      <div className="flex items-start gap-3">
        {!isRejected && !isValidated && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 w-4 h-4 rounded"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {conf != null && (
              <span className={cn('text-[11px] font-semibold inline-flex items-center gap-1', confColor)}>
                {conf < 60 && <span>!</span>}
                {conf}%
              </span>
            )}
            <span className="text-[10px] font-medium bg-nikito-cyan/10 text-nikito-cyan px-2 py-0.5 rounded">
              {item.categorie}
            </span>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', GRAVITE_COLORS[item.gravite] ?? 'bg-white/[0.06] text-dim')}>
              {item.gravite}
            </span>
            {item.delai_levee && (
              <span className="text-[10px] text-dim">
                delai : {new Date(item.delai_levee + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {isRejected && <span className="text-[10px] font-semibold text-red">REJETE</span>}
            {isValidated && <span className="text-[10px] font-semibold text-green">{item.statut.toUpperCase()}</span>}
          </div>
          <h3 className="text-[14px] font-semibold leading-snug mb-1">{item.intitule}</h3>
          {item.description && <p className="text-[12px] text-dim leading-relaxed mb-2">{item.description}</p>}
          {item.reglement_applicable && (
            <p className="text-[11px] italic text-faint">{item.reglement_applicable}</p>
          )}
        </div>
        {!isRejected && !isValidated && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={onEdit}
              className="text-[11px] text-dim hover:text-text border border-white/[0.08] px-3 py-1.5 rounded-lg transition-colors min-h-[36px]"
            >
              Modifier
            </button>
            <button
              onClick={onReject}
              className="text-[11px] text-red/80 hover:text-red border border-red/20 hover:bg-red/10 px-3 py-1.5 rounded-lg transition-colors min-h-[36px]"
            >
              Rejeter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterDropdown({ label, options, selected, onChange }: { label: string; options: string[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[36px] hover:border-white/[0.15]"
      >
        {label} {selected.size > 0 && `(${selected.size})`}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 bg-bg-card border border-white/[0.08] rounded-lg shadow-xl min-w-[180px] p-2">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 py-1.5 px-2 hover:bg-white/[0.04] rounded cursor-pointer text-[12px]">
                <input
                  type="checkbox"
                  checked={selected.has(o)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(o);
                    else next.delete(o);
                    onChange(next);
                  }}
                />
                {o}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModaleEditPrescription({ prescription, onClose }: { prescription: Prescription; onClose: () => void }) {
  const update = useUpdatePrescription();
  const [form, setForm] = useState({
    intitule: prescription.intitule,
    description: prescription.description ?? '',
    categorie: prescription.categorie,
    gravite: prescription.gravite,
    reglement_applicable: prescription.reglement_applicable ?? '',
    delai_levee: prescription.delai_levee ?? '',
    responsable_id: prescription.responsable_id ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await update.mutateAsync({
      id: prescription.id,
      patch: {
        intitule: form.intitule,
        description: form.description || null,
        categorie: form.categorie,
        gravite: form.gravite,
        reglement_applicable: form.reglement_applicable || null,
        delai_levee: form.delai_levee || null,
        responsable_id: form.responsable_id || null,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold mb-4">Modifier la prescription</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] text-dim mb-1">Intitule *</label>
            <input
              type="text"
              value={form.intitule}
              onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))}
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-[11px] text-dim mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field min-h-[80px] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-dim mb-1">Categorie</label>
              <select
                value={form.categorie}
                onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                className="input-field"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-dim mb-1">Gravite</label>
              <select
                value={form.gravite}
                onChange={(e) => setForm((f) => ({ ...f, gravite: e.target.value }))}
                className="input-field"
              >
                {GRAVITES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-dim mb-1">Reglement applicable</label>
            <input
              type="text"
              value={form.reglement_applicable}
              onChange={(e) => setForm((f) => ({ ...f, reglement_applicable: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-[11px] text-dim mb-1">Delai de levee</label>
            <input
              type="date"
              value={form.delai_levee}
              onChange={(e) => setForm((f) => ({ ...f, delai_levee: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
            <button type="submit" disabled={update.isPending} className="bg-gradient-cta text-bg-app px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-50">
              {update.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 2v4M8 2v2M16 2v2" />
      <circle cx="9" cy="14" r="1" />
      <circle cx="15" cy="14" r="1" />
      <path d="M9 18h6" />
    </svg>
  );
}
