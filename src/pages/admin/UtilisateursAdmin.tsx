import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ModaleInviterUtilisateur } from '@/components/admin/ModaleInviterUtilisateur';
import { useAuth } from '@/hooks/useAuth';
import { roleLabels } from '@/lib/tokens';
import { useParcs } from '@/hooks/queries/useReferentiel';
import type { RoleUtilisateur } from '@/types/database';
import {
  useCompteursRoles,
  useUtilisateursActifs,
  useUtilisateursAValider,
  useUtilisateursDesactives,
  useInvitationsEnCours,
  useAnnulerInvitation,
  useSupprimerUtilisateur,
  type UtilisateurRow,
  type InvitationRow,
} from '@/hooks/queries/useUtilisateurs';

type Tab = 'a_valider' | 'actifs' | 'invitations' | 'desactives';

const roleBadgeColors: Record<RoleUtilisateur, string> = {
  direction: 'bg-nikito-cyan/15 text-nikito-cyan',
  chef_maintenance: 'bg-nikito-pink/15 text-nikito-pink',
  manager_parc: 'bg-amber/15 text-amber',
  technicien: 'bg-green/15 text-green',
  staff_operationnel: 'bg-faint/20 text-dim',
};

export function UtilisateursAdmin() {
  const { utilisateur } = useAuth();
  const [tab, setTab] = useState<Tab>('actifs');
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const { data: compteurs } = useCompteursRoles();
  const { data: aValider } = useUtilisateursAValider();

  const peutInviter =
    utilisateur?.role_code === 'direction' ||
    utilisateur?.role_code === 'chef_maintenance' ||
    utilisateur?.role_code === 'manager_parc';

  const nbAValider = aValider?.length ?? 0;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Utilisateurs</h1>
          <div className="text-[13px] text-dim mt-1">
            Gestion comptes, invitations, attribution roles et parcs
          </div>
        </div>
        {peutInviter && (
          <button
            onClick={() => setModaleOuverte(true)}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center sm:justify-start"
          >
            <span className="text-base">+</span> Inviter un utilisateur
          </button>
        )}
      </div>

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-[18px] border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <TabButton actif={tab === 'a_valider'} onClick={() => setTab('a_valider')} badge={nbAValider}>
            A valider
          </TabButton>
          <TabButton actif={tab === 'actifs'} onClick={() => setTab('actifs')}>
            Actifs
          </TabButton>
          <TabButton actif={tab === 'invitations'} onClick={() => setTab('invitations')}>
            Invitations
          </TabButton>
          <TabButton actif={tab === 'desactives'} onClick={() => setTab('desactives')}>
            Desactives
          </TabButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-2.5 mb-[18px]">
        <StatBox label="Direction" value={compteurs?.direction ?? 0} />
        <StatBox label="Chef + Manager" value={compteurs?.chefManager ?? 0} />
        <StatBox label="Techniciens" value={compteurs?.techniciens ?? 0} />
        <StatBox label="Staff (PIN)" value={compteurs?.staff ?? 0} />
      </div>

      <div className="bg-bg-card rounded-2xl py-4 px-4 md:py-5 md:px-5">
        {tab === 'a_valider' && <ListeAValider />}
        {tab === 'actifs' && <ListeActifs />}
        {tab === 'invitations' && <ListeInvitations />}
        {tab === 'desactives' && <ListeDesactives />}
      </div>

      <ModaleInviterUtilisateur
        open={modaleOuverte}
        onClose={() => setModaleOuverte(false)}
        roleInviteur={utilisateur?.role_code ?? 'direction'}
        parcsInviteur={utilisateur?.parc_ids ?? []}
      />
    </div>
  );
}

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
        'px-3 md:px-4 py-2.5 text-[13px] whitespace-nowrap min-h-[44px]',
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

function Avatar({ prenom, nom }: { prenom: string; nom: string }) {
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-bg-deep border border-white/[0.08] flex items-center justify-center text-[11px] font-bold text-dim shrink-0">
      {initials}
    </div>
  );
}

function RoleBadge({ code }: { code: RoleUtilisateur }) {
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', roleBadgeColors[code] ?? 'bg-bg-deep text-dim')}>
      {roleLabels[code] ?? code}
    </span>
  );
}

function ParcBadges({ parcs }: { parcs: { code: string }[] }) {
  if (parcs.length === 0) return <span className="text-[10px] text-faint">--</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {parcs.map((p) => (
        <span key={p.code} className="text-[10px] font-semibold bg-bg-deep border border-white/[0.06] text-dim px-1.5 py-0.5 rounded">
          {p.code}
        </span>
      ))}
    </div>
  );
}

function UserRow({
  user,
  onSupprimer,
  supprimant,
}: {
  user: UtilisateurRow;
  onSupprimer?: () => void;
  supprimant?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-white/[0.04] last:border-b-0">
      <Avatar prenom={user.prenom} nom={user.nom} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium truncate">
            {user.prenom} {user.nom}
          </span>
          <RoleBadge code={user.role_code} />
        </div>
        <div className="text-[11px] text-dim truncate mt-0.5">
          {user.email || user.auth_mode === 'pin_seul' ? (user.email || 'Connexion PIN') : '--'}
        </div>
      </div>
      <ParcBadges parcs={user.parcs} />
      {onSupprimer && (
        <button
          onClick={onSupprimer}
          disabled={supprimant}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-bg-deep border border-white/[0.08] text-red hover:border-red/30 transition-colors disabled:opacity-40 shrink-0"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

function EmptyState({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="text-dim text-sm text-center py-8">
      {text}
      {sub && (
        <>
          <br />
          <span className="text-xs">{sub}</span>
        </>
      )}
    </div>
  );
}

function ListeActifs() {
  const { utilisateur } = useAuth();
  const { data, isLoading } = useUtilisateursActifs();
  const supprimerMutation = useSupprimerUtilisateur();
  const isDirection = utilisateur?.role_code === 'direction';

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) return <EmptyState text="Aucun utilisateur actif." />;

  const supprimer = (id: string, nom: string) => {
    if (confirm(`Desactiver le compte de ${nom} ?`)) {
      supprimerMutation.mutate(id);
    }
  };

  return (
    <div>
      {data.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          onSupprimer={isDirection && u.id !== utilisateur?.id ? () => supprimer(u.id, `${u.prenom} ${u.nom}`) : undefined}
          supprimant={supprimerMutation.isPending}
        />
      ))}
    </div>
  );
}

function ListeAValider() {
  const { data, isLoading } = useUtilisateursAValider();

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        text="Aucune inscription en attente."
        sub="Les utilisateurs apparaissent ici apres avoir clique sur leur lien d'invitation."
      />
    );
  }

  return (
    <div>
      {data.map((u) => (
        <UserRow key={u.id} user={u} />
      ))}
    </div>
  );
}

function ListeDesactives() {
  const { data, isLoading } = useUtilisateursDesactives();

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) return <EmptyState text="Aucun compte desactive." />;

  return (
    <div>
      {data.map((u) => (
        <UserRow key={u.id} user={u} />
      ))}
    </div>
  );
}

function ListeInvitations() {
  const { data, isLoading } = useInvitationsEnCours();
  const { data: parcs } = useParcs();
  const annulerMutation = useAnnulerInvitation();

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) return <EmptyState text="Aucune invitation en cours." />;

  const parcMap = new Map((parcs ?? []).map((p) => [p.id, p.code]));

  const copierLien = async (token: string) => {
    await navigator.clipboard.writeText(`https://nikito.tech/invitation/${token}`);
  };

  const annuler = (id: string) => {
    if (confirm('Annuler cette invitation ?')) {
      annulerMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-2">
      {data.map((inv) => (
        <InvitationCard
          key={inv.id}
          inv={inv}
          parcMap={parcMap}
          onCopier={() => copierLien(inv.token)}
          onAnnuler={() => annuler(inv.id)}
          annulant={annulerMutation.isPending}
        />
      ))}
    </div>
  );
}

function InvitationCard({
  inv,
  parcMap,
  onCopier,
  onAnnuler,
  annulant,
}: {
  inv: InvitationRow;
  parcMap: Map<string, string>;
  onCopier: () => void;
  onAnnuler: () => void;
  annulant: boolean;
}) {
  const [copie, setCopie] = useState(false);

  const handleCopier = async () => {
    await onCopier();
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const parcCodes = (inv.parcs_assignes ?? [])
    .map((id) => parcMap.get(id))
    .filter(Boolean) as string[];

  const inviteLe = new Date(inv.invite_le).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
  const expireLe = new Date(inv.expire_le).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="bg-bg-deep rounded-xl p-3.5 border border-white/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar prenom={inv.prenom} nom={inv.nom} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium">
                {inv.prenom} {inv.nom}
              </span>
              <RoleBadge code={inv.role_code} />
            </div>
            <div className="text-[11px] text-dim mt-0.5 truncate">
              {inv.email ?? 'PIN (pas d\'email)'}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-faint">
                Envoye le {inviteLe}
              </span>
              <span className="text-[10px] text-faint">
                Expire le {expireLe}
              </span>
            </div>
            {parcCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {parcCodes.map((c) => (
                  <span key={c} className="text-[10px] font-semibold bg-bg-card border border-white/[0.06] text-dim px-1.5 py-0.5 rounded">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleCopier}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-bg-card border border-white/[0.08] text-nikito-cyan hover:border-nikito-cyan/30 transition-colors"
          >
            {copie ? 'Copie !' : 'Copier le lien'}
          </button>
          <button
            onClick={onAnnuler}
            disabled={annulant}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-bg-card border border-white/[0.08] text-red hover:border-red/30 transition-colors disabled:opacity-40"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
