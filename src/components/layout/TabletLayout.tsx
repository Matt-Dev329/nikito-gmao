import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MenuDrawer } from '@/components/layout/MenuDrawer';

const tabs = [
  { to: '/tech/operations', label: 'Opérations', icon: '⚙' },
  { to: '/tech/controle-hebdo', label: 'Contrôles', icon: '✓' },
  { to: '/tech/stock', label: 'Stock', icon: '📦' },
  { to: '/tech/signaler', label: 'Signaler', icon: '+' },
];

export function TabletLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-app text-text flex flex-col max-w-[820px] mx-auto">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-[820px] mx-auto bg-bg-sidebar p-2.5 px-3.5 grid grid-cols-5 gap-2 border-t border-white/[0.06]">
        {tabs.map((tab) => (
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
          onClick={() => setMenuOpen(true)}
          className="rounded-xl py-3.5 px-2 text-[11px] flex flex-col items-center gap-1 transition-colors bg-bg-card border border-white/[0.06] text-dim hover:text-text"
        >
          <span className="text-lg">☰</span>
          Menu
        </button>
      </nav>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
