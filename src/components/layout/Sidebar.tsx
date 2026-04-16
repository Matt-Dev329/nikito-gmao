import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import type { RoleUtilisateur } from '@/types/database';

interface NavItem {
  to: string;
  label: string;
  badge?: { count: number; tone: 'red' | 'amber' };
  roles: RoleUtilisateur[];
  end?: boolean;
}

// Navigation conditionnelle selon le rôle de l'utilisateur connecté
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
      { to: '/gmao/preventif', label: 'Préventif', roles: ['chef_maintenance', 'technicien'] },
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
}

export function Sidebar({ user, roleAffiche, roleCode }: SidebarProps) {
  return (
    <aside className="bg-bg-sidebar p-5 px-3.5 flex flex-col gap-1.5 border-r border-white/5 min-w-[240px]">
      <div className="px-2.5 pt-2 pb-4">
        <Logo subtitle={`GMAO · ${roleAffiche}`} />
      </div>

      {sections.map((section) => {
        const itemsVisibles = section.items.filter((it) => it.roles.includes(roleCode));
        if (itemsVisibles.length === 0) return null;
        return (
          <div key={section.titre} className="contents">
            <div className="text-[10px] text-faint uppercase tracking-[1.4px] px-2.5 pt-3 pb-1.5">
              {section.titre}
            </div>
            {itemsVisibles.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] transition-colors',
                    isActive
                      ? 'bg-gradient-active border-l-2 border-nikito-pink text-text font-medium'
                      : 'text-dim hover:text-text hover:bg-white/[0.02]'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'inline-block w-3.5 h-3.5 rounded-[3px]',
                        isActive ? 'bg-nikito-pink' : 'bg-[#2A2A5A]'
                      )}
                    />
                    {item.label}
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
              </NavLink>
            ))}
          </div>
        );
      })}

      <div className="mt-auto pt-3.5 px-2.5 border-t border-white/[0.06] flex items-center gap-2.5">
        <div
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-semibold text-xs"
          style={{ background: user.couleurAvatar ?? '#5DE5FF', color: '#0B0B2E' }}
        >
          {user.initiales}
        </div>
        <div className="text-xs">
          <div className="font-medium">{user.nom}</div>
          <div className="text-dim text-[11px]">{user.role}</div>
        </div>
      </div>
    </aside>
  );
}
