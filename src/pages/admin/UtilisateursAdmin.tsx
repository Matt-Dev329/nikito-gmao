import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/ToastProvider';
import { ROLES_GESTION_COMPTES, peutGererCompte } from '@/lib/acces';
import type { UtilisateurMetier } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { ModaleInviterUtilisateur } from '@/components/admin/ModaleInviterUtilisateur';
import { ModaleEditerUtilisateur } from '@/components/admin/ModaleEditerUtilisateur';
import { useAuth } from '@/hooks/useAuth';
import { useViewAs, useEffectiveRole } from '@/hooks/useViewAs';
import { roleLabels } from '@/lib/tokens';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { SignalerInlineButton } from '@/components/shared/SignalerInlineButton';
import type { RoleUtilisateur } from '@/types/database';
import {
  useCompteursRoles,
  useUtilisateursActifs,
  useUtilisateursAValider,
  useUtilisateursDesactives,
  useInvitationsEnCours,
  useAnnulerInvitation,
  useSupprimerUtilisateur,
  useReactiverUtilisateur,
  type UtilisateurRow,
  type InvitationRow,
} from '@/hooks/queries/useUtilisateurs';

/** Compte modifiable par l'utilisateur connecté (à hauteur de grade, ses parcs) — jamais le sien */
function peutGererUtilisateur(moi: UtilisateurMetier | null, u: UtilisateurRow): boolean {
  return (
    !!moi &&
    u.id !== moi.id &&
    peutGererCompte(moi, u.role_code, u.parcs.map((p) => p.parc_id), u.parcs.some((p) => p.est_manager))
  );
}

type Tab = 'a_valider' | 'actifs' | 'invitations' | 'desactives';

const roleBadgeColors: Record<RoleUtilisateur, string> = {
  direction: 'bg-nikito-cyan/15 text-nikito-cyan',
  chef_maintenance: 'bg-nikito-pink/15 text-nikito-pink',
  directeur_parc: 'bg-nikito-pink/15 text-nikito-pink',
  manager_parc: 'bg-amber/15 text-amber',
  technicien: 'bg-green/15 text-green',
  staff_operationnel: 'bg-faint/20 text-dim',
  admin_it: 'bg-nikito-violet/15 text-nikito-violet',
};

export function UtilisateursAdmin() {
  const { utilisateur } = useAuth();
  const effectiveRole = useEffectiveRole(utilisateur?.role_code ?? 'staff_operationnel');
  const [tab, setTab] = useState<Tab>('actifs');
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [recherche, setRecherche] = useState('');
  const { data: compteurs } = useCompteursRoles();
  const { data: aValider } = useUtilisateursAValider();

  const peutInviter = ROLES_GESTION_COMPTES.includes(effectiveRole);

  const nbAValider = aValider?.length ?? 0;

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Utilisateurs</h1>
          <div className="text-[13px] text-dim mt-1">
            Gestion comptes, invitations, attribution roles et parcs
          </div>
        </div>
        <div className="flex items-center gap-2">
          {peutInviter && (
            <button
              onClick={() => setModaleOuverte(true)}
              className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center sm:justify-start"
            >
              <span className="text-base">+</span> Inviter un utilisateur
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 ml-1">
            <div className="h-8 w-px bg-white/[0.08]" />
            <SignalerInlineButton />
          </div>
        </div>
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

      <div className="relative mb-3">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher par nom, prenom ou email..."
          className="w-full bg-bg-card border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-text outline-none focus:border-nikito-cyan/50 min-h-[44px] placeholder:text-dim"
        />
      </div>

      <div className="bg-bg-card rounded-2xl py-4 px-4 md:py-5 md:px-5">
        {tab === 'a_valider' && <ListeAValider recherche={recherche} />}
        {tab === 'actifs' && <ListeActifs recherche={recherche} />}
        {tab === 'invitations' && <ListeInvitations recherche={recherche} />}
        {tab === 'desactives' && <ListeDesactives recherche={recherche} />}
      </div>

      <ModaleInviterUtilisateur
        open={modaleOuverte}
        onClose={() => setModaleOuverte(false)}
        roleInviteur={effectiveRole}
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

function Avatar({ prenom, nom }: { prenom: string | null; nom: string | null }) {
  const initials = `${(prenom ?? '?').charAt(0)}${(nom ?? '?').charAt(0)}`.toUpperCase();
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
  onViewAs,
  onEditer,
  onReactiver,
  reactivant,
  onEnvoyerPin,
  envoiPin,
}: {
  user: UtilisateurRow;
  onEnvoyerPin?: () => void;
  envoiPin?: boolean;
  onSupprimer?: () => void;
  supprimant?: boolean;
  onViewAs?: () => void;
  onEditer?: () => void;
  onReactiver?: () => void;
  reactivant?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-white/[0.04] last:border-b-0">
      <div
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onEditer}
      >
        <Avatar prenom={user.prenom} nom={user.nom} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium truncate">
              {user.prenom} {user.nom}
            </span>
            <RoleBadge code={user.role_code} />
            {user.parcs.some((p) => p.est_manager) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber/15 text-amber">
                MGR
              </span>
            )}
          </div>
          <div className="text-[11px] text-dim truncate mt-0.5">
            {user.email || user.auth_mode === 'pin_seul' ? (user.email || 'Connexion PIN') : '--'}
          </div>
        </div>
        <ParcBadges parcs={user.parcs} />
      </div>
      <div className="flex gap-1.5 shrink-0">
        {onViewAs && (
          <button
            onClick={onViewAs}
            className="w-8 h-8 rounded-lg bg-bg-deep border border-white/[0.08] text-dim hover:text-amber hover:border-amber/30 transition-colors flex items-center justify-center"
            title={`Voir comme ${user.prenom}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 4.5C5.5 4.5 2 10 2 10s3.5 5.5 8 5.5 8-5.5 8-5.5-3.5-5.5-8-5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        )}
        {onEditer && (
          <button
            onClick={onEditer}
            className="w-8 h-8 rounded-lg bg-bg-deep border border-white/[0.08] text-dim hover:text-nikito-cyan hover:border-nikito-cyan/30 transition-colors flex items-center justify-center"
            title={`Modifier ${user.prenom}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.85 3.15a1.5 1.5 0 0 1 2.12 0l.88.88a1.5 1.5 0 0 1 0 2.12L7.5 16.5 3 17.5l1-4.5L14.85 3.15Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {onEnvoyerPin && (
          <button
            onClick={onEnvoyerPin}
            disabled={envoiPin}
            title="Envoyer un code de connexion par mail"
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-bg-deep border border-white/[0.08] text-nikito-cyan hover:border-nikito-cyan/30 transition-colors disabled:opacity-40"
          >
            {envoiPin ? '…' : '✉ Code'}
          </button>
        )}
        {onReactiver && (
          <button
            onClick={onReactiver}
            disabled={reactivant}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-bg-deep border border-white/[0.08] text-green hover:border-green/30 transition-colors disabled:opacity-40"
          >
            Reactiver
          </button>
        )}
        {onSupprimer && (
          <button
            onClick={onSupprimer}
            disabled={supprimant}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-bg-deep border border-white/[0.08] text-red hover:border-red/30 transition-colors disabled:opacity-40"
          >
            Desactiver
          </button>
        )}
      </div>
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

const roleHomePage: Record<RoleUtilisateur, string> = {
  direction: '/gmao',
  chef_maintenance: '/gmao',
  directeur_parc: '/gmao',
  technicien: '/gmao/operations',
  manager_parc: '/gmao/mon-parc',
  staff_operationnel: '/staff/controle-ouverture',
  admin_it: '/gmao/it-admin',
};

function filtrerUtilisateurs(users: UtilisateurRow[], q: string): UtilisateurRow[] {
  if (!q.trim()) return users;
  const lower = q.toLowerCase().trim();
  return users.filter((u) =>
    (u.prenom ?? '').toLowerCase().includes(lower) ||
    (u.nom ?? '').toLowerCase().includes(lower) ||
    (u.email ?? '').toLowerCase().includes(lower)
  );
}

const ORDRE_ROLES: RoleUtilisateur[] = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'staff_operationnel', 'admin_it'];

function ListeActifs({ recherche }: { recherche: string }) {
  const { utilisateur } = useAuth();
  const effectiveRole = useEffectiveRole(utilisateur?.role_code ?? 'staff_operationnel');
  const { data, isLoading } = useUtilisateursActifs();
  const { data: parcs } = useParcs();
  const supprimerMutation = useSupprimerUtilisateur();
  const { activate } = useViewAs();
  const navigate = useNavigate();
  const canViewAs = ['direction', 'admin_it', 'chef_maintenance', 'directeur_parc'].includes(effectiveRole);
  const gere = (u: UtilisateurRow) => peutGererUtilisateur(utilisateur, u);
  const [editUser, setEditUser] = useState<UtilisateurRow | null>(null);
  const [parcFiltre, setParcFiltre] = useState<string | null>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const [envoiPin, setEnvoiPin] = useState<Set<string>>(new Set());

  // Génère un nouveau code et l'envoie par mail : le code ne s'affiche jamais ici
  const envoyerPin = async (liste: UtilisateurRow[]) => {
    setEnvoiPin((s) => new Set([...s, ...liste.map((u) => u.id)]));
    let ok = 0;
    for (const u of liste) {
      const { data: rep, error } = await supabase.functions.invoke('envoyer-pin-staff', { body: { utilisateur_id: u.id } });
      if (error || rep?.success === false) toast.error(`${u.prenom} ${u.nom} : ${rep?.error ?? 'envoi impossible'}`);
      else ok++;
    }
    setEnvoiPin((s) => new Set([...s].filter((id) => !liste.some((u) => u.id === id))));
    if (ok) toast.success(ok > 1 ? `${ok} codes envoyés par mail` : `Code envoyé par mail à ${liste[0].prenom}`);
    qc.invalidateQueries({ queryKey: ['utilisateurs'] });
  };

  const filtres = useMemo(() => filtrerUtilisateurs(data ?? [], recherche), [data, recherche]);
  const sansCode = useMemo(
    () => (data ?? []).filter((u) => u.auth_mode === 'pin_seul' && u.email && !u.code_pin_genere_le && peutGererUtilisateur(utilisateur, u)),
    [data, utilisateur]
  );

  // Rangement par parc puis par rôle ; les personnes rattachées à plusieurs
  // parcs (ou à aucun, ex. direction) sont regroupées à part
  const groupes = useMemo(() => {
    const cleParc = (u: UtilisateurRow) =>
      u.parcs.length === 0 ? 'Tous les parcs' : u.parcs.length > 1 ? 'Plusieurs parcs' : u.parcs[0].code;
    const ordreParc = (c: string) => (c === 'Tous les parcs' ? '0' : c === 'Plusieurs parcs' ? '1' : `2${c}`);
    const m = new Map<string, Map<string, UtilisateurRow[]>>();
    filtres
      .filter((u) => !parcFiltre || cleParc(u) === parcFiltre || u.parcs.some((p) => p.code === parcFiltre))
      .forEach((u) => {
        const parc = parcFiltre && u.parcs.some((p) => p.code === parcFiltre) ? parcFiltre : cleParc(u);
        if (!m.has(parc)) m.set(parc, new Map());
        const parRole = m.get(parc)!;
        parRole.set(u.role_code, [...(parRole.get(u.role_code) ?? []), u]);
      });
    return [...m.entries()]
      .sort((a, b) => ordreParc(a[0]).localeCompare(ordreParc(b[0])))
      .map(([parc, parRole]) => ({
        parc,
        total: [...parRole.values()].reduce((n, l) => n + l.length, 0),
        roles: [...parRole.entries()].sort((a, b) => ORDRE_ROLES.indexOf(a[0] as RoleUtilisateur) - ORDRE_ROLES.indexOf(b[0] as RoleUtilisateur)),
      }));
  }, [filtres, parcFiltre]);
  const codesParcs = useMemo(
    () => [...new Set((data ?? []).flatMap((u) => u.parcs.map((p) => p.code)))].sort(),
    [data]
  );

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) return <EmptyState text="Aucun utilisateur actif." />;
  if (filtres.length === 0) return <EmptyState text={`Aucun resultat pour "${recherche}"`} />;

  const parcMap = new Map((parcs ?? []).map((p) => [p.id, p]));

  const supprimer = (id: string, nom: string) => {
    if (confirm(`Desactiver le compte de ${nom} ?`)) {
      supprimerMutation.mutate(id);
    }
  };

  const handleViewAs = (u: UtilisateurRow) => {
    const firstParc = u.parcs[0] ? parcMap.get(u.parcs[0].parc_id) : null;
    const parcLabel = firstParc ? `${firstParc.code} - ${firstParc.nom}` : null;
    activate(
      u.role_code,
      firstParc?.id ?? null,
      parcLabel,
      `${u.prenom} ${u.nom}`,
      u.parcs.some((p) => p.est_manager)
    );
    navigate(roleHomePage[u.role_code] ?? '/gmao');
  };

  return (
    <>
      {sansCode.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between mx-4 mt-3 p-3 rounded-xl bg-nikito-cyan/10 border border-nikito-cyan/30">
          <div className="text-[13px]">
            {sansCode.length} staff sans code de connexion :{' '}
            <span className="text-dim">{sansCode.map((u) => u.prenom).join(', ')}</span>
          </div>
          <button
            onClick={() => envoyerPin(sansCode)}
            disabled={envoiPin.size > 0}
            className="bg-gradient-cta text-text px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-50 shrink-0"
          >
            {envoiPin.size > 0 ? 'Envoi…' : '✉ Envoyer les codes par mail'}
          </button>
        </div>
      )}
      {codesParcs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-white/[0.06]">
          <button
            onClick={() => setParcFiltre(null)}
            className={cn('px-3 rounded-full text-[12px] min-h-[32px] border', !parcFiltre ? 'bg-nikito-cyan/15 border-nikito-cyan/50 text-nikito-cyan' : 'border-white/[0.08] text-dim')}
          >
            Tous
          </button>
          {codesParcs.map((c) => (
            <button
              key={c}
              onClick={() => setParcFiltre(c)}
              className={cn('px-3 rounded-full text-[12px] min-h-[32px] border', parcFiltre === c ? 'bg-nikito-cyan/15 border-nikito-cyan/50 text-nikito-cyan' : 'border-white/[0.08] text-dim')}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <div>
        {groupes.map((g) => (
          <section key={g.parc}>
            <div className="px-4 pt-4 pb-1.5 text-[12px] font-semibold text-nikito-cyan uppercase tracking-wider">
              {g.parc === 'Tous les parcs' || g.parc === 'Plusieurs parcs' ? g.parc : (parcs ?? []).find((p) => p.code === g.parc)?.nom ?? g.parc}{' '}
              <span className="text-faint font-normal">· {g.total}</span>
            </div>
            {g.roles.map(([role, liste]) => (
              <div key={role}>
                <div className="px-4 pt-2 pb-1 text-[11px] text-dim uppercase tracking-wider">
                  {roleLabels[role as RoleUtilisateur] ?? role} <span className="text-faint">· {liste.length}</span>
                </div>
                {liste.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onViewAs={canViewAs && u.id !== utilisateur?.id ? () => handleViewAs(u) : undefined}
                    onEditer={gere(u) ? () => setEditUser(u) : undefined}
                    onSupprimer={gere(u) ? () => supprimer(u.id, `${u.prenom} ${u.nom}`) : undefined}
                    supprimant={supprimerMutation.isPending}
                    onEnvoyerPin={
                      gere(u) && u.auth_mode === 'pin_seul' && u.email
                        ? () => {
                            if (!u.code_pin_genere_le || confirm(`Envoyer un nouveau code à ${u.prenom} ? L'ancien ne marchera plus.`)) envoyerPin([u]);
                          }
                        : undefined
                    }
                    envoiPin={envoiPin.has(u.id)}
                  />
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
      {editUser && (
        <ModaleEditerUtilisateur
          open={!!editUser}
          onClose={() => setEditUser(null)}
          utilisateur={editUser}
        />
      )}
    </>
  );
}

function ListeAValider({ recherche }: { recherche: string }) {
  const { utilisateur } = useAuth();
  const { data, isLoading } = useUtilisateursAValider();
  const [editUser, setEditUser] = useState<UtilisateurRow | null>(null);

  const filtres = useMemo(() => filtrerUtilisateurs(data ?? [], recherche), [data, recherche]);

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        text="Aucune inscription en attente."
        sub="Les utilisateurs apparaissent ici apres avoir clique sur leur lien d'invitation."
      />
    );
  }
  if (filtres.length === 0) return <EmptyState text={`Aucun resultat pour "${recherche}"`} />;

  return (
    <>
      <div>
        {filtres.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            onEditer={peutGererUtilisateur(utilisateur, u) ? () => setEditUser(u) : undefined}
          />
        ))}
      </div>
      {editUser && (
        <ModaleEditerUtilisateur
          open={!!editUser}
          onClose={() => setEditUser(null)}
          utilisateur={editUser}
        />
      )}
    </>
  );
}

function ListeDesactives({ recherche }: { recherche: string }) {
  const { utilisateur } = useAuth();
  const { data, isLoading } = useUtilisateursDesactives();
  const reactiverMutation = useReactiverUtilisateur();
  const [editUser, setEditUser] = useState<UtilisateurRow | null>(null);

  const filtres = useMemo(() => filtrerUtilisateurs(data ?? [], recherche), [data, recherche]);

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) return <EmptyState text="Aucun compte desactive." />;
  if (filtres.length === 0) return <EmptyState text={`Aucun resultat pour "${recherche}"`} />;

  const reactiver = (id: string, nom: string) => {
    if (confirm(`Reactiver le compte de ${nom} ?`)) {
      reactiverMutation.mutate(id);
    }
  };

  return (
    <>
      <div>
        {filtres.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            onEditer={peutGererUtilisateur(utilisateur, u) ? () => setEditUser(u) : undefined}
            onReactiver={peutGererUtilisateur(utilisateur, u) ? () => reactiver(u.id, `${u.prenom} ${u.nom}`) : undefined}
            reactivant={reactiverMutation.isPending}
          />
        ))}
      </div>
      {editUser && (
        <ModaleEditerUtilisateur
          open={!!editUser}
          onClose={() => setEditUser(null)}
          utilisateur={editUser}
        />
      )}
    </>
  );
}

function ListeInvitations({ recherche }: { recherche: string }) {
  const { data, isLoading } = useInvitationsEnCours();
  const { data: parcs } = useParcs();
  const annulerMutation = useAnnulerInvitation();

  const filtres = useMemo(() => {
    if (!data || !recherche.trim()) return data ?? [];
    const lower = recherche.toLowerCase().trim();
    return data.filter((inv) =>
      (inv.prenom ?? '').toLowerCase().includes(lower) ||
      (inv.nom ?? '').toLowerCase().includes(lower) ||
      (inv.email ?? '').toLowerCase().includes(lower)
    );
  }, [data, recherche]);

  if (isLoading) return <div className="text-dim text-sm text-center py-8">Chargement...</div>;
  if (!data || data.length === 0) return <EmptyState text="Aucune invitation en cours." />;
  if (filtres.length === 0) return <EmptyState text={`Aucun resultat pour "${recherche}"`} />;

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
      {filtres.map((inv) => (
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
                {inv.prenom ?? ''} {inv.nom ?? ''}
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
