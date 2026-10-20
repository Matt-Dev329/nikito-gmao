import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useCloturerTicketRapide } from '@/hooks/queries/useTickets';

/** Clôture rapide d'un ticket (rien à faire, déjà réglé…) : la justification est obligatoire. */
export function ModaleClotureRapide({
  incidentId,
  numeroBT,
  onClose,
}: {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const cloturer = useCloturerTicketRapide();
  const [justification, setJustification] = useState('');
  const valide = justification.trim().length >= 5;

  const confirmer = () => {
    if (!valide) return;
    cloturer.mutate(
      { incidentId, justification: justification.trim() },
      {
        onSuccess: () => {
          toast.success(`Ticket ${numeroBT} clôturé`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[460px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-green/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold mb-1">Clôturer le ticket {numeroBT}</div>
        <div className="text-[12px] text-dim mb-3">
          Le ticket passe en « résolu » sans intervention. La justification est obligatoire et reste visible dans le ticket et
          les rapports de réparation.
        </div>
        <textarea
          autoFocus
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={3}
          placeholder="Justification (déjà réparé, rien à faire, réglé par l'équipe du parc…)"
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-green/50"
        />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={!valide || cloturer.isPending}
            className={cn(
              'px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-green text-bg-app',
              (!valide || cloturer.isPending) && 'opacity-40'
            )}
          >
            {cloturer.isPending ? 'Clôture…' : 'Clôturer le ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
