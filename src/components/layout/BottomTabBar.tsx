import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSidebarBadges } from '@/hooks/queries/useSidebarBadges';
import { canSignaler } from '@/lib/signaler';
import type { RoleUtilisateur } from '@/types/database';

interface BottomTabBarProps {
  roleCode: RoleUtilisateur;
  onAlertsClick: () => void;
  onMoreClick: () => void;
  alertsOpen?: boolean;
  moreOpen?: boolean;
  onSignalerClick?: () => void;
}

interface TabDef {
  id: string;
  label: string;
  matchPaths: string[];
  action: 'navigate' | 'alerts' | 'more' | 'signaler';
  route?: string;
}

function getTabsForRole(roleCode: RoleUtilisateur, isTablet: boolean): TabDef[] {
  const showSignaler = canSignaler(roleCode);
  const isStaffOrTech = roleCode === 'staff_operationnel' || roleCode === 'technicien';

  if (isTablet && isStaffOrTech) {
    return [
      {
        id: roleCode === 'technicien' ? 'operations' : 'dashboard',
        label: roleCode === 'technicien' ? 'Interventions' : 'Dashboard',
        matchPaths: roleCode === 'technicien' ? ['/gmao/operations'] : ['/gmao'],
        action: 'navigate',
        route: roleCode === 'technicien' ? '/gmao/operations' : '/gmao',
      },
      {
        id: 'controles',
        label: 'Controles',
        matchPaths: ['/staff/controle-ouverture', '/gmao/controles-historique', '/tech/controle-hebdo', '/tech/controle-mensuel'],
        action: 'navigate',
        route: roleCode === 'staff_operationnel' ? '/staff/controle-ouverture' : '/gmao/controles-historique',
      },
      {
        id: 'signaler',
        label: 'Signaler',
        matchPaths: [],
        action: 'signaler',
      },
      {
        id: 'alerts',
        label: 'Alertes',
        matchPaths: [],
        action: 'alerts',
      },
      {
        id: 'more',
        label: 'Plus',
        matchPaths: [],
        action: 'more',
      },
    ];
  }

  const tabs: TabDef[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      matchPaths: ['/gmao'],
      action: 'navigate',
      route: '/gmao',
    },
    {
      id: 'operations',
      label: 'Operations',
      matchPaths: ['/gmao/operations'],
      action: 'navigate',
      route: '/gmao/operations',
    },
  ];

  if (showSignaler) {
    tabs.push({
      id: 'signaler',
      label: 'Signaler',
      matchPaths: [],
      action: 'signaler',
    });
  } else {
    tabs.push({
      id: 'controles',
      label: 'Controles',
      matchPaths: ['/gmao/controles-historique', '/staff/controle-ouverture', '/tech/controle-hebdo', '/tech/controle-mensuel'],
      action: 'navigate',
      route: '/gmao/controles-historique',
    });
  }

  tabs.push(
    {
      id: 'alerts',
      label: 'Alertes',
      matchPaths: [],
      action: 'alerts',
    },
    {
      id: 'more',
      label: 'Plus',
      matchPaths: [],
      action: 'more',
    },
  );

  return tabs;
}

function isTabActive(tab: TabDef, pathname: string): boolean {
  if (tab.matchPaths.length === 0) return false;
  return tab.matchPaths.some((p) => {
    if (p === '/gmao') return pathname === '/gmao' || pathname === '/gmao/';
    return pathname.startsWith(p);
  });
}

export function BottomTabBar({ roleCode, onAlertsClick, onMoreClick, alertsOpen, moreOpen, onSignalerClick }: BottomTabBarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: badges } = useSidebarBadges();
  const isTablet = typeof window !== 'undefined' && localStorage.getItem('alba:device_kind') === 'tablet-fixed';
  const tabs = getTabsForRole(roleCode, isTablet);
  const hasSignaler = tabs.some((t) => t.id === 'signaler');

  const totalAlerts = badges
    ? badges.controlesManquants +
      badges.operations +
      badges.recurrences +
      badges.cinqPourquoi +
      badges.notificationsIA +
      badges.invitationsPending +
      badges.interventionsEnCours +
      badges.plaintesAQualifier
    : 0;

  const operationsBadge = badges?.operations ?? 0;

  const handleTabClick = (tab: TabDef) => {
    if (tab.action === 'alerts') {
      onAlertsClick();
    } else if (tab.action === 'more') {
      onMoreClick();
    } else if (tab.action === 'signaler') {
      onSignalerClick?.();
    } else if (tab.route) {
      navigate(tab.route);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0a0e27]/95 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch h-[70px]">
        {tabs.map((tab) => {
          if (tab.id === 'signaler' && hasSignaler && isTablet) {
            return (
              <div key={tab.id} className="flex-1 flex items-center justify-center relative">
                <button
                  className="absolute -top-6 w-[88px] h-[88px] rounded-[24px] flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
                    boxShadow: '0 8px 32px rgba(236, 72, 153, 0.3), 0 4px 16px rgba(6, 182, 212, 0.2)',
                  }}
                  onClick={() => {
                    try { navigator.vibrate?.(10); } catch { /* ignore */ }
                    onSignalerClick?.();
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-white text-[11px] font-semibold leading-none">Signaler</span>
                </button>
              </div>
            );
          }

          if (tab.id === 'signaler' && hasSignaler && !isTablet) {
            return (
              <div key={tab.id} className="flex-1 flex items-center justify-center relative">
                <button
                  className="absolute -top-3 w-[56px] h-[56px] rounded-[16px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
                    boxShadow: '0 4px 20px rgba(236, 72, 153, 0.25), 0 2px 10px rgba(6, 182, 212, 0.15)',
                  }}
                  onClick={() => {
                    try { navigator.vibrate?.(10); } catch { /* ignore */ }
                    onSignalerClick?.();
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="text-white text-[9px] font-semibold leading-none">Signaler</span>
                </button>
              </div>
            );
          }

          const active =
            (tab.id === 'alerts' && alertsOpen) ||
            (tab.id === 'more' && moreOpen) ||
            isTabActive(tab, pathname);

          let badgeCount = 0;
          if (tab.id === 'alerts') badgeCount = totalAlerts;
          if (tab.id === 'operations') badgeCount = operationsBadge;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors',
                active ? 'text-[#5DE5FF]' : 'text-[#8b92b8]'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-[#5DE5FF]" />
              )}
              <TabIcon id={tab.id} active={active} />
              <span className="text-[10px] leading-none font-medium">{tab.label}</span>
              {badgeCount > 0 && (
                <span className="absolute top-2 left-1/2 ml-2 w-[18px] h-[18px] rounded-full bg-red text-[#0B0B2E] text-[9px] font-bold flex items-center justify-center leading-none">
                  {badgeCount > 99 ? '99' : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function TabIcon({ id, active }: { id: string; active: boolean }) {
  const color = active ? '#5DE5FF' : '#8b92b8';
  const size = 24;

  switch (id) {
    case 'dashboard':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="9" rx="1.5" />
          <rect x="13" y="3" width="8" height="6" rx="1.5" />
          <rect x="3" y="14" width="8" height="7" rx="1.5" />
          <rect x="13" y="11" width="8" height="10" rx="1.5" />
        </svg>
      );
    case 'operations':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'controles':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 15h5" />
          <path d="M15 15l1.5 1.5 3-3" />
        </svg>
      );
    case 'alerts':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0-6 6c0 5-2.5 6.5-2.5 6.5h17S18 14 18 9a6 6 0 0 0-6-6" />
          <path d="M10 17.5a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'more':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    default:
      return null;
  }
}
