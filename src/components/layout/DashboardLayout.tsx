import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { roleLabels } from '@/lib/tokens';

const roleAffiches: Record<string, string> = {
  direction: 'DIRECTION',
  chef_maintenance: "CHEF D'ÉQUIPE",
  manager_parc: 'MANAGER PARC',
  technicien: 'TECHNICIEN',
  staff_operationnel: 'STAFF',
};

export function DashboardLayout() {
  const { utilisateur, loading } = useAuth();

  // Mock fallback pour développement (à retirer une fois Supabase Auth branché)
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
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-bg-app text-text">
      <Sidebar
        user={user}
        roleAffiche={roleAffiches[user.role_code] ?? 'UTILISATEUR'}
        roleCode={user.role_code}
      />
      <main className="overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
