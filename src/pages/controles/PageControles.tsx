import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { RoleUtilisateur } from '@/types/database';

interface Entree {
  to: string;
  titre: string;
  detail: string;
  icone: string;
  roles: RoleUtilisateur[];
}

/** Tous les contrôles pour tous les rôles internes (le staff garde ses écrans dédiés) */
const TOUS: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'];

const ENTREES: Entree[] = [
  { to: '/staff/controle-ouverture', titre: 'Contrôle d’ouverture', detail: 'Contrôle quotidien avant ouverture', icone: '☀️', roles: TOUS },
  { to: '/tech/controle-hebdo', titre: 'Contrôle hebdo technique', detail: 'Contrôle technique de la semaine', icone: '🗓️', roles: TOUS },
  { to: '/staff/controle-hebdo', titre: 'Contrôle hebdo staff', detail: 'Contrôle de la semaine du staff', icone: '🗓️', roles: TOUS },
  { to: '/tech/controle-mensuel', titre: 'Contrôle mensuel', detail: 'Contrôle technique du mois', icone: '📅', roles: TOUS },
  {
    to: '/gmao/controles-historique',
    titre: 'Historique des contrôles',
    detail: 'Contrôles réalisés, anomalies, photos et PDF',
    icone: '📋',
    roles: TOUS,
  },
];

/** Point d'entrée « Contrôles » (téléphone) : faire un contrôle ou consulter l'historique. */
export function PageControles() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const role = useEffectiveRole(utilisateur?.role_code ?? 'technicien');
  const entrees = ENTREES.filter((e) => e.roles.includes(role));

  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-xl md:text-[22px] font-semibold m-0">Contrôles</h1>
      <p className="text-[13px] text-dim mt-1 mb-4">Faire un contrôle ou consulter ceux déjà réalisés</p>
      <div className="grid gap-2.5 sm:grid-cols-2 max-w-[720px]">
        {entrees.map((e) => (
          <button
            key={e.to}
            onClick={() => navigate(e.to)}
            className="bg-bg-card border border-white/[0.06] rounded-xl p-4 flex items-center gap-3.5 text-left min-h-[72px] active:scale-[0.99] transition-transform"
          >
            <span className="text-2xl" aria-hidden>
              {e.icone}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold">{e.titre}</span>
              <span className="block text-[12px] text-dim mt-0.5">{e.detail}</span>
            </span>
            <span className="text-nikito-cyan text-lg" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
