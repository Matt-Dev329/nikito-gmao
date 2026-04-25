import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MenuDrawer } from '@/components/layout/MenuDrawer';
import { ModaleSignalerV2 } from '@/components/forms/ModaleSignalerV2';
import { useAuth } from '@/hooks/useAuth';
import { hasModeExpert } from '@/lib/signaler';

const navTabs = [
  { to: '/tech/operations', label: 'Operations', icon: '\u2699' },
  { to: '/tech/controle-hebdo', label: 'Controles', icon: '\u2713' },
  { to: '/tech/stock', label: 'Stock', icon: '\u{1F4E6}' },
];

export function TabletLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signalerOpen, setSignalerOpen] = useState(false);
  const { utilisateur } = useAuth();
  const expert = hasModeExpert(utilisateur?.role_code ?? 'technicien');
  const parcId = utilisateur?.parc_ids?.length === 1 ? utilisateur.parc_ids[0] : undefined;

  return (
    <div className="min-h-screen bg-bg-app text-text flex flex-col max-w-[820px] mx-auto">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-[820px] mx-auto bg-bg-sidebar p-2.5 px-3.5 grid grid-cols-5 gap-2 border-t border-white/[0.06]">
        {navTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'rounded-xl py-3.5 px-2 text-[11px] flex flex-col items-center gap-1 transition-colors',
                isActive
                  ? 'bg-gradient-to-br from-nikito-pink to-nikito-violet text-text font-semibold'
                  : 'bg-bg-card border border-white/[0.06] text-dim hover:text-text'
              )
            }
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}

        <button
          onClick={() => setSignalerOpen(true)}
          className="rounded-xl py-3.5 px-2 text-[11px] flex flex-col items-center gap-1 transition-colors bg-gradient-to-br from-[#ec4899] to-[#06b6d4] text-white font-semibold"
        >
          <span className="text-lg">+</span>
          Signaler
        </button>

        <button
          onClick={() => setMenuOpen(true)}
          className="rounded-xl py-3.5 px-2 text-[11px] flex flex-col items-center gap-1 transition-colors bg-bg-card border border-white/[0.06] text-dim hover:text-text"
        >
          <span className="text-lg">{'\u2630'}</span>
          Menu
        </button>
      </nav>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <ModaleSignalerV2
        open={signalerOpen}
        onClose={() => setSignalerOpen(false)}
        via="tablette_signalement"
        parcId={parcId}
        modeExpert={expert}
      />
    </div>
  );
}
