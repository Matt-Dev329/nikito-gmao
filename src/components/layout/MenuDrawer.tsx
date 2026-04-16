import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

const menuItems = [
  { to: '/gmao', label: 'Tableau de bord', icon: '📊' },
  { to: '/gmao/profil', label: 'Mon profil', icon: '👤' },
];

export function MenuDrawer({ open, onClose }: MenuDrawerProps) {
  const navigate = useNavigate();
  const { utilisateur, signOut } = useAuth();

  const handleNav = (to: string) => {
    onClose();
    navigate(to);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/60 z-40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 w-[280px] bg-bg-sidebar z-50 flex flex-col transition-transform duration-200 ease-out border-l border-white/[0.06]',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <Logo size="sm" subtitle="GMAO" />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-bg-card border border-white/[0.08] text-dim text-sm"
            >
              x
            </button>
          </div>
          {utilisateur && (
            <div className="flex items-center gap-2.5 bg-bg-deep rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-nikito-pink to-nikito-violet flex items-center justify-center font-bold text-xs text-text">
                {utilisateur.trigramme || (utilisateur.prenom[0] + utilisateur.nom[0])}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {utilisateur.prenom} {utilisateur.nom}
                </div>
                <div className="text-[11px] text-dim truncate">{utilisateur.email}</div>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1">
          {menuItems.map((item) => (
            <button
              key={item.to}
              onClick={() => handleNav(item.to)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-dim hover:text-text hover:bg-bg-card transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-medium text-red hover:bg-red/10 transition-colors"
          >
            <span className="text-base">↪</span>
            Se d{'\u00e9'}connecter
          </button>
        </div>
      </div>
    </>
  );
}
