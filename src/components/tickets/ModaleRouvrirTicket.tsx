import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouvrirTicket } from '@/hooks/queries/useTickets';

/** Réouverture d'un ticket résolu / fermé : le motif est obligatoire et reste dans l'historique du ticket. */
export function ModaleRouvrirTicket({
  incidentId,
  numeroBT,
  onClose,
}: {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const rouvrir = useRouvrirTicket();
  const [motif, setMotif] = useState('');
  const valide = motif.trim().length >= 5;

  const confirmer = () => {
    if (!valide) return;
    rouvrir.mutate(
      { incidentId, motif: motif.trim() },
      {
        onSuccess: () => {
          toast.success(`Ticket ${numeroBT} rouvert : il est de nouveau dans « À faire »`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[460px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-amber/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold mb-1">Rouvrir le ticket {numeroBT}</div>
        <div className="text-[12px] text-dim mb-3">
          Le ticket repart dans « À faire » (ou chez le technicien assigné). Les interventions déjà faites sont gardées, et le test
          de l’activité sera redemandé à la prochaine clôture.
        </div>
        <textarea
          autoFocus
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Motif (la panne est revenue, réparation incomplète, fermé par erreur…)"
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-amber/50"
        />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={!valide || rouvrir.isPending}
            className={cn('px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-amber text-bg-app', (!valide || rouvrir.isPending) && 'opacity-40')}
          >
            {rouvrir.isPending ? 'Réouverture…' : '↺ Rouvrir le ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
