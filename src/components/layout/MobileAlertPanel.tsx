import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSidebarBadges } from '@/hooks/queries/useSidebarBadges';

interface MobileAlertPanelProps {
  open: boolean;
  onClose: () => void;
}

interface AlertRow {
  key: string;
  label: string;
  count: number;
  tone: 'red' | 'amber';
  to: string;
}

export function MobileAlertPanel({ open, onClose }: MobileAlertPanelProps) {
  const { data: badges } = useSidebarBadges();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const items: AlertRow[] = [];
  if (badges) {
    if (badges.controlesManquants > 0)
      items.push({ key: 'cm', label: 'Controles manquants', count: badges.controlesManquants, tone: 'red', to: '/staff/controle-ouverture' });
    if (badges.operations > 0)
      items.push({ key: 'ops', label: 'Incidents ouverts', count: badges.operations, tone: 'red', to: '/gmao/operations' });
    if (badges.interventionsEnCours > 0)
      items.push({ key: 'int', label: 'Interventions en cours', count: badges.interventionsEnCours, tone: 'red', to: '/gmao/operations' });
    if (badges.recurrences > 0)
      items.push({ key: 'rec', label: 'Recurrences detectees', count: badges.recurrences, tone: 'red', to: '/gmao/recurrences' });
    if (badges.cinqPourquoi > 0)
      items.push({ key: '5p', label: 'Fiches 5P ouvertes', count: badges.cinqPourquoi, tone: 'amber', to: '/gmao/cinq-pourquoi' });
    if (badges.notificationsIA > 0)
      items.push({ key: 'ia', label: 'Hypotheses IA en attente', count: badges.notificationsIA, tone: 'amber', to: '/gmao/notifications-ia' });
    if (badges.invitationsPending > 0)
      items.push({ key: 'inv', label: 'Invitations en attente', count: badges.invitationsPending, tone: 'amber', to: '/gmao/utilisateurs' });
    if (badges.plaintesAQualifier > 0)
      items.push({ key: 'plaintes', label: 'Plaintes a qualifier', count: badges.plaintesAQualifier, tone: 'amber', to: '/gmao/plaintes' });
  }

  const handleNav = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/60 z-[110] transition-opacity duration-250',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed left-0 right-0 bottom-0 z-[111] bg-[#0a0e27] rounded-t-2xl max-h-[70vh] flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pb-1">
          <div className="text-[13px] font-semibold text-text mb-1">Notifications</div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {items.length === 0 ? (
            <div className="py-10 text-center text-dim text-[13px]">
              Aucune alerte en cours
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNav(item.to)}
                  className="flex items-center gap-3 w-full px-3 min-h-[48px] rounded-xl text-dim hover:text-text hover:bg-white/[0.04] transition-colors"
                >
                  <span
                    className={cn(
                      'flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg text-[#0B0B2E] min-w-[28px] text-center',
                      item.tone === 'red' ? 'bg-red' : 'bg-amber'
                    )}
                  >
                    {item.count}
                  </span>
                  <span className="text-[14px]">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
