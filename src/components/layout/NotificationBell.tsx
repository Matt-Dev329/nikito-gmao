import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAlertesVues } from '@/hooks/useAlertesVues';
import { useNotificationsConformite, useMarkNotificationRead } from '@/hooks/queries/useConformite';
import { useAuth } from '@/hooks/useAuth';
import { useTachesAValider } from '@/hooks/useTachesAValider';
import { TachesAValider } from '@/components/TachesAValider';

interface Props {
  compact?: boolean;
  onNavClick?: () => void;
}

export function NotificationBell({ compact, onNavClick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { utilisateur } = useAuth();
  const { data: notifsConformite } = useNotificationsConformite(utilisateur?.id);
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();
  // Seules les nouveautés : toucher une alerte la retire, elle revient si le nombre augmente
  const { nouvelles: items, totalNouveau, marquerVue, toutMarquerVu } = useAlertesVues();
  const conformiteCount = notifsConformite?.length ?? 0;
  const { data: taches } = useTachesAValider();
  const nbTaches = taches?.length ?? 0;
  const unseenCount = totalNouveau + conformiteCount + nbTaches;

  const handleToggle = useCallback(() => setOpen((o) => !o), []);

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
        onClick={handleToggle}
        className={cn(
          'relative flex items-center justify-center rounded-[10px] transition-colors w-[40px] min-h-[40px] flex-shrink-0',
          open ? 'bg-white/[0.06] text-text' : 'text-dim hover:text-text hover:bg-white/[0.04]'
        )}
        title="Notifications"
      >
        <BellIcon className="w-[18px] h-[18px]" />
        {unseenCount > 0 && !open && (
          <span className="absolute top-1.5 right-1.5 w-[14px] h-[14px] rounded-full bg-red text-bg-app text-[8px] font-bold flex items-center justify-center leading-none">
            {unseenCount > 9 ? '9+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute z-50 bg-bg-card border border-white/[0.08] rounded-xl shadow-2xl py-2 min-w-[260px]',
          compact ? 'left-full top-0 ml-2' : 'left-0 top-full mt-1.5'
        )}>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <span className="text-[10px] text-faint uppercase tracking-wider flex-1">Notifications</span>
            {unseenCount > 0 && (
              <button
                onClick={() => {
                  toutMarquerVu();
                  (notifsConformite ?? []).forEach((n) => markRead.mutate(n.id));
                }}
                className="text-[11px] text-nikito-cyan hover:underline"
              >
                ✓ Tout marquer comme vu
              </button>
            )}
          </div>
          <TachesAValider />
          {items.length === 0 && conformiteCount === 0 ? (
            nbTaches > 0 ? null : (
            <div className="px-3 py-4 text-[12px] text-dim text-center">
              Aucune nouvelle notification
            </div>
            )
          ) : (
            <>
              {items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    marquerVue(item.key);
                    handleNav(item.to);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors"
                >
                  <span className={cn(
                    'flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded text-bg-app min-w-[22px] text-center',
                    item.tone === 'red' ? 'bg-red' : 'bg-amber'
                  )}>
                    {item.nouveau}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.nouveau < item.total && <span className="ml-auto text-[10px] text-faint">nouveaux</span>}
                </button>
              ))}
              {notifsConformite && notifsConformite.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] text-faint uppercase tracking-wider mt-1">
                    Conformite
                  </div>
                  {notifsConformite.slice(0, 5).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markRead.mutate(n.id);
                        const to = n.prescription_id ? '/gmao/conformite/reserves' : n.commission_id ? '/gmao/conformite/commissions' : '/gmao/conformite';
                        handleNav(to);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors"
                    >
                      <span className={cn(
                        'flex-shrink-0 w-2 h-2 rounded-full',
                        n.type_notification.includes('retard') ? 'bg-red' : n.type_notification.includes('commission') ? 'bg-amber' : 'bg-nikito-cyan'
                      )} />
                      <span className="truncate">{n.titre}</span>
                    </button>
                  ))}
                </>
              )}
            </>
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
