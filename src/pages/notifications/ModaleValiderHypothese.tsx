import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useValiderHypothese, type HypotheseIA } from '@/hooks/queries/useNotificationsIA';

interface Props {
  hypothese: HypotheseIA;
  onClose: () => void;
}

const typeLabels: Record<string, string> = {
  equipement_risque: 'Equipement a risque',
  alerte: 'Alerte',
  recommandation: 'Recommandation',
};

const prioriteConfig: Record<string, { label: string; color: string; bg: string }> = {
  haute: { label: 'HAUTE', color: 'text-red', bg: 'bg-red/10' },
  moyenne: { label: 'MOYENNE', color: 'text-amber', bg: 'bg-amber/10' },
  basse: { label: 'BASSE', color: 'text-nikito-cyan', bg: 'bg-nikito-cyan/10' },
};

export function ModaleValiderHypothese({ hypothese, onClose }: Props) {
  const [commentaire, setCommentaire] = useState('');
  const { mutate: valider, isPending } = useValiderHypothese();

  const handleAction = (statut: 'validee' | 'rejetee') => {
    valider(
      { id: hypothese.id, statut, commentaire: commentaire.trim() || undefined },
      { onSuccess: onClose }
    );
  };

  const p = prioriteConfig[hypothese.priorite] ?? prioriteConfig.moyenne;
  const donnees = hypothese.donnees as Record<string, unknown>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl p-5 md:p-6 max-w-[520px] w-full border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', p.color, p.bg)}>
                {p.label}
              </span>
              <span className="text-[10px] text-dim uppercase tracking-wider">
                {typeLabels[hypothese.type] ?? hypothese.type}
              </span>
            </div>
            <div className="text-[16px] font-semibold leading-tight">{hypothese.titre}</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex-shrink-0"
          >
            x
          </button>
        </div>

        {hypothese.description && (
          <div className="bg-bg-deep rounded-xl p-3.5 mb-3.5">
            <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">Description</div>
            <div className="text-[13px] text-text/90 leading-relaxed">{hypothese.description}</div>
          </div>
        )}

        {hypothese.type === 'equipement_risque' && (
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            {!!donnees.equipement_code && (
              <InfoBox label="Equipement" value={`${String(donnees.equipement_code)} - ${String(donnees.equipement_libelle ?? '')}`} />
            )}
            {!!donnees.parc && <InfoBox label="Parc" value={String(donnees.parc)} />}
            {donnees.score_risque != null && (
              <InfoBox label="Score de risque" value={`${String(donnees.score_risque)}%`} highlight />
            )}
            {!!donnees.date_panne_estimee && (
              <InfoBox label="Panne estimee" value={formatDate(String(donnees.date_panne_estimee))} />
            )}
            {!!donnees.action_recommandee && (
              <div className="col-span-2">
                <InfoBox label="Action recommandee" value={String(donnees.action_recommandee)} />
              </div>
            )}
          </div>
        )}

        {hypothese.type === 'recommandation' && (
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            {!!donnees.impact_estime && <InfoBox label="Impact estime" value={String(donnees.impact_estime)} />}
            {!!donnees.cout_estime && <InfoBox label="Cout estime" value={String(donnees.cout_estime)} />}
            {!!donnees.deadline_suggeree && (
              <InfoBox label="Deadline suggeree" value={formatDate(String(donnees.deadline_suggeree))} />
            )}
          </div>
        )}

        {hypothese.rapport && (
          <div className="bg-bg-deep rounded-xl p-3 mb-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nikito-cyan/10 flex items-center justify-center text-nikito-cyan text-[11px] font-bold flex-shrink-0">
              S{hypothese.rapport.semaine_iso?.split('-W')[1]}
            </div>
            <div>
              <div className="text-[12px] font-medium">Rapport semaine {hypothese.rapport.semaine_iso}</div>
              <div className="text-[11px] text-dim">
                Score {hypothese.rapport.score_sante}/100 - {hypothese.rapport.tendance}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">
            Commentaire (optionnel)
          </label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Justification de votre decision..."
            rows={3}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-none"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={() => handleAction('rejetee')}
            disabled={isPending}
            className={cn(
              'border border-red/30 text-red px-5 py-2.5 rounded-[10px] text-[13px] font-semibold min-h-[44px] hover:bg-red/10 transition-colors',
              isPending && 'opacity-40 cursor-not-allowed'
            )}
          >
            {isPending ? '...' : 'Rejeter'}
          </button>
          <button
            onClick={() => handleAction('validee')}
            disabled={isPending}
            className={cn(
              'bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px] flex items-center justify-center gap-2',
              isPending && 'opacity-40 cursor-not-allowed'
            )}
          >
            <CheckIcon className="w-4 h-4" />
            {isPending ? 'Validation...' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-bg-deep rounded-lg p-2.5">
      <div className="text-[10px] text-dim uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('text-[13px]', highlight ? 'text-amber font-semibold' : 'text-text/90')}>
        {value}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5 6.5-7" />
    </svg>
  );
}
