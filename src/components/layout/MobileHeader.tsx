import { useNavigate, useLocation } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

interface MobileHeaderProps {
  initiales: string;
  couleurAvatar: string;
  topOffset?: number;
}

const pageTitles: Record<string, string> = {
  '/gmao': 'Tableau de bord',
  '/gmao/operations': 'Operations',
  '/gmao/equipements': 'Equipements',
  '/gmao/ia-predictive': 'IA Predictive',
  '/gmao/flotte': 'Flotte',
  '/gmao/recurrences': 'Recurrences',
  '/gmao/cinq-pourquoi': '5 Pourquoi',
  '/gmao/stock': 'Stock',
  '/gmao/preventif': 'Preventif',
  '/gmao/certifications': 'Certifications',
  '/gmao/plaintes': 'Plaintes',
  '/gmao/controles-historique': 'Controles',
  '/gmao/profil': 'Profil',
  '/gmao/mon-parc': 'Mon parc',
  '/gmao/parcs': 'Parcs',
  '/gmao/utilisateurs': 'Utilisateurs',
  '/gmao/bibliotheque': 'Bibliotheque',
  '/gmao/fournisseurs': 'Fournisseurs',
  '/gmao/aide': 'Aide',
  '/gmao/formation': 'Formation',
  '/gmao/notifications-ia': 'Notifications IA',
  '/staff/controle-ouverture': 'Controle ouverture',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/gmao/operations/')) return 'Intervention';
  if (pathname.startsWith('/gmao/cinq-pourquoi/')) return '5 Pourquoi';
  if (pathname.startsWith('/gmao/parcs/')) return 'Parc';
  return 'ALBA';
}

export function MobileHeader({ initiales, couleurAvatar, topOffset = 0 }: MobileHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <header
      className="fixed left-0 right-0 z-[50] bg-[#0a0e27] border-b border-white/[0.06] h-14 flex items-center px-4"
      style={{
        top: topOffset,
        paddingTop: topOffset === 0 ? 'env(safe-area-inset-top, 0px)' : undefined,
      }}
    >
      <div className="flex-shrink-0">
        <Logo size="sm" withText={false} />
      </div>

      <div className="flex-1 text-center">
        <span className="text-[14px] font-semibold text-text tracking-wide">{title}</span>
      </div>

      <button
        onClick={() => navigate('/gmao/profil')}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-[11px]"
        style={{ background: couleurAvatar, color: '#0B0B2E' }}
      >
        {initiales}
      </button>
    </header>
  );
}
