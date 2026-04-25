import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ViewAsBanner } from './ViewAsBanner';
import { FormationBanner } from './FormationBanner';
import { MobileHeader } from './MobileHeader';
import { BottomTabBar } from './BottomTabBar';
import { MobileMoreDrawer } from './MobileMoreDrawer';
import { MobileAlertPanel } from './MobileAlertPanel';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { useTour, isTourCompleted } from '@/components/tour/useTour';
import { ModaleSignalerV2, type SignalerVia } from '@/components/forms/ModaleSignalerV2';
import { useAuth } from '@/hooks/useAuth';
import { useViewAs, useEffectiveRole } from '@/hooks/useViewAs';
import { useFormation } from '@/hooks/useFormation';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useControlesManquantsCheck } from '@/hooks/useControlesManquantsCheck';
import { useIsMobile } from '@/hooks/useIsMobile';
import { canSignaler, hasModeExpert, getSignalerButtonVariant } from '@/lib/signaler';
import { roleLabels } from '@/lib/tokens';
import { cn } from '@/lib/utils';

const SIDEBAR_W_EXPANDED = 256;
const SIDEBAR_W_COMPACT = 72;
const SIDEBAR_W_MOBILE = 280;

const roleAffiches: Record<string, string> = {
  direction: 'DIRECTION',
  chef_maintenance: "CHEF D'EQUIPE",
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
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const viewAsRole = useViewAs((s) => s.role);
  const realRoleCode = utilisateur?.role_code ?? 'direction';
  const effectiveRole = useEffectiveRole(realRoleCode);

  const [moreOpen, setMoreOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [signalerOpen, setSignalerOpen] = useState(false);

  useControlesManquantsCheck();

  const isTabletFixed = typeof window !== 'undefined' && localStorage.getItem('alba:device_kind') === 'tablet-fixed';
  const btnVariant = getSignalerButtonVariant(effectiveRole, isTabletFixed);
  const showDesktopSignaler = !isMobile && canSignaler(effectiveRole) && btnVariant !== 'central-tablet' && btnVariant !== 'hidden';
  const expert = hasModeExpert(effectiveRole);
  const signalerVia: SignalerVia = isMobile || isTabletFixed ? 'tablette_signalement' : 'desktop_topbar';
  const signalerParcId = utilisateur?.parc_ids?.length === 1 ? utilisateur.parc_ids[0] : undefined;

  const openSignaler = useCallback(() => setSignalerOpen(true), []);

  useEffect(() => {
    if (!canSignaler(effectiveRole)) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        setSignalerOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [effectiveRole]);

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

  if (isMobile) {
    const mobileTopOffset = bannerH;
    const headerH = 56;
    const bottomBarH = 70;

    return (
      <div className="min-h-screen bg-bg-app text-text">
        <TourOverlay />
        <FormationBanner />
        <ViewAsBanner topOffset={formationBannerH} />

        <MobileHeader
          initiales={user.initiales}
          couleurAvatar={user.couleurAvatar}
          topOffset={mobileTopOffset}
        />

        <div style={{ paddingTop: mobileTopOffset + headerH, paddingBottom: bottomBarH + 12 }}>
          <main className="min-h-screen overflow-x-hidden">
            <Outlet />
          </main>
        </div>

        <BottomTabBar
          roleCode={effectiveRole}
          onAlertsClick={() => {
            setMoreOpen(false);
            setAlertsOpen((v) => !v);
          }}
          onMoreClick={() => {
            setAlertsOpen(false);
            setMoreOpen((v) => !v);
          }}
          alertsOpen={alertsOpen}
          moreOpen={moreOpen}
          onSignalerClick={openSignaler}
        />

        <MobileAlertPanel
          open={alertsOpen}
          onClose={() => setAlertsOpen(false)}
        />

        <MobileMoreDrawer
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          roleCode={effectiveRole}
          onSignOut={handleSignOut}
        />

        <ModaleSignalerV2
          open={signalerOpen}
          onClose={() => setSignalerOpen(false)}
          via={signalerVia}
          parcId={signalerParcId}
          modeExpert={expert}
        />
      </div>
    );
  }

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

      {showDesktopSignaler && <DesktopSignalerButton variant={btnVariant} onClick={openSignaler} />}

      <ModaleSignalerV2
        open={signalerOpen}
        onClose={() => setSignalerOpen(false)}
        via={signalerVia}
        parcId={signalerParcId}
        modeExpert={expert}
      />
    </div>
  );
}

function DesktopSignalerButton({ variant, onClick }: { variant: string; onClick: () => void }) {
  if (variant === 'icon-only') {
    return (
      <button
        onClick={onClick}
        title="Signaler un incident (Ctrl+I)"
        className="fixed top-4 right-4 z-[90] w-12 h-12 rounded-xl border border-white/[0.08] bg-[#131836] text-dim hover:text-white hover:border-white/20 transition-all flex items-center justify-center"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L2 17h16L10 2z" />
          <path d="M10 7v4" />
          <circle cx="10" cy="13.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-[90] h-11 px-5 rounded-xl text-white text-[13px] font-semibold flex items-center gap-2 active:scale-[0.97] transition-transform"
      style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
        boxShadow: '0 4px 16px rgba(236, 72, 153, 0.2)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      Signaler
    </button>
  );
}
