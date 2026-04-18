import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useEvaluerResultat,
  useHistoriqueDecisions,
  type HypotheseIA,
} from '@/hooks/queries/useNotificationsIA';

interface Props {
  hypothese: HypotheseIA;
  onClose: () => void;
}

export function ModaleEvaluerResultat({ hypothese, onClose }: Props) {
  const [commentaire, setCommentaire] = useState('');
  const { mutate: evaluer, isPending } = useEvaluerResultat();
  const { data: historique } = useHistoriqueDecisions(hypothese.id);

  const handleEvaluer = (resultat: 'bon_choix' | 'mauvais_choix') => {
    evaluer(
      { id: hypothese.id, resultat, commentaire: commentaire.trim() || undefined },
      { onSuccess: onClose }
    );
  };

  const actionLabels: Record<string, { label: string; color: string }> = {
    validee: { label: 'Validee', color: 'text-green' },
    rejetee: { label: 'Rejetee', color: 'text-red' },
    resultat_bon: { label: 'Bon choix', color: 'text-green' },
    resultat_mauvais: { label: 'Mauvais choix', color: 'text-red' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl p-5 md:p-6 max-w-[520px] w-full border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[10px] text-dim uppercase tracking-wider mb-1">
              Evaluer le resultat de votre decision
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

        <div className="bg-bg-deep rounded-xl p-3.5 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <span className={cn(
              'text-[11px] font-medium px-2 py-0.5 rounded',
              hypothese.statut === 'validee' ? 'text-green bg-green/10' : 'text-red bg-red/10'
            )}>
              Decision: {hypothese.statut === 'validee' ? 'Validee' : 'Rejetee'}
            </span>
            {hypothese.validee_le && (
              <span className="text-[11px] text-faint">
                le {new Date(hypothese.validee_le).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
          {hypothese.commentaire_validation && (
            <div className="text-[12px] text-text/80 mt-1">{hypothese.commentaire_validation}</div>
          )}
          {hypothese.description && (
            <div className="text-[12px] text-dim mt-2">{hypothese.description}</div>
          )}
        </div>

        <div className="mb-4">
          <div className="text-[12px] font-medium mb-2">
            Avec le recul, cette decision etait-elle la bonne ?
          </div>
          <div className="text-[11px] text-dim mb-3">
            Cette evaluation permet d'ameliorer les futures recommandations de l'IA en tracant la qualite des decisions prises.
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">
            Retour d'experience (optionnel)
          </label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Decrivez ce qui s'est passe depuis la decision, si l'hypothese s'est averee correcte..."
            rows={3}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-none"
          />
        </div>

        {historique && historique.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] text-dim uppercase tracking-wider mb-2">Historique</div>
            <div className="space-y-1.5">
              {historique.map((h) => {
                const a = actionLabels[h.action] ?? { label: h.action, color: 'text-dim' };
                return (
                  <div key={h.id} className="flex items-center gap-2 text-[11px]">
                    <span className="text-faint w-[70px] flex-shrink-0">
                      {new Date(h.cree_le).toLocaleDateString('fr-FR')}
                    </span>
                    <span className={cn('font-medium', a.color)}>{a.label}</span>
                    <span className="text-dim truncate">
                      {h.utilisateur_nom}
                      {h.commentaire && ` - ${h.commentaire}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Plus tard
          </button>
          <button
            onClick={() => handleEvaluer('mauvais_choix')}
            disabled={isPending}
            className={cn(
              'border border-red/30 text-red px-5 py-2.5 rounded-[10px] text-[13px] font-semibold min-h-[44px] hover:bg-red/10 transition-colors flex items-center justify-center gap-2',
              isPending && 'opacity-40 cursor-not-allowed'
            )}
          >
            <XCircleIcon className="w-4 h-4" />
            Mauvaise decision
          </button>
          <button
            onClick={() => handleEvaluer('bon_choix')}
            disabled={isPending}
            className={cn(
              'bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px] flex items-center justify-center gap-2',
              isPending && 'opacity-40 cursor-not-allowed'
            )}
          >
            <CheckCircleIcon className="w-4 h-4" />
            Bonne decision
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5.5 8.5l2 2 3.5-4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6 6l4 4M10 6l-4 4" />
    </svg>
  );
}
