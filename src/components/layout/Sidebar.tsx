import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { getNavIcon, IconToggleSidebar, IconDeconnexion, IconAide } from './NavIcons';
import { ViewAsSelector } from './ViewAsSelector';
import { NotificationBell } from './NotificationBell';
import { useFormation } from '@/hooks/useFormation';
import { useSidebarBadges } from '@/hooks/queries/useSidebarBadges';
import { useTour } from '@/components/tour/useTour';
import type { RoleUtilisateur } from '@/types/database';

const TOUR_KEYS: Record<string, string> = {
  'Tableau de bord': 'tableau-de-bord',
  'Mon parc': 'mon-parc',
  'Opérations': 'operations',
  'Équipements': 'equipements',
  'Récurrences': 'recurrences',
  '5 Pourquoi': 'cinq-pourquoi',
  'Stock': 'stock',
  'Préventif': 'preventif',
  'Certifications': 'certifications',
  'Plaintes clients': 'plaintes',
  'Contrôles': 'controles',
  'Contrôle d\'ouverture': 'controle-ouverture',
  'Contrôle hebdo': 'controle-hebdo',
  'Contrôle mensuel': 'controle-mensuel',
  'Parcs': 'parcs',
  'Utilisateurs': 'utilisateurs',
  'Bibliothèque points': 'bibliotheque',
  'Fournisseurs': 'fournisseurs',
};

interface Badge {
  count: number;
  tone: 'red' | 'amber';
}

interface NavItem {
  to: string;
  label: string;
  badgeKey?: 'recurrences' | 'cinqPourquoi' | 'operations' | 'invitationsPending' | 'controlesManquants' | 'notificationsIA' | 'interventionsEnCours' | 'plaintesAQualifier';
  badgeTone?: 'red' | 'amber';
  roles: RoleUtilisateur[];
  end?: boolean;
}

const sections: { titre: string; items: NavItem[] }[] = [
  {
    titre: 'Pilotage',
    items: [
      { to: '/gmao', label: 'Tableau de bord', roles: ['direction', 'chef_maintenance'], end: true },
      { to: '/gmao/mon-parc', label: 'Mon parc', roles: ['manager_parc'] },
      { to: '/gmao/operations', label: 'Opérations', badgeKey: 'operations', badgeTone: 'red', roles: ['direction', 'chef_maintenance', 'technicien', 'manager_parc'] },
      { to: '/gmao/equipements', label: 'Équipements', roles: ['direction', 'chef_maintenance', 'technicien', 'manager_parc'] },
      { to: '/gmao/ia-predictive', label: 'IA Prédictive', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/flotte', label: 'Flotte', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/recurrences', label: 'Récurrences', badgeKey: 'recurrences', badgeTone: 'red', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/cinq-pourquoi', label: '5 Pourquoi', badgeKey: 'cinqPourquoi', badgeTone: 'amber', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/controles-historique', label: 'Contrôles', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/plaintes', label: 'Plaintes clients', badgeKey: 'plaintesAQualifier', badgeTone: 'amber', roles: ['direction', 'chef_maintenance', 'manager_parc'] },
      { to: '/gmao/certifications', label: 'Certifications', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/preventif', label: 'Préventif', roles: ['direction', 'chef_maintenance', 'manager_parc'] },
      { to: '/gmao/stock', label: 'Stock', roles: ['direction', 'chef_maintenance', 'technicien'] },
    ],
  },
  {
    titre: 'Contrôles',
    items: [
      { to: '/staff/controle-ouverture', label: 'Contrôle d\'ouverture', badgeKey: 'controlesManquants', badgeTone: 'red', roles: ['direction', 'chef_maintenance', 'staff_operationnel'] },
      { to: '/tech/controle-hebdo', label: 'Contrôle hebdo', roles: ['direction', 'chef_maintenance', 'technicien', 'staff_operationnel'] },
      { to: '/tech/controle-mensuel', label: 'Contrôle mensuel', roles: ['direction', 'chef_maintenance', 'technicien', 'staff_operationnel'] },
    ],
  },
  {
    titre: 'Configuration',
    items: [
      { to: '/gmao/parcs', label: 'Parcs', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/utilisateurs', label: 'Utilisateurs', badgeKey: 'invitationsPending', badgeTone: 'amber', roles: ['direction', 'chef_maintenance', 'manager_parc'] },
      { to: '/gmao/bibliotheque', label: 'Bibliothèque points', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/fournisseurs', label: 'Fournisseurs', roles: ['direction', 'chef_maintenance'] },
      { to: '/gmao/it-admin', label: 'Administration IT', roles: ['direction', 'admin_it'] },
    ],
  },
];

interface SidebarProps {
  user: { initiales: string; nom: string; role: string; couleurAvatar?: string };
  roleAffiche: string;
  roleCode: RoleUtilisateur;
  realRoleCode?: RoleUtilisateur;
  compact?: boolean;
  onNavClick?: () => void;
  onToggle?: () => void;
  onSignOut?: () => void;
}

function resolveBadge(
  item: NavItem,
  badges: { recurrences: number; cinqPourquoi: number; operations: number; invitationsPending: number; controlesManquants: number; notificationsIA: number; interventionsEnCours: number; plaintesAQualifier: number } | undefined
): Badge | undefined {
  if (!item.badgeKey || !badges) return undefined;
  const count = badges[item.badgeKey] ?? 0;
  if (count === 0) return undefined;
  return { count, tone: item.badgeTone ?? 'amber' };
}

export function Sidebar({ user, roleAffiche, roleCode, realRoleCode, compact = false, onNavClick, onToggle, onSignOut }: SidebarProps) {
  const { data: badges } = useSidebarBadges();
  const formationActive = useFormation((s) => s.active);
  const startTour = useTour((s) => s.start);
  const showViewAs = (realRoleCode ?? roleCode) === 'direction' || (realRoleCode ?? roleCode) === 'chef_maintenance';
  const showFormation = showViewAs;
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className={cn('h-full flex flex-col', compact ? 'p-2 gap-0.5' : 'p-5 px-3.5 gap-1.5')}>
      <div className={cn('flex items-center flex-shrink-0', compact ? 'justify-center py-3 px-0' : 'px-2.5 pt-2 pb-4')}>
        {compact ? (
          <Logo size="sm" withText={false} />
        ) : (
          <Logo subtitle={`by Nikito · ${roleAffiche}`} />
        )}
      </div>

      <div className={cn('flex items-center gap-1 flex-shrink-0', compact ? 'justify-center' : 'px-1')}>
        <NotificationBell compact={compact} onNavClick={onNavClick} />
        {showFormation && (
          <NavLink
            to="/gmao/formation"
            onClick={onNavClick}
            title="Formation"
            className={({ isActive }) =>
              cn(
                'group relative flex items-center justify-center rounded-[10px] transition-colors w-[40px] min-h-[40px] flex-shrink-0',
                isActive
                  ? 'bg-[#7C3AED]/15 text-[#A78BFA]'
                  : formationActive
                    ? 'text-[#A78BFA] hover:text-text hover:bg-[#7C3AED]/10'
                    : 'text-dim hover:text-text hover:bg-white/[0.04]'
              )
            }
          >
            <GraduationCapIcon className="w-[18px] h-[18px] flex-shrink-0" />
            {compact && (
              <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-bg-card text-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-white/[0.08]">
                Formation
              </span>
            )}
          </NavLink>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
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
                const badge = resolveBadge(item, badges);
                const tourKey = TOUR_KEYS[item.label];
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavClick}
                    title={compact ? item.label : undefined}
                    {...(tourKey ? { 'data-tour': tourKey } : {})}
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
                            {badge && (
                              <span
                                className={cn(
                                  'ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-lg text-bg-app',
                                  badge.tone === 'red' ? 'bg-red' : 'bg-amber'
                                )}
                              >
                                {badge.count}
                              </span>
                            )}
                          </>
                        )}
                        {compact && badge && (
                          <span
                            className={cn(
                              'absolute top-1.5 right-1.5 w-2 h-2 rounded-full',
                              badge.tone === 'red' ? 'bg-red' : 'bg-amber'
                            )}
                          />
                        )}
                        {compact && (
                          <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-bg-card text-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-white/[0.08]">
                            {item.label}
                            {badge && (
                              <span className={cn('ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded text-bg-app', badge.tone === 'red' ? 'bg-red' : 'bg-amber')}>
                                {badge.count}
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
      </div>

      {onToggle && (
        <div className={cn('flex-shrink-0', compact ? 'px-2' : 'px-2.5')}>
          <button
            onClick={onToggle}
            className={cn(
              'hidden md:flex items-center gap-2.5 rounded-[10px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors min-h-[40px] w-full',
              compact ? 'justify-center px-0' : 'px-3'
            )}
            title={compact ? 'Etendre la sidebar' : 'Reduire la sidebar'}
          >
            <IconToggleSidebar className={cn('w-[18px] h-[18px] flex-shrink-0 transition-transform', compact && 'rotate-180')} />
            {!compact && <span className="text-[12px]">Reduire</span>}
          </button>
        </div>
      )}

      <div className={cn('border-t border-white/[0.06] flex-shrink-0 relative', compact ? 'pt-3 pb-2' : 'pt-3.5 px-2.5')}>
        <button
          onClick={() => setUserMenuOpen((o) => !o)}
          title={compact ? `${user.nom} · ${user.role}` : undefined}
          className={cn(
            'group relative flex items-center rounded-[10px] transition-colors min-h-[44px] w-full',
            compact ? 'justify-center px-0' : 'gap-2.5 px-1',
            userMenuOpen ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
          )}
        >
          <div
            className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0"
            style={{ background: user.couleurAvatar ?? '#5DE5FF', color: '#0B0B2E' }}
          >
            {user.initiales}
          </div>
          {!compact && (
            <div className="text-xs min-w-0 flex-1 text-left">
              <div className="font-medium truncate">{user.nom}</div>
              <div className="text-dim text-[11px] truncate">{user.role}</div>
            </div>
          )}
          {!compact && (
            <svg
              className={cn(
                'w-4 h-4 text-dim transition-transform ml-auto flex-shrink-0',
                userMenuOpen && 'rotate-180'
              )}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          )}
          {compact && (
            <span className="pointer-events-none absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-bg-card text-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg border border-white/[0.08]">
              {user.nom}
            </span>
          )}
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-bg-card border border-white/[0.08] rounded-xl shadow-xl z-50 py-2 px-1.5">
            {showViewAs && (
              <div className="px-1.5 mb-1">
                <ViewAsSelector />
              </div>
            )}

            <NavLink
              to="/gmao/profil"
              onClick={() => { setUserMenuOpen(false); onNavClick?.(); }}
              data-tour="profil"
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-[10px] transition-colors min-h-[38px] w-full gap-2.5 px-3',
                  isActive
                    ? 'bg-gradient-active border-l-2 border-nikito-pink text-text font-medium'
                    : 'text-dim hover:text-text hover:bg-white/[0.04]'
                )
              }
            >
              <svg className="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="10" cy="7" r="3.5" />
                <path d="M3 17.5c0-3 3.13-5.5 7-5.5s7 2.5 7 5.5" strokeLinecap="round" />
              </svg>
              <span className="text-[12px]">Mon profil</span>
            </NavLink>

            <NavLink
              to="/gmao/aide"
              onClick={() => { setUserMenuOpen(false); onNavClick?.(); }}
              data-tour="aide"
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-[10px] transition-colors min-h-[38px] w-full gap-2.5 px-3',
                  isActive
                    ? 'bg-gradient-active border-l-2 border-nikito-pink text-text font-medium'
                    : 'text-dim hover:text-text hover:bg-white/[0.04]'
                )
              }
            >
              <IconAide className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="text-[12px]">Aide</span>
            </NavLink>

            <button
              onClick={() => { setUserMenuOpen(false); startTour(); }}
              className="flex items-center rounded-[10px] text-dim hover:text-nikito-cyan hover:bg-nikito-cyan/5 transition-colors min-h-[38px] w-full gap-2.5 px-3"
            >
              <GraduationCapTourIcon className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="text-[12px]">Visite guidee</span>
            </button>

            {onSignOut && (
              <>
                <div className="h-px bg-white/[0.06] mx-2 my-1" />
                <button
                  onClick={() => { setUserMenuOpen(false); onSignOut(); }}
                  className="flex items-center rounded-[10px] text-dim hover:text-red hover:bg-red/10 transition-colors min-h-[38px] w-full gap-2.5 px-3"
                >
                  <IconDeconnexion className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="text-[12px]">Se deconnecter</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GraduationCapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L1 7l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M15 9.5v5c0 1.5-2.5 3-5 3s-5-1.5-5-3v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function GraduationCapTourIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L1 7l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M15 9.5v5c0 1.5-2.5 3-5 3s-5-1.5-5-3v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
