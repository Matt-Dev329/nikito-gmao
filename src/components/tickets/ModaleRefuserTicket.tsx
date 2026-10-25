import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useRefuserTicket } from '@/hooks/queries/useTickets';

/** Refus d'un ticket à valider : la justification est envoyée en notification à la personne qui l'a signalé. */
export function ModaleRefuserTicket({
  incidentId,
  numeroBT,
  onClose,
  onRefuse,
}: {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
  onRefuse?: () => void;
}) {
  const toast = useToast();
  const refuser = useRefuserTicket();
  const [motif, setMotif] = useState('');
  const valide = motif.trim().length >= 5;

  const confirmer = () => {
    if (!valide) return;
    refuser.mutate(
      { incidentId, motif: motif.trim() },
      {
        onSuccess: () => {
          toast.success(`Ticket ${numeroBT} refusé : la personne qui l’a signalé est prévenue`);
          onClose();
          onRefuse?.();
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[460px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-red/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold mb-1">Refuser le ticket {numeroBT}</div>
        <div className="text-[12px] text-dim mb-3">
          La justification est obligatoire : la personne qui a signalé le ticket la reçoit en notification.
        </div>
        <textarea
          autoFocus
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          placeholder="Justification (ex. doublon du ticket BT-…, pas une panne, déjà réparé…)"
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-red/50"
        />
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={!valide || refuser.isPending}
            className={cn(
              'px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-red text-text',
              (!valide || refuser.isPending) && 'opacity-40'
            )}
          >
            {refuser.isPending ? 'Envoi…' : 'Refuser le ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
