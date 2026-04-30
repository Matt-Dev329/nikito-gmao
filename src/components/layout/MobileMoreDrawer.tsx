import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getNavIcon } from './NavIcons';
import type { RoleUtilisateur } from '@/types/database';

interface MobileMoreDrawerProps {
  open: boolean;
  onClose: () => void;
  roleCode: RoleUtilisateur;
  onSignOut: () => void;
}

interface DrawerItem {
  to: string;
  label: string;
  iconLabel: string;
  roles: RoleUtilisateur[];
}

const pilotageItems: DrawerItem[] = [
  { to: '/gmao/equipements', label: 'Equipements', iconLabel: 'Équipements', roles: ['direction', 'chef_maintenance', 'technicien', 'manager_parc', 'admin_it'] },
  { to: '/gmao/ia-predictive', label: 'IA Predictive', iconLabel: 'IA Prédictive', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/flotte', label: 'Flotte', iconLabel: 'Flotte', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/recurrences', label: 'Recurrences', iconLabel: 'Récurrences', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/cinq-pourquoi', label: '5 Pourquoi', iconLabel: '5 Pourquoi', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/stock', label: 'Stock', iconLabel: 'Stock', roles: ['direction', 'chef_maintenance', 'technicien', 'admin_it'] },
  { to: '/gmao/preventif', label: 'Preventif', iconLabel: 'Préventif', roles: ['direction', 'chef_maintenance', 'manager_parc', 'admin_it'] },
  { to: '/gmao/certifications', label: 'Certifications', iconLabel: 'Certifications', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/plaintes', label: 'Plaintes clients', iconLabel: 'Plaintes clients', roles: ['direction', 'chef_maintenance', 'manager_parc', 'admin_it'] },
  { to: '/gmao/controles-historique', label: 'Historique controles', iconLabel: 'Contrôles', roles: ['direction', 'chef_maintenance', 'admin_it'] },
];

const configItems: DrawerItem[] = [
  { to: '/gmao/parcs', label: 'Parcs', iconLabel: 'Parcs', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/utilisateurs', label: 'Utilisateurs', iconLabel: 'Utilisateurs', roles: ['direction', 'chef_maintenance', 'manager_parc', 'admin_it'] },
  { to: '/gmao/bibliotheque', label: 'Bibliotheque points', iconLabel: 'Bibliothèque points', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/fournisseurs', label: 'Fournisseurs', iconLabel: 'Fournisseurs', roles: ['direction', 'chef_maintenance', 'admin_it'] },
  { to: '/gmao/it-admin', label: 'Administration IT', iconLabel: 'Administration IT', roles: ['direction', 'admin_it'] },
];

const accountItems: DrawerItem[] = [
  { to: '/gmao/profil', label: 'Profil', iconLabel: 'Utilisateurs', roles: ['direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel', 'admin_it'] },
  { to: '/gmao/aide', label: 'Aide', iconLabel: 'Aide', roles: ['direction', 'chef_maintenance', 'manager_parc', 'technicien', 'staff_operationnel', 'admin_it'] },
];

export function MobileMoreDrawer({ open, onClose, roleCode, onSignOut }: MobileMoreDrawerProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  const handleNav = (to: string) => {
    onClose();
    navigate(to);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  }, [dragging]);

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
  }, [dragY, onClose]);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const filterByRole = (items: DrawerItem[]) => items.filter((it) => it.roles.includes(roleCode));

  const visiblePilotage = filterByRole(pilotageItems);
  const visibleConfig = filterByRole(configItems);
  const visibleAccount = filterByRole(accountItems);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/60 z-[110] transition-opacity duration-250',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        className={cn(
          'fixed left-0 right-0 bottom-0 z-[111] bg-[#0a0e27] rounded-t-2xl max-h-[85vh] flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{
          transform: open
            ? `translateY(${dragY}px)`
            : 'translateY(100%)',
          transition: dragging ? 'none' : undefined,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          className="flex-shrink-0 pt-3 pb-2 flex justify-center cursor-grab"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {visiblePilotage.length > 0 && (
            <Section title="Pilotage">
              {visiblePilotage.map((item) => (
                <DrawerRow
                  key={item.to}
                  item={item}
                  active={pathname.startsWith(item.to)}
                  onClick={() => handleNav(item.to)}
                />
              ))}
            </Section>
          )}

          {visibleConfig.length > 0 && (
            <Section title="Configuration">
              {visibleConfig.map((item) => (
                <DrawerRow
                  key={item.to}
                  item={item}
                  active={pathname.startsWith(item.to)}
                  onClick={() => handleNav(item.to)}
                />
              ))}
            </Section>
          )}

          <Section title="Compte">
            {visibleAccount.map((item) => (
              <DrawerRow
                key={item.to}
                item={item}
                active={pathname === item.to}
                onClick={() => handleNav(item.to)}
              />
            ))}
            <button
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="flex items-center gap-3 w-full px-3 min-h-[48px] rounded-xl text-red hover:bg-red/10 transition-colors"
            >
              <LogoutIcon />
              <span className="text-[14px] font-medium">Se deconnecter</span>
            </button>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] text-faint uppercase tracking-[1.4px] px-3 pt-3 pb-1.5">{title}</div>
      {children}
    </div>
  );
}

function DrawerRow({ item, active, onClick }: { item: DrawerItem; active: boolean; onClick: () => void }) {
  const Icon = getNavIcon(item.iconLabel);
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full px-3 min-h-[48px] rounded-xl transition-colors',
        active
          ? 'bg-gradient-active text-text font-medium'
          : 'text-dim hover:text-text hover:bg-white/[0.04]'
      )}
    >
      <Icon className={cn('w-[20px] h-[20px] flex-shrink-0', active && 'text-nikito-pink')} />
      <span className="text-[14px]">{item.label}</span>
    </button>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-[20px] h-[20px] flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3M13 14l4-4-4-4M17 10H7" />
    </svg>
  );
}
