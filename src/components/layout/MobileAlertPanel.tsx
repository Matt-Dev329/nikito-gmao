import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAlertesVues } from '@/hooks/useAlertesVues';

interface MobileAlertPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MobileAlertPanel({ open, onClose }: MobileAlertPanelProps) {
  // Seules les nouveautés : toucher une alerte la retire, elle revient si le nombre augmente
  const { nouvelles: items, marquerVue, toutMarquerVu } = useAlertesVues();
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
          'fixed left-0 right-0 bottom-0 z-[111] bg-bg-sidebar rounded-t-lg max-h-[70vh] flex flex-col transition-transform duration-300 ease-out border-t border-white/[0.08] shadow-[0_-20px_48px_rgba(0,0,0,0.32)]',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pb-1 flex items-center gap-2">
          <div className="text-[13px] font-semibold text-text mb-1 flex-1">Notifications</div>
          {items.length > 0 && (
            <button onClick={toutMarquerVu} className="text-[12px] text-nikito-cyan min-h-[40px] px-1">
              ✓ Tout marquer comme vu
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {items.length === 0 ? (
            <div className="py-10 text-center text-dim text-[13px]">
              Aucune nouvelle alerte
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    marquerVue(item.key);
                    handleNav(item.to);
                  }}
                  className="flex items-center gap-3 w-full px-3 min-h-[48px] rounded-lg text-dim hover:text-text hover:bg-white/[0.05] transition-colors"
                >
                  <span
                    className={cn(
                      'flex-shrink-0 text-[11px] font-bold px-2 py-1 rounded-md text-bg-app min-w-[28px] text-center',
                      item.tone === 'red' ? 'bg-red' : 'bg-amber'
                    )}
                  >
                    {item.nouveau}
                  </span>
                  <span className="text-[14px]">{item.label}</span>
                  {item.nouveau < item.total && <span className="ml-auto text-[11px] text-faint">nouveaux</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
