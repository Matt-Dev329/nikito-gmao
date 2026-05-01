import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/gmao/conformite', label: 'Vue d\'ensemble', end: true },
  { to: '/gmao/conformite/reserves', label: 'Reserves' },
  { to: '/gmao/conformite/commissions', label: 'Commissions' },
  { to: '/gmao/conformite/documents', label: 'Documents' },
  { to: '/gmao/conformite/acteurs', label: 'Acteurs' },
];

export function LayoutConformite() {
  return (
    <div className="h-full flex flex-col">
      <nav className="flex gap-1 px-4 md:px-6 lg:px-8 pt-3 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'px-3 md:px-4 py-2.5 text-[13px] whitespace-nowrap min-h-[44px] border-b-2 transition-colors',
                isActive
                  ? 'text-text font-semibold border-nikito-pink'
                  : 'text-dim border-transparent hover:text-text'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
