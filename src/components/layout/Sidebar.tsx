import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { getNavIcon, IconToggleSidebar, IconDeconnexion } from './NavIcons';
import type { RoleUtilisateur } from '@/types/database';

interface NavItem {
  to: string;
  label: string;
  badge?: { count: number; tone: 'red' | 'amber' };
  roles: RoleUtilisateur[];
  end?: boolean;
}

const sections: { titre: string; items: NavItem[] }[] = [
  {
    titre: 'Pilotage',
    items: [
      { to: '/gmao', label: 'Tableau de bord', roles: ['direction', 'chef_maintenance'], end: true },
      { to: '/gmao/mon-parc', label: 'Mon parc', roles: ['manager_parc'] },
      { to: '/gmao/operations', label: 'Opérations', roles: ['direction', 'chef_maintenance', 'technicien'] },
      { to: '/gmao/equipements', label: 'Équipements', roles: ['direction', 'chef_maintenance', 'technicien', 'manager_parc'] },
      {
        to: '/gmao/recurrences',
        label: 'Récurrences',
        badge: { count: 4, tone: 'red' },
        roles: ['direction', 'chef_maintenance'],
      },
      {
        to: '/gmao/cinq-pourquoi',
        label: '5 Pourquoi',
        badge: { count: 2, tone: 'amber' },
        roles: ['direction', 'chef_maintenance'],
      },
      { to: '/gmao/stock', label: 'Stock', roles: ['direction', 'chef_maintenance', 'technicien'] },
      { to: '/gmao/preventif', label: 'Préventif', roles: ['direction', 'chef_maintenance', 'manager_parc'] },
      { to: '/gmao/certifications', label: 'Certifications', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/plaintes', label: 'Plaintes clients', roles: ['direction', 'chef_maintenance', 'manager_parc'] },
    ],
  },
  {
    titre: 'Configuration',
    items: [
      { to: '/gmao/parcs', label: 'Parcs', roles: ['direction'] },
      {
        to: '/gmao/utilisateurs',
        label: 'Utilisateurs',
        badge: { count: 3, tone: 'amber' },
        roles: ['direction', 'chef_maintenance', 'manager_parc'],
      },
      { to: '/gmao/bibliotheque', label: 'Bibliothèque points', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/fournisseurs', label: 'Fournisseurs', roles: ['direction', 'chef_maintenance'] },
    ],
  },
];

interface SidebarProps {
  user: { initiales: string; nom: string; role: string; couleurAvatar?: string };
  roleAffiche: string;
  roleCode: RoleUtilisateur;
  compact?: boolean;
  onNavClick?: () => void;
  onToggle?: () => void;
  onSignOut?: () => void;
}

export function Sidebar({ user, roleAffiche, roleCode, compact = false, onNavClick, onToggle, onSignOut }: SidebarProps) {
  return (
    <div className={cn('h-full flex flex-col overflow-y-auto', compact ? 'p-2 gap-0.5' : 'p-5 px-3.5 gap-1.5')}>
      <div className={cn('flex items-center', compact ? 'justify-center py-3 px-0' : 'px-2.5 pt-2 pb-4')}>
        {compact ? (
          <Logo size="sm" withText={false} />
        ) : (
          <Logo subtitle={`GMAO · ${roleAffiche}`} />
        )}
      </div>

      {onToggle && (
        <button
          onClick={onToggle}
          className={cn(
            'hidden md:flex items-center gap-2.5 rounded-[10px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors min-h-[40px]',
            compact ? 'justify-center px-0' : 'px-3'
          )}
          title={compact ? 'Étendre la sidebar' : 'Réduire la sidebar'}
        >
          <IconToggleSidebar className={cn('w-[18px] h-[18px] flex-shrink-0 transition-transform', compact && 'rotate-180')} />
          {!compact && <span className="text-[12px]">Réduire</span>}
        </button>
      )}

      {sections.map((section) => {
        const itemsVisibles = section.items.filter((it) => it.roles.includes(roleCode));
        if (itemsVisibles.length === 0) return null;
        return (
          <div key={section.titre} className="contents">
            {compact ? (
              <div className="h-px bg-white/[0.06] my-2 mx-2" />
            ) : (
              <div className="text-[10px] text-faint uppercase tracking-[1.4px] px-2.5 pt-3 pb-1.5">
                {section.titre}
              </div>
            )}
            {itemsVisibles.map((item) => {
              const Icon = getNavIcon(item.label);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavClick}
                  title={compact ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center rounded-[10px] transition-colors min-h-[44px]',
                      compact ? 'justify-center px-0' : 'gap-2.5 px-3 py-2.5',
                      isActive
                        ? 'bg-gradient-active border-l-2 border-nikito-pink text-text font-medium'
                        : 'text-dim hover:text-text hover:bg-white/[0.02]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-nikito-pink' : '')} />
                      {!compact && (
                        <>
                          <span className="text-[13px]">{item.label}</span>
                          {item.badge && (
                            <span
                              className={cn(
                                'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-lg text-bg-app',
                                item.badge.tone === 'red' ? 'bg-red' : 'bg-amber'
                              )}
                            >
                              {item.badge.count}
                            </span>
                          )}
                        </>
                      )}
                      {compact && item.badge && (
                        <span
                          className={cn(
                            'absolute top-1.5 right-1.5 w-2 h-2 rounded-full',
                            item.badge.tone === 'red' ? 'bg-red' : 'bg-amber'
                          )}
                        />
                      )}
                      {compact && (
                        <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-bg-card text-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-white/[0.08]">
                          {item.label}
                          {item.badge && (
                            <span className={cn('ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded text-bg-app', item.badge.tone === 'red' ? 'bg-red' : 'bg-amber')}>
                              {item.badge.count}
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        );
      })}

      <div className={cn('mt-auto border-t border-white/[0.06]', compact ? 'pt-3 pb-2' : 'pt-3.5 px-2.5')}>
        <div className={cn('flex items-center', compact ? 'justify-center' : 'gap-2.5')}>
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0"
            style={{ background: user.couleurAvatar ?? '#5DE5FF', color: '#0B0B2E' }}
            title={compact ? `${user.nom} · ${user.role}` : undefined}
          >
            {user.initiales}
          </div>
          {!compact && (
            <div className="text-xs min-w-0">
              <div className="font-medium truncate">{user.nom}</div>
              <div className="text-dim text-[11px] truncate">{user.role}</div>
            </div>
          )}
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className={cn(
              'flex items-center rounded-[10px] text-dim hover:text-red hover:bg-red/10 transition-colors min-h-[40px] w-full mt-2',
              compact ? 'justify-center px-0' : 'gap-2.5 px-3'
            )}
            title={compact ? 'Se déconnecter' : undefined}
          >
            <IconDeconnexion className="w-[18px] h-[18px] flex-shrink-0" />
            {!compact && <span className="text-[12px]">Se déconnecter</span>}
          </button>
        )}
      </div>
    </div>
  );
}
