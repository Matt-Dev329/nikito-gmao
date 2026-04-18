import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSidebarBadges } from '@/hooks/queries/useSidebarBadges';

interface Props {
  compact?: boolean;
  onNavClick?: () => void;
}

export function NotificationBell({ compact, onNavClick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: badges } = useSidebarBadges();
  const navigate = useNavigate();

  const items: { label: string; count: number; tone: 'red' | 'amber'; to: string }[] = [];

  if (badges) {
    if (badges.controlesManquants > 0)
      items.push({ label: 'Controles manquants', count: badges.controlesManquants, tone: 'red', to: '/staff/controle-ouverture' });
    if (badges.operations > 0)
      items.push({ label: 'Incidents ouverts', count: badges.operations, tone: 'red', to: '/gmao/operations' });
    if (badges.recurrences > 0)
      items.push({ label: 'Recurrences detectees', count: badges.recurrences, tone: 'red', to: '/gmao/recurrences' });
    if (badges.cinqPourquoi > 0)
      items.push({ label: 'Fiches 5P ouvertes', count: badges.cinqPourquoi, tone: 'amber', to: '/gmao/cinq-pourquoi' });
    if (badges.notificationsIA > 0)
      items.push({ label: 'Hypotheses IA en attente', count: badges.notificationsIA, tone: 'amber', to: '/gmao/notifications-ia' });
    if (badges.invitationsPending > 0)
      items.push({ label: 'Invitations en attente', count: badges.invitationsPending, tone: 'amber', to: '/gmao/utilisateurs' });
  }

  const totalCount = items.reduce((s, i) => s + i.count, 0);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNav = (to: string) => {
    setOpen(false);
    onNavClick?.();
    navigate(to);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex items-center justify-center rounded-[10px] transition-colors w-[40px] min-h-[40px] flex-shrink-0',
          open ? 'bg-white/[0.06] text-text' : 'text-dim hover:text-text hover:bg-white/[0.04]'
        )}
        title="Notifications"
      >
        <BellIcon className="w-[18px] h-[18px]" />
        {totalCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-[14px] h-[14px] rounded-full bg-red text-bg-app text-[8px] font-bold flex items-center justify-center leading-none">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute z-50 bg-bg-card border border-white/[0.08] rounded-xl shadow-2xl py-2 min-w-[260px]',
          compact ? 'left-full top-0 ml-2' : 'left-0 top-full mt-1.5'
        )}>
          <div className="px-3 py-1.5 text-[10px] text-faint uppercase tracking-wider">
            Notifications
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-4 text-[12px] text-dim text-center">
              Aucune notification
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.to}
                onClick={() => handleNav(item.to)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors"
              >
                <span className={cn(
                  'flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded text-bg-app min-w-[22px] text-center',
                  item.tone === 'red' ? 'bg-red' : 'bg-amber'
                )}>
                  {item.count}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2a5 5 0 0 0-5 5c0 4-2 5-2 5h14s-2-1-2-5a5 5 0 0 0-5-5" />
      <path d="M8.5 15a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}
