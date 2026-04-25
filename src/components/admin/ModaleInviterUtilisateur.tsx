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
    { value: 'chef_maintenance', label: "Chef d'équipe" },
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
  const [email, setEmail] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [roleChoisi, setRoleChoisi] = useState<RoleUtilisateur | null>(null);
  const [parcsChoisis, setParcsChoisis] = useState<string[]>([]);
  const [estManager, setEstManager] = useState(false);
  const [methodeEnvoi, setMethodeEnvoi] = useState<'email' | 'lien'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [lienGenere, setLienGenere] = useState<string | null>(null);
  const [pinGenere, setPinGenere] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [emailDestinataire, setEmailDestinataire] = useState('');
  const [emailErreurDetail, setEmailErreurDetail] = useState<Record<string, unknown> | null>(null);

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

    if (authMode === 'pin_seul') {
      const { data: newUser, error: userErr } = await supabase
        .from('utilisateurs')
        .insert({
          email: email || null,
          prenom: prenom || 'Staff',
          nom: nom || '',
          role_id: role.id,
          auth_mode: 'pin_seul',
          statut_validation: 'valide',
          actif: true,
          valide_par_id: utilisateur.id,
          valide_le: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (userErr || !newUser) {
        setSubmitting(false);
        return;
      }

      for (const parcId of parcsChoisis) {
        await supabase.from('parcs_utilisateurs').upsert(
          { utilisateur_id: newUser.id, parc_id: parcId },
          { onConflict: 'utilisateur_id,parc_id' }
        );
      }

      const { data: pinData, error: pinErr } = await supabase.functions.invoke('hash-pin', {
        body: { action: 'generate', utilisateur_id: newUser.id },
      });

      if (pinErr || !pinData?.success) {
        setSubmitting(false);
        return;
      }

      await supabase.from('invitations').insert({
        token,
        email: email || null,
        prenom: prenom || null,
        nom: nom || null,
        role_id: role.id,
        parcs_assignes: parcsChoisis,
        est_manager: false,
        auth_mode: 'pin_seul',
        invite_par_id: utilisateur.id,
        utilisateur_cree_id: newUser.id,
        utilise_le: new Date().toISOString(),
        notes: `Staff PIN créé par ${utilisateur.prenom} ${utilisateur.nom}`,
      });

      setPinGenere(pinData.pin_clair);
      setSubmitting(false);
      return;
    }

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
              {authMode === 'pin_seul'
                ? 'Le staff recevra un code PIN à communiquer une seule fois'
                : "L'invité complètera son profil lui-même (prénom, nom, téléphone)"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            ×
          </button>
        </div>

        {pinGenere ? (
          <SuccessPin pin={pinGenere} prenom={prenom} nom={nom} onClose={onClose} />
        ) : lienGenere ? (
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

            {authMode === 'pin_seul' && (
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <Field label="Prénom (optionnel)">
                  <input
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    placeholder="Prénom"
                    className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none min-h-[44px]"
                  />
                </Field>
                <Field label="Nom (optionnel)">
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Nom"
                    className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none min-h-[44px]"
                  />
                </Field>
              </div>
            )}

            {authMode === 'pin_seul' && (
              <div className="mb-3.5">
                <Field label="Email (optionnel, pour envoyer le PIN)">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="prenom.nom@nikito.com (optionnel)"
                    className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none min-h-[44px]"
                  />
                </Field>
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
                      ✓ Format @nikito.com validé
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
                        {checked && '✓'}
                      </span>
                      {p.code}
                    </button>
                  );
                })}
              </div>
            </div>

            {authMode === 'email_password' && (
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
            )}

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
                  ? 'Création...'
                  : authMode === 'pin_seul'
                    ? 'Créer le compte PIN ›'
                    : "Envoyer l'invitation ›"}
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

function SuccessPin({
  pin,
  prenom,
  nom,
  onClose,
}: {
  pin: string;
  prenom: string;
  nom: string;
  onClose: () => void;
}) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    await navigator.clipboard.writeText(pin);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const displayName = [prenom, nom].filter(Boolean).join(' ') || 'Staff';

  return (
    <div className="text-center py-4">
      <div className="text-4xl mb-3 font-mono text-nikito-cyan">PIN</div>
      <div className="text-base font-semibold mb-2">
        Compte créé pour {displayName}
      </div>
      <div className="text-sm text-dim mb-5">
        Communique ce code PIN une seule fois. Il ne sera plus jamais affiché.
      </div>

      <div className="bg-bg-deep rounded-xl p-5 mb-4 border border-nikito-cyan/30">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Code PIN à 6 chiffres</div>
        <div className="font-mono text-4xl font-bold text-nikito-cyan tracking-[12px] pl-3">
          {pin}
        </div>
      </div>

      <div className="bg-amber/10 border border-amber/25 rounded-xl p-3 mb-5 text-[11px] text-dim">
        Ce code est temporaire. L'agent devra le changer à sa première connexion.
      </div>

      <div className="flex gap-2.5 justify-center">
        <button
          onClick={copier}
          className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-5 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
        >
          {copie ? '✓ Copié !' : 'Copier le PIN'}
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
      <div className="text-5xl mb-3">{showEmailFailed ? '⚠️' : '✅'}</div>
      <div className="text-base font-semibold mb-2">
        {showEmailSent
          ? `Invitation envoyée à ${emailDestinataire}`
          : 'Invitation créée'}
      </div>
      <div className="text-sm text-dim mb-5">
        {showEmailSent && (
          <>La personne va recevoir un email avec un lien pour créer son compte.</>
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
              : "Le lien a été préparé. L'utilisateur définira son profil et mot de passe."}
          </>
        )}
      </div>

      {showEmailFailed && erreurDetail && (
        <div className="bg-[#1a1d2e] rounded-lg p-3 mb-3 text-left text-[10px] text-[#8b92b8] font-mono leading-relaxed">
          <div className="text-[11px] text-[#6b7094] font-semibold mb-1.5">
            Détail technique de l'erreur :
          </div>
          {erreurDetail.resend_status !== undefined && (
            <div>Status: {String(erreurDetail.resend_status)}</div>
          )}
          {erreurDetail.resend_response !== undefined && (
            <div>Réponse Resend: {String(erreurDetail.resend_response)}</div>
          )}
          {erreurDetail.from_used !== undefined && (
            <div>Expéditeur utilisé: {String(erreurDetail.from_used)}</div>
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
          {copie ? '✓ Copié !' : 'Copier le lien'}
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
