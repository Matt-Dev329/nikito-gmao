import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePhasesParc, useCommissions, usePrescriptions, useDocumentsChantier, useActeursChantier, useCreatePhase } from '@/hooks/queries/useConformite';
import { PhaseBadge, PHASES_ORDERED } from './PhaseBadge';
import { useAuth } from '@/hooks/useAuth';

export function OngletConformiteParc({ parcId }: { parcId: string | undefined }) {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { data: phases } = usePhasesParc(parcId);
  const { data: commissions } = useCommissions(parcId);
  const { data: prescriptions } = usePrescriptions({ parcId });
  const { data: documents } = useDocumentsChantier(parcId);
  const { data: acteurs } = useActeursChantier(parcId);
  const [showPhaseModale, setShowPhaseModale] = useState(false);

  const canChangePhase = ['direction', 'admin_it', 'chef_maintenance'].includes(utilisateur?.role_code ?? '');
  const phaseActuelle = phases?.find((p) => !p.date_fin);
  const reservesActives = prescriptions?.filter((p) => ['a_lever', 'en_cours', 'levee_proposee'].includes(p.statut)) ?? [];
  const docsObligatoires = documents?.filter((d) => d.est_obligatoire_ouverture) ?? [];

  if (!parcId) return null;

  return (
    <div className="p-4 md:p-6 md:px-7 space-y-6">
      {/* Bloc 1: Timeline des phases */}
      <section className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold">Phases du parc</h3>
          {canChangePhase && (
            <button
              onClick={() => setShowPhaseModale(true)}
              className="text-[11px] text-nikito-cyan hover:underline min-h-[44px] flex items-center"
            >
              Changer de phase
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PHASES_ORDERED.map((phase) => {
            const entry = phases?.find((p) => p.phase === phase);
            const isCurrent = phaseActuelle?.phase === phase;
            return (
              <div
                key={phase}
                className={cn(
                  'rounded-lg px-2 py-1.5 text-[10px] border transition-all',
                  isCurrent
                    ? 'border-nikito-cyan/40 bg-nikito-cyan/10 ring-1 ring-nikito-cyan/30'
                    : entry
                      ? 'border-white/[0.08] bg-bg-deep'
                      : 'border-white/[0.04] bg-bg-deep/30 opacity-40'
                )}
              >
                <PhaseBadge phase={phase} size="sm" />
                {entry && (
                  <div className="text-[9px] text-dim mt-0.5">
                    {new Date(entry.date_debut).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bloc 2: Commissions liees */}
      <section className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold">Commissions recentes</h3>
          <button
            onClick={() => navigate('/gmao/conformite/commissions')}
            className="text-[11px] text-nikito-cyan hover:underline min-h-[44px] flex items-center"
          >
            Voir toutes
          </button>
        </div>
        {!commissions || commissions.length === 0 ? (
          <p className="text-[12px] text-dim">Aucune commission</p>
        ) : (
          <div className="space-y-2">
            {commissions.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-bg-deep rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium">{formatDate(c.date_visite)}</span>
                  <span className="text-[10px] text-dim">{c.type_commission}</span>
                </div>
                {c.resultat && (
                  <ResultatBadge resultat={c.resultat} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bloc 3: Reserves actives */}
      <section className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold">Reserves actives ({reservesActives.length})</h3>
          <button
            onClick={() => navigate('/gmao/conformite/reserves')}
            className="text-[11px] text-nikito-cyan hover:underline min-h-[44px] flex items-center"
          >
            Voir tout
          </button>
        </div>
        {reservesActives.length === 0 ? (
          <p className="text-[12px] text-dim">Aucune reserve active</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <MiniCol label="A lever" count={reservesActives.filter((p) => p.statut === 'a_lever').length} color="text-red" />
            <MiniCol label="En cours" count={reservesActives.filter((p) => p.statut === 'en_cours').length} color="text-amber" />
            <MiniCol label="Levee proposee" count={reservesActives.filter((p) => p.statut === 'levee_proposee').length} color="text-nikito-cyan" />
          </div>
        )}
      </section>

      {/* Bloc 4: Documents cles */}
      <section className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold">Documents cles</h3>
          <button
            onClick={() => navigate('/gmao/conformite/documents')}
            className="text-[11px] text-nikito-cyan hover:underline min-h-[44px] flex items-center"
          >
            Voir tout
          </button>
        </div>
        {docsObligatoires.length === 0 ? (
          <p className="text-[12px] text-dim">Aucun document obligatoire</p>
        ) : (
          <div className="space-y-1.5">
            {docsObligatoires.map((d) => (
              <div key={d.id} className="flex items-center gap-2 bg-bg-deep rounded-lg px-3 py-2">
                <span className="text-[12px]">{d.intitule}</span>
                <span className="text-[10px] text-dim ml-auto">{d.categorie}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bloc 5: Acteurs externes */}
      <section className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold">Acteurs externes</h3>
          <button
            onClick={() => navigate('/gmao/conformite/acteurs')}
            className="text-[11px] text-nikito-cyan hover:underline min-h-[44px] flex items-center"
          >
            Voir tout
          </button>
        </div>
        {!acteurs || acteurs.length === 0 ? (
          <p className="text-[12px] text-dim">Aucun acteur</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {acteurs.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center gap-2 bg-bg-deep rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-nikito-cyan/10 text-nikito-cyan flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {a.nom_societe.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate">{a.nom_societe}</div>
                  <div className="text-[10px] text-dim">{a.type_acteur}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showPhaseModale && (
        <ModaleChangerPhase parcId={parcId} onClose={() => setShowPhaseModale(false)} />
      )}
    </div>
  );
}

function MiniCol({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-bg-deep rounded-lg p-2 text-center">
      <div className={cn('text-lg font-bold', color)}>{count}</div>
      <div className="text-[9px] text-dim">{label}</div>
    </div>
  );
}

function ResultatBadge({ resultat }: { resultat: string }) {
  const config: Record<string, { label: string; color: string }> = {
    favorable: { label: 'Favorable', color: 'text-green' },
    favorable_avec_reserves: { label: 'Avec reserves', color: 'text-amber' },
    defavorable: { label: 'Defavorable', color: 'text-red' },
    differe: { label: 'Differe', color: 'text-dim' },
    en_attente_pv: { label: 'Attente PV', color: 'text-nikito-cyan' },
  };
  const c = config[resultat] ?? { label: resultat, color: 'text-dim' };
  return <span className={cn('text-[10px] font-medium', c.color)}>{c.label}</span>;
}

function ModaleChangerPhase({ parcId, onClose }: { parcId: string; onClose: () => void }) {
  const createPhase = useCreatePhase();
  const [phase, setPhase] = useState('');
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phase) return;
    createPhase.mutate(
      { parc_id: parcId, phase, date_debut: dateDebut, notes: notes || undefined },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-semibold mb-4">Changer de phase</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] text-dim mb-1">Nouvelle phase *</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value)} required className="input-field">
              <option value="">Selectionner</option>
              {PHASES_ORDERED.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-dim mb-1">Date debut *</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required className="input-field" />
          </div>
          <div>
            <label className="block text-[11px] text-dim mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[60px] resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
            <button type="submit" disabled={createPhase.isPending} className="bg-gradient-cta text-bg-app px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] disabled:opacity-50">
              {createPhase.isPending ? 'Changement...' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
