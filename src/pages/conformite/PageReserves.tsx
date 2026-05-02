import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePrescriptions, useUpdatePrescriptionStatut, type Prescription } from '@/hooks/queries/useConformite';
import { useAuth } from '@/hooks/useAuth';

const COLONNES = [
  { statut: 'a_lever', label: 'A lever', color: 'border-red' },
  { statut: 'en_cours', label: 'En cours', color: 'border-amber' },
  { statut: 'levee_proposee', label: 'Levee proposee', color: 'border-nikito-cyan' },
  { statut: 'levee_validee', label: 'Levee validee', color: 'border-green' },
] as const;

const CATEGORIES = ['SSI', 'desenfumage', 'evacuation', 'eclairage_secours', 'electrique', 'ascenseur', 'isolement_coupe_feu', 'accessibilite_pmr', 'capacite_accueil', 'autre'] as const;
const GRAVITES = ['bloquante', 'majeure', 'mineure'] as const;

export function PageReserves() {
  const { utilisateur } = useAuth();
  const navigate = useNavigate();
  const { data: prescriptions, isLoading } = usePrescriptions({
    statut: ['brouillon', 'a_lever', 'en_cours', 'levee_proposee', 'levee_validee'],
  });
  const updateStatut = useUpdatePrescriptionStatut();

  const [filtreParc, setFiltreParc] = useState<string>('');
  const [filtreCategorie, setFiltreCategorie] = useState<string>('');
  const [filtreGravite, setFiltreGravite] = useState<string>('');
  const [mesSeulement, setMesSeulement] = useState(false);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [showModaleJustif, setShowModaleJustif] = useState<Prescription | null>(null);

  const parcsUniques = useMemo(() => {
    if (!prescriptions) return [];
    const map = new Map<string, string>();
    prescriptions.forEach((p) => {
      if (p.parcs) map.set(p.parc_id, `${p.parcs.code} - ${p.parcs.nom}`);
    });
    return Array.from(map.entries());
  }, [prescriptions]);

  const filtered = useMemo(() => {
    if (!prescriptions) return [];
    return prescriptions.filter((p) => {
      if (filtreParc && p.parc_id !== filtreParc) return false;
      if (filtreCategorie && p.categorie !== filtreCategorie) return false;
      if (filtreGravite && p.gravite !== filtreGravite) return false;
      if (mesSeulement && p.responsable_id !== utilisateur?.id) return false;
      return true;
    });
  }, [prescriptions, filtreParc, filtreCategorie, filtreGravite, mesSeulement, utilisateur?.id]);

  const handleDragStart = useCallback((id: string) => {
    setDragItem(id);
  }, []);

  const handleDrop = useCallback((targetStatut: string) => {
    if (!dragItem) return;
    const item = prescriptions?.find((p) => p.id === dragItem);
    if (!item || item.statut === targetStatut) { setDragItem(null); return; }

    if (targetStatut === 'levee_proposee' && item.statut === 'en_cours') {
      setShowModaleJustif(item);
      setDragItem(null);
      return;
    }

    if (targetStatut === 'levee_validee') {
      const role = utilisateur?.role_code;
      if (role !== 'direction' && role !== 'chef_maintenance' && role !== 'admin_it') {
        setDragItem(null);
        return;
      }
      updateStatut.mutate({ id: dragItem, statut: targetStatut, extras: { date_levee_effective: new Date().toISOString().slice(0, 10) } });
    } else {
      updateStatut.mutate({ id: dragItem, statut: targetStatut });
    }
    setDragItem(null);
  }, [dragItem, prescriptions, utilisateur?.role_code, updateStatut]);

  const handleJustifSubmit = useCallback((notes: string) => {
    if (!showModaleJustif) return;
    updateStatut.mutate({
      id: showModaleJustif.id,
      statut: 'levee_proposee',
      extras: { preuve_levee_notes: notes },
    });
    setShowModaleJustif(null);
  }, [showModaleJustif, updateStatut]);

  return (
    <div className="p-4 md:p-6 lg:p-8 h-full flex flex-col">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold">Reserves et prescriptions</h1>
      </header>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={filtreParc}
          onChange={(e) => setFiltreParc(e.target.value)}
          className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[40px]"
        >
          <option value="">Tous les parcs</option>
          {parcsUniques.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select
          value={filtreCategorie}
          onChange={(e) => setFiltreCategorie(e.target.value)}
          className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[40px]"
        >
          <option value="">Toutes categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filtreGravite}
          onChange={(e) => setFiltreGravite(e.target.value)}
          className="bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-text min-h-[40px]"
        >
          <option value="">Toutes gravites</option>
          {GRAVITES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <label className="flex items-center gap-2 text-[12px] text-dim cursor-pointer min-h-[40px] px-3 bg-bg-deep border border-white/[0.08] rounded-lg">
          <input
            type="checkbox"
            checked={mesSeulement}
            onChange={(e) => setMesSeulement(e.target.checked)}
            className="rounded"
          />
          Mes prescriptions
        </label>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex-1 grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-bg-card rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 min-h-0 overflow-x-auto">
          {/* Colonne Extraits IA */}
          <div className="flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-dashed border-pink-400/60">
              <RobotSmallIcon className="w-4 h-4 text-pink-400" />
              <span className="text-[12px] font-semibold uppercase tracking-wide bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Extraits IA
              </span>
              <span className="text-[11px] text-dim bg-white/[0.06] px-1.5 py-0.5 rounded">
                {filtered.filter((p) => p.statut === 'brouillon').length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {filtered.filter((p) => p.statut === 'brouillon').map((item) => (
                <BrouillonCard
                  key={item.id}
                  item={item}
                  onClick={() => item.extraction_id && navigate(`/gmao/conformite/extractions/${item.extraction_id}`)}
                />
              ))}
              {filtered.filter((p) => p.statut === 'brouillon').length === 0 && (
                <div className="text-[11px] text-faint text-center py-8">Aucun brouillon</div>
              )}
            </div>
          </div>

          {COLONNES.map((col) => {
            const items = filtered.filter((p) => p.statut === col.statut);
            return (
              <div
                key={col.statut}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.statut)}
                className="flex flex-col min-h-[300px]"
              >
                <div className={cn('flex items-center gap-2 mb-3 pb-2 border-b-2', col.color)}>
                  <span className="text-[13px] font-semibold">{col.label}</span>
                  <span className="text-[11px] text-dim bg-white/[0.06] px-1.5 py-0.5 rounded">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <PrescriptionCard
                      key={item.id}
                      item={item}
                      onDragStart={() => handleDragStart(item.id)}
                      isDragging={dragItem === item.id}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="text-[11px] text-faint text-center py-8">Aucune</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale justification */}
      {showModaleJustif && (
        <ModaleJustification
          prescription={showModaleJustif}
          onClose={() => setShowModaleJustif(null)}
          onSubmit={handleJustifSubmit}
        />
      )}
    </div>
  );
}

function PrescriptionCard({ item, onDragStart, isDragging }: { item: Prescription; onDragStart: () => void; isDragging: boolean }) {
  const graviteColor = item.gravite === 'bloquante' ? 'border-l-red' : item.gravite === 'majeure' ? 'border-l-amber' : 'border-l-yellow-400';
  const isRetard = item.delai_levee && item.delai_levee < new Date().toISOString().slice(0, 10) && ['a_lever', 'en_cours'].includes(item.statut);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        'bg-bg-deep rounded-lg p-3 border-l-[3px] cursor-grab active:cursor-grabbing transition-all',
        graviteColor,
        isDragging ? 'opacity-50 scale-95' : 'hover:bg-bg-deep/80'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-dim">{item.numero_prescription ?? '—'}</span>
        <GraviteBadge gravite={item.gravite} />
      </div>
      <p className="text-[12px] font-medium leading-snug mb-1.5 line-clamp-2">{item.intitule}</p>
      <p className="text-[10px] text-dim mb-2">{item.categorie}</p>
      <div className="flex items-center justify-between">
        {item.parcs && (
          <span className="text-[9px] font-bold font-mono bg-nikito-cyan/10 text-nikito-cyan px-1.5 py-0.5 rounded">
            {item.parcs.code}
          </span>
        )}
        {item.delai_levee && (
          <span className={cn('text-[10px]', isRetard ? 'text-red font-semibold' : 'text-dim')}>
            {formatDate(item.delai_levee)}
          </span>
        )}
      </div>
      {item.responsable && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
          <div className="w-5 h-5 rounded-full bg-nikito-cyan/20 text-nikito-cyan flex items-center justify-center text-[8px] font-bold">
            {item.responsable.prenom?.[0]}{item.responsable.nom?.[0]}
          </div>
          <span className="text-[10px] text-dim">{item.responsable.prenom}</span>
        </div>
      )}
    </div>
  );
}

function BrouillonCard({ item, onClick }: { item: Prescription; onClick: () => void }) {
  const confiance = item.confiance_extraction ?? null;
  const conf = confiance != null ? Math.round(confiance * 100) : null;
  const confColor = conf == null ? 'text-dim' : conf >= 80 ? 'text-green' : conf >= 60 ? 'text-amber' : 'text-red';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-deep rounded-lg p-3 border border-dashed border-pink-400/30 hover:border-pink-400/60 hover:bg-bg-deep/80 transition-all"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-pink-400">
          <RobotSmallIcon className="w-3 h-3" />
          IA
        </span>
        {conf != null && (
          <span className={cn('text-[10px] font-semibold', confColor)}>{conf}%</span>
        )}
      </div>
      <p className="text-[12px] font-medium leading-snug mb-1.5 line-clamp-2">{item.intitule}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-dim">{item.categorie}</span>
        <GraviteBadge gravite={item.gravite} />
      </div>
      {item.parcs && (
        <div className="mt-2 pt-2 border-t border-white/[0.04]">
          <span className="text-[9px] font-bold font-mono bg-nikito-cyan/10 text-nikito-cyan px-1.5 py-0.5 rounded">
            {item.parcs.code}
          </span>
        </div>
      )}
    </button>
  );
}

function RobotSmallIcon({ className }: { className?: string }) {
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

function GraviteBadge({ gravite }: { gravite: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    bloquante: { bg: 'bg-red/15', text: 'text-red' },
    majeure: { bg: 'bg-amber/15', text: 'text-amber' },
    mineure: { bg: 'bg-yellow-400/15', text: 'text-yellow-400' },
  };
  const c = config[gravite] ?? config.mineure;
  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', c.bg, c.text)}>
      {gravite}
    </span>
  );
}

function ModaleJustification({ prescription, onClose, onSubmit }: { prescription: Prescription; onClose: () => void; onSubmit: (notes: string) => void }) {
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold mb-1">Justifier la levee</h3>
        <p className="text-[12px] text-dim mb-4">{prescription.intitule}</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Description de la levee, travaux realises..."
          className="w-full bg-bg-deep border border-white/[0.08] rounded-lg px-3 py-2.5 text-[13px] text-text min-h-[100px] resize-none mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text transition-colors min-h-[44px]">
            Annuler
          </button>
          <button
            onClick={() => onSubmit(notes)}
            disabled={!notes.trim()}
            className="bg-gradient-cta text-bg-app px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
