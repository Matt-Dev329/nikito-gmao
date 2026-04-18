import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { roleLabels } from '@/lib/tokens';
import type { RoleUtilisateur } from '@/types/database';

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
    { value: 'chef_maintenance', label: "Chef d'\u00e9quipe" },
    { value: 'manager_parc', label: 'Manager parc' },
    { value: 'technicien', label: 'Technicien' },
  ],
  pin_seul: [{ value: 'staff_operationnel', label: 'Staff op\u00e9rationnel' }],
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
  const [email, setEmail] = useState('');
  const [roleChoisi, setRoleChoisi] = useState<RoleUtilisateur | null>(null);
  const [parcsChoisis, setParcsChoisis] = useState<string[]>([]);
  const [estManager, setEstManager] = useState(false);
  const [methodeEnvoi, setMethodeEnvoi] = useState<'email' | 'lien'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [lienGenere, setLienGenere] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [emailDestinataire, setEmailDestinataire] = useState('');
  const [emailErreurDetail, setEmailErreurDetail] = useState<Record<string, unknown> | null>(null);

  const isManagerParc = roleInviteur === 'manager_parc';
  const rolesDisponibles = isManagerParc
    ? [{ value: 'staff_operationnel' as const, label: 'Staff op\u00e9rationnel' }]
    : rolesParAuth[authMode];
  const parcsDisponibles = isManagerParc
    ? parcs?.filter((p) => parcsInviteur.includes(p.id)) ?? []
    : parcs ?? [];

  if (!open) return null;

  const emailValide = !email || /^[^\s@]+@(nikito\.com|nikito\.fr)$/i.test(email);
  const peutEnvoyer =
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
      prenom: null,
      nom: null,
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

    const lien = `https://nikito.tech/invitation/${token}`;
    setLienGenere(lien);

    if (methodeEnvoi === 'email' && email) {
      setEmailDestinataire(email);
      setEmailStatus('sending');

      const parcsLabels = (parcs ?? [])
        .filter((p) => parcsChoisis.includes(p.id))
        .map((p) => p.code);

      const payload = {
        destinataire_email: email,
        role_label: roleLabels[roleChoisi],
        invitant_prenom: utilisateur.prenom,
        invitant_nom: utilisateur.nom,
        lien_invitation: lien,
        parcs_labels: parcsLabels,
      };

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        'send-invitation-email',
        { body: payload },
      );

      if (fnError) {
        setEmailStatus('failed');
        setEmailErreurDetail({ error: String(fnError) });
      } else if (fnData && fnData.success === false) {
        setEmailStatus('failed');
        setEmailErreurDetail(fnData);
      } else {
        setEmailStatus('sent');
      }
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[680px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-[22px]">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Nouveau compte</div>
            <div className="text-[19px] font-semibold mt-0.5">Inviter un utilisateur</div>
            <div className="text-xs text-dim mt-1">
              L'invit\u00e9 compl\u00e8tera son profil lui-m\u00eame (pr\u00e9nom, nom, t\u00e9l\u00e9phone)
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            \u00d7
          </button>
        </div>

        {lienGenere ? (
          <SuccessLien
            lien={lienGenere}
            onClose={onClose}
            authMode={authMode}
            emailStatus={emailStatus}
            emailDestinataire={emailDestinataire}
            erreurDetail={emailErreurDetail}
          />
        ) : (
          <>
            {!isManagerParc && (
              <div className="mb-[18px]">
                <label className="block text-[11px] text-dim uppercase tracking-wider mb-2.5">
                  Mode d'authentification
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <CarteAuthMode
                    icon="\uD83D\uDCE7"
                    titre="Email professionnel"
                    description="Direction, Chef d'\u00e9quipe, Manager, Technicien \u00b7 @nikito.com"
                    actif={authMode === 'email_password'}
                    onClick={() => {
                      setAuthMode('email_password');
                      setRoleChoisi(null);
                    }}
                  />
                  <CarteAuthMode
                    icon="\uD83D\uDD22"
                    titre="Code PIN tablette"
                    description="Staff op\u00e9rationnel uniquement \u00b7 pas d'email requis"
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

            {authMode === 'email_password' && (
              <div className="mb-3.5">
                <Field label="Email professionnel">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@nikito.com"
                    className={cn(
                      'w-full bg-bg-deep border rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none min-h-[44px]',
                      email.length === 0 && 'border-white/[0.08]',
                      email.length > 0 && emailValide && 'border-nikito-cyan/30',
                      email.length > 0 && !emailValide && 'border-red/40'
                    )}
                  />
                  {email.length > 0 && emailValide && (
                    <div className="text-[10px] text-nikito-cyan mt-1">
                      \u2713 Format @nikito.com valid\u00e9
                    </div>
                  )}
                  {email.length > 0 && !emailValide && (
                    <div className="text-[10px] text-red mt-1">
                      Doit se terminer par @nikito.com ou @nikito.fr
                    </div>
                  )}
                </Field>
              </div>
            )}

            <div className="mb-3.5">
              <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                R\u00f4le pr\u00e9-attribu\u00e9
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
                      'py-2.5 px-2 rounded-lg text-[11px] min-h-[44px]',
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

            <div className="mb-[18px]">
              <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                Parcs assign\u00e9s
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
                        'py-2.5 px-2 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold min-h-[44px]',
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
                        {checked && '\u2713'}
                      </span>
                      {p.code}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-bg-deep rounded-[10px] p-3 px-3.5 mb-[18px] border border-dashed border-nikito-cyan/20">
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
                    ? `Envoi de l'invitation \u00e0 ${email}...`
                    : 'Cr\u00e9ation...'
                  : "Envoyer l'invitation \u203a"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
          ? 'bg-gradient-to-br from-nikito-cyan/12 to-nikito-cyan/4 border-2 border-nikito-cyan'
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
  erreurDetail,
}: {
  lien: string;
  onClose: () => void;
  authMode: AuthMode;
  emailStatus: 'idle' | 'sending' | 'sent' | 'failed';
  emailDestinataire: string;
  erreurDetail: Record<string, unknown> | null;
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
          ? `Invitation envoy\u00e9e \u00e0 ${emailDestinataire}`
          : 'Invitation cr\u00e9\u00e9e'}
      </div>
      <div className="text-sm text-dim mb-5">
        {showEmailSent && (
          <>La personne va recevoir un email avec un lien pour cr\u00e9er son compte.</>
        )}
        {showEmailFailed && (
          <>
            L'invitation a \u00e9t\u00e9 cr\u00e9\u00e9e mais l'email n'a pas pu \u00eatre envoy\u00e9.
            Vous pouvez transmettre le lien manuellement :
          </>
        )}
        {!showEmailSent && !showEmailFailed && (
          <>
            {authMode === 'pin_seul'
              ? "Communique ce lien \u00e0 l'agent. Il pourra cr\u00e9er son code \u00e0 6 chiffres."
              : "Le lien a \u00e9t\u00e9 pr\u00e9par\u00e9. L'utilisateur d\u00e9finira son profil et mot de passe."}
          </>
        )}
      </div>

      {showEmailFailed && erreurDetail && (
        <div className="bg-[#1a1d2e] rounded-lg p-3 mb-3 text-left text-[10px] text-[#8b92b8] font-mono leading-relaxed">
          <div className="text-[11px] text-[#6b7094] font-semibold mb-1.5">
            D\u00e9tail technique de l'erreur :
          </div>
          {erreurDetail.resend_status !== undefined && (
            <div>Status: {String(erreurDetail.resend_status)}</div>
          )}
          {erreurDetail.resend_response !== undefined && (
            <div>R\u00e9ponse Resend: {String(erreurDetail.resend_response)}</div>
          )}
          {erreurDetail.from_used !== undefined && (
            <div>Exp\u00e9diteur utilis\u00e9: {String(erreurDetail.from_used)}</div>
          )}
          {erreurDetail.to_used !== undefined && (
            <div>Destinataire: {String(erreurDetail.to_used)}</div>
          )}
          {erreurDetail.error !== undefined && !erreurDetail.resend_status && (
            <div>Erreur: {String(erreurDetail.error)}</div>
          )}
        </div>
      )}

      <div className="bg-bg-deep rounded-lg p-3 mb-4 break-all text-[11px] text-nikito-cyan font-mono">
        {lien}
      </div>

      <div className="flex gap-2.5 justify-center">
        <button
          onClick={copier}
          className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-5 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
        >
          {copie ? '\u2713 Copi\u00e9 !' : 'Copier le lien'}
        </button>
        <button
          onClick={onClose}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-lg text-xs font-bold min-h-[44px]"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
