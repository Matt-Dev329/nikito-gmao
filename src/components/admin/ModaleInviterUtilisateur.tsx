import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { roleLabels } from '@/lib/tokens';
import type { RoleUtilisateur } from '@/types/database';

// ============================================================
// Modale Inviter un utilisateur
// Si rôle inviteur = manager_parc :
//   - Choix de rôle limité à staff_operationnel
//   - Choix de parc limité à ses parcs
// ============================================================

interface ModaleInviterProps {
  open: boolean;
  onClose: () => void;
  roleInviteur: RoleUtilisateur;
  parcsInviteur: string[];
}

type AuthMode = 'email_password' | 'pin_seul';

const rolesParAuth: Record<AuthMode, { value: RoleUtilisateur; label: string }[]> = {
  email_password: [
    { value: 'direction', label: 'Direction' },
    { value: 'chef_maintenance', label: 'Chef équipe' },
    { value: 'manager_parc', label: 'Manager parc' },
    { value: 'technicien', label: 'Technicien' },
  ],
  pin_seul: [{ value: 'staff_operationnel', label: 'Staff opérationnel' }],
};

export function ModaleInviterUtilisateur({
  open,
  onClose,
  roleInviteur,
  parcsInviteur,
}: ModaleInviterProps) {
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const [authMode, setAuthMode] = useState<AuthMode>('email_password');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [roleChoisi, setRoleChoisi] = useState<RoleUtilisateur | null>(null);
  const [parcsChoisis, setParcsChoisis] = useState<string[]>([]);
  const [estManager, setEstManager] = useState(false);
  const [methodeEnvoi, setMethodeEnvoi] = useState<'email' | 'lien'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [lienGenere, setLienGenere] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [emailDestinataire, setEmailDestinataire] = useState('');

  // Restrictions selon le rôle de l'inviteur
  const isManagerParc = roleInviteur === 'manager_parc';
  const rolesDisponibles = isManagerParc
    ? [{ value: 'staff_operationnel' as const, label: 'Staff opérationnel' }]
    : rolesParAuth[authMode];
  const parcsDisponibles = isManagerParc
    ? parcs?.filter((p) => parcsInviteur.includes(p.id)) ?? []
    : parcs ?? [];

  if (!open) return null;

  const emailValide = !email || /^[^\s@]+@(nikito\.com|nikito\.fr)$/i.test(email);
  const peutEnvoyer =
    prenom.length > 0 &&
    nom.length > 0 &&
    roleChoisi !== null &&
    parcsChoisis.length > 0 &&
    (authMode === 'pin_seul' || (email.length > 0 && emailValide));

  const envoyer = async () => {
    if (!peutEnvoyer || !roleChoisi || !utilisateur) return;
    setSubmitting(true);

    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('code', roleChoisi)
      .single();

    if (!role) {
      setSubmitting(false);
      return;
    }

    const token =
      crypto.randomUUID().replace(/-/g, '') +
      Math.random().toString(36).slice(2, 10);

    const { error } = await supabase.from('invitations').insert({
      token,
      email: email || null,
      prenom,
      nom,
      role_id: role.id,
      parcs_assignes: parcsChoisis,
      est_manager: estManager,
      auth_mode: authMode,
      invite_par_id: utilisateur.id,
    });

    if (error) {
      setSubmitting(false);
      return;
    }

    const lien = `${window.location.origin}/invitation/${token}`;
    setLienGenere(lien);

    if (methodeEnvoi === 'email' && email) {
      setEmailDestinataire(email);
      setEmailStatus('sending');

      const parcsLabels = (parcs ?? [])
        .filter((p) => parcsChoisis.includes(p.id))
        .map((p) => p.code);

      const { error: fnError } = await supabase.functions.invoke(
        'send-invitation-email',
        {
          body: {
            destinataire_email: email,
            destinataire_prenom: prenom,
            destinataire_nom: nom,
            role_label: roleLabels[roleChoisi],
            invitant_prenom: utilisateur.prenom,
            invitant_nom: utilisateur.nom,
            lien_invitation: lien,
            parcs_labels: parcsLabels,
          },
        },
      );

      setEmailStatus(fnError ? 'failed' : 'sent');
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[680px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-[22px]">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Nouveau compte</div>
            <div className="text-[19px] font-semibold mt-0.5">Inviter un utilisateur</div>
            <div className="text-xs text-dim mt-1">
              Génère un lien d'invitation à durée limitée (7 jours)
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            ×
          </button>
        </div>

        {lienGenere ? (
          <SuccessLien
            lien={lienGenere}
            onClose={onClose}
            authMode={authMode}
            emailStatus={emailStatus}
            emailDestinataire={emailDestinataire}
          />
        ) : (
          <>
            {/* Mode auth (caché si manager parc) */}
            {!isManagerParc && (
              <div className="mb-[18px]">
                <label className="block text-[11px] text-dim uppercase tracking-wider mb-2.5">
                  Mode d'authentification
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <CarteAuthMode
                    icon="📧"
                    titre="Email professionnel"
                    description="Direction, Chef d'équipe, Manager, Technicien · @nikito.com"
                    actif={authMode === 'email_password'}
                    onClick={() => {
                      setAuthMode('email_password');
                      setRoleChoisi(null);
                    }}
                  />
                  <CarteAuthMode
                    icon="🔢"
                    titre="Code PIN tablette"
                    description="Staff opérationnel uniquement · pas d'email requis"
                    actif={authMode === 'pin_seul'}
                    onClick={() => {
                      setAuthMode('pin_seul');
                      setRoleChoisi('staff_operationnel');
                      setEmail('');
                    }}
                  />
                </div>
              </div>
            )}

            {/* Identité */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">
              <Field label="Prénom">
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
                />
              </Field>
              <Field label="Nom">
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
                />
              </Field>
            </div>

            {authMode === 'email_password' && (
              <Field label="Email professionnel">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@nikito.com"
                  className={cn(
                    'w-full bg-bg-deep border rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none',
                    email.length === 0 && 'border-white/[0.08]',
                    email.length > 0 && emailValide && 'border-nikito-cyan/30',
                    email.length > 0 && !emailValide && 'border-red/40'
                  )}
                />
                {email.length > 0 && emailValide && (
                  <div className="text-[10px] text-nikito-cyan mt-1">
                    ✓ Format @nikito.com validé
                  </div>
                )}
                {email.length > 0 && !emailValide && (
                  <div className="text-[10px] text-red mt-1">
                    Doit se terminer par @nikito.com ou @nikito.fr
                  </div>
                )}
              </Field>
            )}

            {/* Rôle */}
            <div className="mb-3.5">
              <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                Rôle pré-attribué
              </label>
              <div
                className={cn(
                  'grid gap-1.5',
                  rolesDisponibles.length === 1 ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'
                )}
              >
                {rolesDisponibles.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRoleChoisi(r.value)}
                    className={cn(
                      'py-2.5 px-2 rounded-lg text-[11px]',
                      roleChoisi === r.value
                        ? 'bg-gradient-action border-none text-text font-bold'
                        : 'bg-bg-deep border border-white/[0.08] text-dim'
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {roleChoisi === 'manager_parc' && (
                <label className="flex items-center gap-2 mt-3 text-xs">
                  <input
                    type="checkbox"
                    checked={estManager}
                    onChange={(e) => setEstManager(e.target.checked)}
                    className="accent-nikito-pink"
                  />
                  Sera manager principal de son parc
                </label>
              )}
            </div>

            {/* Parcs */}
            <div className="mb-[18px]">
              <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                Parcs assignés
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {parcsDisponibles.map((p) => {
                  const checked = parcsChoisis.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        setParcsChoisis(
                          checked
                            ? parcsChoisis.filter((id) => id !== p.id)
                            : [...parcsChoisis, p.id]
                        )
                      }
                      className={cn(
                        'py-2.5 px-2 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold',
                        checked
                          ? 'bg-nikito-pink/15 border border-nikito-pink text-text'
                          : 'bg-bg-deep border border-white/[0.08] text-dim'
                      )}
                    >
                      <span
                        className={cn(
                          'w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[10px] font-bold',
                          checked ? 'bg-nikito-pink text-bg-app' : 'border border-white/15'
                        )}
                      >
                        {checked && '✓'}
                      </span>
                      {p.code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Méthode d'envoi */}
            <div className="bg-bg-deep rounded-[10px] p-3 px-3.5 mb-[18px] border border-dashed border-nikito-violet/25">
              <div className="text-[11px] text-dim uppercase tracking-wider mb-2.5">
                Envoi du lien
              </div>
              <div className="flex gap-2.5">
                <RadioOption
                  selected={methodeEnvoi === 'email'}
                  onClick={() => setMethodeEnvoi('email')}
                  disabled={!email}
                >
                  Envoyer par email
                </RadioOption>
                <RadioOption
                  selected={methodeEnvoi === 'lien'}
                  onClick={() => setMethodeEnvoi('lien')}
                >
                  Copier le lien
                </RadioOption>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
              <button
                onClick={onClose}
                className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
              >
                Annuler
              </button>
              <button
                onClick={envoyer}
                disabled={!peutEnvoyer || submitting}
                className={cn(
                  'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
                  (!peutEnvoyer || submitting) && 'opacity-40 cursor-not-allowed'
                )}
              >
                {submitting
                  ? emailStatus === 'sending'
                    ? `Envoi de l'invitation à ${email}...`
                    : 'Création...'
                  : "Envoyer l'invitation \u203a"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}

function CarteAuthMode({
  icon,
  titre,
  description,
  actif,
  onClick,
}: {
  icon: string;
  titre: string;
  description: string;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl p-3.5 text-left',
        actif
          ? 'bg-gradient-to-br from-nikito-cyan/12 to-nikito-violet/6 border-2 border-nikito-cyan'
          : 'bg-bg-deep border border-white/[0.08]'
      )}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="text-xl">{icon}</span>
        <span className={cn('text-[13px]', actif ? 'font-semibold text-text' : 'text-dim')}>
          {titre}
        </span>
      </div>
      <div className="text-[11px] text-dim leading-relaxed">{description}</div>
    </button>
  );
}

function RadioOption({
  selected,
  onClick,
  disabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 flex items-center gap-2 py-2 px-2.5 rounded-lg',
        selected
          ? 'bg-bg-app border border-nikito-cyan'
          : 'bg-bg-app border border-white/10',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'w-3.5 h-3.5 rounded-full border',
          selected ? 'border-nikito-cyan bg-nikito-cyan/20' : 'border-white/30'
        )}
      >
        {selected && (
          <span className="block w-1.5 h-1.5 rounded-full bg-nikito-cyan m-auto mt-1" />
        )}
      </span>
      <span className={cn('text-xs', selected ? 'text-text' : 'text-dim')}>{children}</span>
    </button>
  );
}

function SuccessLien({
  lien,
  onClose,
  authMode,
  emailStatus,
  emailDestinataire,
}: {
  lien: string;
  onClose: () => void;
  authMode: AuthMode;
  emailStatus: 'idle' | 'sending' | 'sent' | 'failed';
  emailDestinataire: string;
}) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    await navigator.clipboard.writeText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const showEmailSent = emailStatus === 'sent';
  const showEmailFailed = emailStatus === 'failed';

  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-3">{showEmailFailed ? '\u26A0\uFE0F' : '\u2705'}</div>
      <div className="text-base font-semibold mb-2">
        {showEmailSent
          ? `Invitation envoyée à ${emailDestinataire}`
          : 'Invitation créée'}
      </div>
      <div className="text-sm text-dim mb-5">
        {showEmailSent && (
          <>La personne va recevoir un email avec un lien pour accepter l'invitation.</>
        )}
        {showEmailFailed && (
          <>
            L'invitation a été créée mais l'email n'a pas pu être envoyé.
            Vous pouvez transmettre le lien manuellement :
          </>
        )}
        {!showEmailSent && !showEmailFailed && (
          <>
            {authMode === 'pin_seul'
              ? "Communique ce lien à l'agent. Il pourra créer son code à 6 chiffres."
              : "Le lien a été préparé. L'utilisateur définira son mot de passe."}
          </>
        )}
      </div>

      <div className="bg-bg-deep rounded-lg p-3 mb-4 break-all text-[11px] text-nikito-cyan font-mono">
        {lien}
      </div>

      <div className="flex gap-2.5 justify-center">
        <button
          onClick={copier}
          className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-5 py-2.5 rounded-lg text-xs font-semibold"
        >
          {copie ? '\u2713 Copié !' : '\uD83D\uDCCB Copier le lien'}
        </button>
        <button
          onClick={onClose}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-lg text-xs font-bold"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
