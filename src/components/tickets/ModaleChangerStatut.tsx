import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useChangerStatutTicket, type StatutTicketManuel } from '@/hooks/queries/useTickets';
import { ChoixTestActivite } from '@/components/tickets/ChoixTestActivite';

const STATUTS: { code: StatutTicketManuel; label: string }[] = [
  { code: 'ouvert', label: 'À faire' },
  { code: 'assigne', label: 'Assigné' },
  { code: 'en_cours', label: 'En cours' },
  { code: 'en_pause', label: 'En pause' },
  { code: 'attente_piece', label: 'Attente de pièce' },
  { code: 'resolu', label: 'Résolu' },
  { code: 'ferme', label: 'Fermé' },
];

const LIBELLES_STATUT: Record<string, string> = {
  ...Object.fromEntries(STATUTS.map((s) => [s.code, s.label])),
  exterieur: 'Intervenant extérieur',
  annule: 'Supprimé',
};

/**
 * Changement manuel du statut d'un ticket (chef d'équipe). Le motif est
 * facultatif (pièce attendue pour « Attente de pièce ») ; le test de
 * l'activité est demandé pour passer un ticket ouvert en résolu / fermé.
 */
export function ModaleChangerStatut({
  incidentId,
  numeroBT,
  statutActuel,
  aUnTechnicien,
  onClose,
}: {
  incidentId: string;
  numeroBT: string;
  /** Statut affiché : statut du ticket, ou « attente_piece » / « exterieur » */
  statutActuel: string;
  aUnTechnicien: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const changer = useChangerStatutTicket();
  const [statut, setStatut] = useState<StatutTicketManuel | null>(null);
  const [motif, setMotif] = useState('');
  const [testActivite, setTestActivite] = useState<boolean | null>(null);

  const dejaClos = statutActuel === 'resolu' || statutActuel === 'ferme';
  const demandeTest = !!statut && (statut === 'resolu' || statut === 'ferme') && !dejaClos;
  const valide = !!statut && statut !== statutActuel && (!demandeTest || testActivite !== null);

  const confirmer = () => {
    if (!valide || !statut) return;
    changer.mutate(
      { incidentId, statut, motif: motif.trim(), testActivite: demandeTest ? testActivite : null },
      {
        onSuccess: () => {
          toast.success(`Ticket ${numeroBT} : statut « ${LIBELLES_STATUT[statut]} »`);
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[480px] max-h-[92vh] overflow-y-auto bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold mb-1">Changer le statut · {numeroBT}</div>
        <div className="text-[12px] text-dim mb-3">
          Statut actuel : <span className="text-text">{LIBELLES_STATUT[statutActuel] ?? statutActuel}</span>. Le changement est
          gardé dans l’historique du ticket et le technicien assigné est prévenu.
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {STATUTS.map((s) => {
            const actuel = s.code === statutActuel;
            const impossible = s.code === 'assigne' && !aUnTechnicien;
            return (
              <button
                key={s.code}
                type="button"
                disabled={actuel || impossible}
                onClick={() => setStatut(s.code)}
                title={impossible ? 'Aucun technicien assigné : réassigne d’abord le ticket' : undefined}
                className={cn(
                  'rounded-[10px] text-[13px] font-semibold min-h-[44px] px-3 border text-left',
                  statut === s.code
                    ? 'bg-nikito-cyan/15 border-nikito-cyan/60 text-nikito-cyan'
                    : 'bg-bg-deep border-white/[0.08] text-text',
                  (actuel || impossible) && 'opacity-40'
                )}
              >
                {s.label}
                {actuel && <span className="text-[11px] text-dim font-normal"> · actuel</span>}
              </button>
            );
          })}
        </div>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder={statut === 'attente_piece' ? 'Pièce attendue (ex. moteur, carte, câble…)' : 'Motif (facultatif)'}
          className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-[13px] text-text outline-none focus:border-nikito-cyan/50 mb-3"
        />
        {demandeTest && <ChoixTestActivite valeur={testActivite} onChange={setTestActivite} />}
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={onClose} className="px-4 rounded-[10px] text-[13px] min-h-[44px] bg-bg-deep border border-white/[0.08] text-dim">
            Annuler
          </button>
          <button
            onClick={confirmer}
            disabled={!valide || changer.isPending}
            className={cn('px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-gradient-cta text-text', (!valide || changer.isPending) && 'opacity-40')}
          >
            {changer.isPending ? 'Changement…' : 'Changer le statut'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Historique des changements de statut faits à la main (incidents.meta.changements_statut) */
export function HistoriqueStatuts({
  changements,
}: {
  changements: { le: string; par_nom?: string; avant: string; apres: string; motif?: string | null }[];
}) {
  if (!changements.length) return null;
  return (
    <>
      {changements.map((c, i) => (
        <div key={i} className="text-[12px] text-dim">
          ⇄ {new Date(c.le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
          {c.par_nom ? ` · ${c.par_nom}` : ''} : {LIBELLES_STATUT[c.avant] ?? c.avant} →{' '}
          <span className="text-text">{LIBELLES_STATUT[c.apres] ?? c.apres}</span>
          {c.motif ? ` — ${c.motif}` : ''}
        </div>
      ))}
    </>
  );
}
