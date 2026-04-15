import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

interface TabletHeaderProps {
  parc: string;
  parcCode: string;
  titre: string;
  user?: { initiales: string; prenom: string };
  enService?: boolean;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

export function TabletHeader({
  parc,
  parcCode,
  titre,
  user,
  enService,
  showBack,
  rightSlot,
}: TabletHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="px-[18px] py-3.5 bg-bg-sidebar flex items-center gap-3.5 border-b border-white/[0.06]">
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className="bg-bg-card border border-white/[0.08] w-[34px] h-[34px] rounded-[10px] text-base"
        >
          ‹
        </button>
      ) : (
        <Logo withText={false} />
      )}

      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-dim tracking-[1.2px] uppercase truncate">
          {parcCode} · {parc}
        </div>
        <div className="text-[15px] font-semibold truncate">{titre}</div>
      </div>

      {user && (
        <div className="flex items-center gap-2 bg-bg-card px-3 py-1.5 rounded-pill">
          <div className="w-7 h-7 rounded-full bg-nikito-cyan text-bg-app flex items-center justify-center font-bold text-xs">
            {user.initiales}
          </div>
          <div className="text-xs font-medium">{user.prenom}</div>
        </div>
      )}

      {enService && (
        <div className="bg-green text-bg-app px-2.5 py-1 rounded-[14px] text-[11px] font-semibold">
          ● en service
        </div>
      )}

      {rightSlot}
    </header>
  );
}
