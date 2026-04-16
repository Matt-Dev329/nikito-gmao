import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { roleLabels } from '@/lib/tokens';
import { cn } from '@/lib/utils';

const roleAffiches: Record<string, string> = {
  direction: 'DIRECTION',
  chef_maintenance: "CHEF D'ÉQUIPE",
  manager_parc: 'MANAGER PARC',
  technicien: 'TECHNICIEN',
  staff_operationnel: 'STAFF',
};

export function DashboardLayout() {
  const { utilisateur, loading } = useAuth();
  const [sidebarOuverte, setSidebarOuverte] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app text-text">
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-bg-sidebar border-b border-white/[0.06] px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setSidebarOuverte(true)}
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

      {sidebarOuverte && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setSidebarOuverte(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-[260px] bg-bg-sidebar border-r border-white/[0.06]',
          'transition-transform duration-300 ease-out',
          'md:sticky md:translate-x-0 md:z-auto',
          sidebarOuverte ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setSidebarOuverte(false)}
          className="md:hidden absolute top-4 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-dim"
          aria-label="Fermer le menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L15 15M15 1L1 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <Sidebar
          user={user}
          roleAffiche={roleAffiches[user.role_code] ?? 'UTILISATEUR'}
          roleCode={user.role_code}
          onNavClick={() => setSidebarOuverte(false)}
        />
      </aside>

      <div className="md:ml-[260px]">
        <main className="pt-14 md:pt-0 min-h-screen overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
