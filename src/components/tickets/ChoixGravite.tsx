import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CritTag } from '@/components/ui/CritTag';
import { useToast } from '@/components/ui/ToastProvider';
import { useChangerGraviteTicket } from '@/hooks/queries/useTickets';
import type { Criticite } from '@/types/database';

const GRAVITES: Criticite[] = ['bloquant', 'majeur', 'mineur'];

/**
 * Badge de gravité d'un ticket, cliquable pour la changer (bloquant / majeur /
 * mineur). Sans `modifiable`, simple badge.
 */
export function ChoixGravite({
  incidentId,
  numeroBT,
  niveau,
  modifiable,
}: {
  incidentId: string;
  numeroBT: string;
  niveau: Criticite;
  modifiable: boolean;
}) {
  const toast = useToast();
  const changer = useChangerGraviteTicket();
  const [ouvert, setOuvert] = useState(false);
  if (!modifiable) return <CritTag niveau={niveau} />;

  const choisir = (code: Criticite) => {
    setOuvert(false);
    if (code === niveau) return;
    changer.mutate(
      { incidentId, code },
      {
        onSuccess: () => toast.success(`Ticket ${numeroBT} : gravité « ${code} »`),
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        disabled={changer.isPending}
        title="Changer la gravité"
        className="flex items-center gap-1 disabled:opacity-50"
      >
        <CritTag niveau={niveau} />
        <span className="text-dim text-[11px]" aria-hidden>
          ▾
        </span>
      </button>
      {ouvert && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOuvert(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-[61] bg-bg-card border border-white/[0.1] rounded-xl p-1.5 flex flex-col gap-1 shadow-lg min-w-[140px]">
            {GRAVITES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => choisir(g)}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-lg text-left min-h-[40px] hover:bg-white/[0.05]',
                  g === niveau && 'bg-white/[0.06]'
                )}
              >
                <CritTag niveau={g} minWidth />
                {g === niveau && <span className="text-[11px] text-dim">actuelle</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
