import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ModaleInviterUtilisateur } from '@/components/admin/ModaleInviterUtilisateur';
import { useAuth } from '@/hooks/useAuth';
import { roleLabels } from '@/lib/tokens';

// ============================================================
// Page Admin · Utilisateurs
// 4 onglets : À valider · Actifs · Invitations envoyées · Désactivés
// Bouton "Inviter un utilisateur" → ModaleInviterUtilisateur
// ============================================================

type Tab = 'a_valider' | 'actifs' | 'invitations' | 'desactives';

export function UtilisateursAdmin() {
  const { utilisateur } = useAuth();
  const [tab, setTab] = useState<Tab>('a_valider');
  const [modaleOuverte, setModaleOuverte] = useState(false);

  const peutInviter =
    utilisateur?.role_code === 'direction' ||
    utilisateur?.role_code === 'chef_maintenance' ||
    utilisateur?.role_code === 'manager_parc';

  return (
    <div className="p-6 px-7">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Utilisateurs</h1>
          <div className="text-[13px] text-dim mt-1">
            Gestion comptes · invitations · attribution rôles et parcs
          </div>
        </div>
        {peutInviter && (
          <button
            onClick={() => setModaleOuverte(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2"
          >
            <span className="text-base">+</span> Inviter un utilisateur
          </button>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1.5 mb-[18px] border-b border-white/[0.06]">
        <TabButton actif={tab === 'a_valider'} onClick={() => setTab('a_valider')} badge={0}>
          À valider
        </TabButton>
        <TabButton actif={tab === 'actifs'} onClick={() => setTab('actifs')}>
          Actifs
        </TabButton>
        <TabButton actif={tab === 'invitations'} onClick={() => setTab('invitations')}>
          Invitations envoyées
        </TabButton>
        <TabButton actif={tab === 'desactives'} onClick={() => setTab('desactives')}>
          Désactivés
        </TabButton>
      </div>

      {/* Stats compactes */}
      <div className="grid grid-cols-4 gap-2.5 mb-[18px]">
        <StatBox label="Direction" value={1} />
        <StatBox label="Chef + Manager" value={5} />
        <StatBox label="Techniciens" value={5} />
        <StatBox label="Staff (PIN)" value={21} />
      </div>

      {/* Contenu selon onglet */}
      <div className="bg-bg-card rounded-2xl py-5 px-5">
        {tab === 'a_valider' && <ListeAValider />}
        {tab === 'actifs' && <ListeActifs />}
        {tab === 'invitations' && <ListeInvitations />}
        {tab === 'desactives' && <ListeDesactives />}
      </div>

      {/* Modale invitation */}
      <ModaleInviterUtilisateur
        open={modaleOuverte}
        onClose={() => setModaleOuverte(false)}
        roleInviteur={utilisateur?.role_code ?? 'direction'}
        parcsInviteur={utilisateur?.parc_ids ?? []}
      />
    </div>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function TabButton({
  actif,
  onClick,
  badge,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-[13px]',
        actif
          ? 'text-text font-semibold border-b-2 border-nikito-pink'
          : 'text-dim hover:text-text'
      )}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="bg-amber text-bg-app text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-1.5">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-card rounded-[10px] py-3 px-3.5">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ListeAValider() {
  // TODO Bolt · charger via useQuery sur invitations.utilise_le NOT NULL AND utilisateurs.statut_validation='en_attente'
  return (
    <div className="text-dim text-sm text-center py-8">
      Aucune inscription en attente.
      <br />
      <span className="text-xs">Les utilisateurs apparaissent ici après avoir cliqué sur leur lien d'invitation.</span>
    </div>
  );
}

function ListeActifs() {
  // TODO Bolt · table utilisateurs où statut_validation='valide'
  return (
    <div className="text-dim text-sm">
      {/* Liste des utilisateurs actifs avec leurs rôle, parcs, dernière connexion */}
      Liste à charger via useUtilisateursActifs()
    </div>
  );
}

function ListeInvitations() {
  // TODO Bolt · table invitations où utilise_le IS NULL AND expire_le > NOW()
  return (
    <div className="text-dim text-sm">
      Liste invitations en cours, avec bouton "Renvoyer le lien" et "Annuler"
    </div>
  );
}

function ListeDesactives() {
  // TODO Bolt · utilisateurs où statut_validation='desactive'
  return <div className="text-dim text-sm">Aucun compte désactivé</div>;
}
