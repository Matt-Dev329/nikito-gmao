import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ViewAsBanner } from './ViewAsBanner';
import { FormationBanner } from './FormationBanner';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { useTour, isTourCompleted } from '@/components/tour/useTour';
import { useAuth } from '@/hooks/useAuth';
import { useViewAs, useEffectiveRole } from '@/hooks/useViewAs';
import { useFormation } from '@/hooks/useFormation';
import { useSidebarState } from '@/hooks/useSidebarState';
import { roleLabels } from '@/lib/tokens';
import { cn } from '@/lib/utils';

const SIDEBAR_W_EXPANDED = 256;
const SIDEBAR_W_COMPACT = 72;
const SIDEBAR_W_MOBILE = 280;

const roleAffiches: Record<string, string> = {
  direction: 'DIRECTION',
  chef_maintenance: "CHEF D'ÉQUIPE",
  manager_parc: 'MANAGER PARC',
  technicien: 'TECHNICIEN',
  staff_operationnel: 'STAFF',
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function DashboardLayout() {
  const { utilisateur, loading, signOut } = useAuth();
  const { mobileOpen, expanded, toggleExpanded, openMobile, closeMobile } = useSidebarState();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const viewAsRole = useViewAs((s) => s.role);
  const realRoleCode = utilisateur?.role_code ?? 'direction';
  const effectiveRole = useEffectiveRole(realRoleCode);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const userMock = {
    initiales: 'DI',
    nom: 'Direction',
    role: 'Vue 4 parcs',
    couleurAvatar: '#5DE5FF',
    role_code: 'direction' as const,
  };

  const user = utilisateur
    ? {
        initiales: utilisateur.trigramme ?? utilisateur.prenom.slice(0, 2).toUpperCase(),
        nom: `${utilisateur.prenom} ${utilisateur.nom}`,
        role: roleLabels[utilisateur.role_code],
        couleurAvatar: '#5DE5FF',
        role_code: utilisateur.role_code,
      }
    : userMock;

  const startTour = useTour((s) => s.start);
  const tourActive = useTour((s) => s.active);

  useEffect(() => {
    if (!loading && utilisateur && !isTourCompleted() && !tourActive) {
      const timer = setTimeout(() => startTour(), 800);
      return () => clearTimeout(timer);
    }
  }, [loading, utilisateur, startTour, tourActive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  const formationActive = useFormation((s) => s.active);
  const sidebarWidth = expanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COMPACT;
  const viewAsBannerH = viewAsRole ? 36 : 0;
  const formationBannerH = formationActive ? 40 : 0;
  const bannerH = viewAsBannerH + formationBannerH;

  return (
    <div className="min-h-screen bg-bg-app text-text">
      <TourOverlay />
      <FormationBanner />
      <ViewAsBanner topOffset={formationBannerH} />
      <header
        className="md:hidden fixed left-0 right-0 z-40 bg-bg-sidebar border-b border-white/[0.06] px-4 h-14 flex items-center justify-between"
        style={{ top: bannerH }}
      >
        <button
          onClick={openMobile}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text -ml-2"
          aria-label="Ouvrir le menu"
        >
          <svg width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1H21M1 9H21M1 17H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <span className="text-sm font-bold tracking-wide">NIKITO</span>
        <div className="w-[44px]" />
      </header>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 bg-bg-sidebar border-r border-white/[0.06]',
          'transition-all duration-300 ease-out',
          isDesktop
            ? 'z-auto translate-x-0'
            : cn('z-50', mobileOpen ? 'translate-x-0' : '-translate-x-full')
        )}
        style={{
          width: isDesktop ? sidebarWidth : SIDEBAR_W_MOBILE,
          top: isDesktop ? bannerH : 0,
          height: isDesktop ? `calc(100vh - ${bannerH}px)` : '100vh',
        }}
      >
        {!isDesktop && (
          <button
            onClick={closeMobile}
            className="absolute top-4 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-dim z-10"
            aria-label="Fermer le menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        <Sidebar
          user={user}
          roleAffiche={formationActive ? `${roleAffiches[effectiveRole] ?? 'UTILISATEUR'} · FORMATION` : roleAffiches[effectiveRole] ?? 'UTILISATEUR'}
          roleCode={effectiveRole}
          realRoleCode={realRoleCode}
          compact={isDesktop && !expanded}
          onNavClick={isDesktop ? undefined : closeMobile}
          onToggle={isDesktop ? toggleExpanded : undefined}
          onSignOut={handleSignOut}
        />
      </aside>

      <div
        className="transition-[margin] duration-300 ease-out"
        style={{ marginLeft: isDesktop ? sidebarWidth : 0, paddingTop: bannerH }}
      >
        <main className={cn('min-h-screen overflow-x-hidden', !isDesktop && 'pt-14')}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
