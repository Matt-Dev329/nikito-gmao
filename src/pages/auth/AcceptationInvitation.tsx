import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlbaLoginHero } from '@/components/ui/Logo';
import { PhotoCapture } from '@/components/shared/PhotoCapture';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface InvitationDetails {
  id: string;
  email: string | null;
  role_label: string;
  parcs_codes: string[];
  invite_par_nom: string;
  auth_mode: 'email_password' | 'pin_seul';
  expire_le: string;
}

const TEL_REGEX = /^(\+33|0)[67]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;

function formatTel(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+33')) {
    const rest = digits.slice(3);
    const parts = rest.match(/.{1,2}/g) ?? [];
    return '+33 ' + parts.join(' ');
  }
  if (digits.startsWith('0')) {
    const parts = digits.match(/.{1,2}/g) ?? [];
    return parts.join(' ');
  }
  return value;
}

async function fetchInvitation(token: string): Promise<InvitationDetails | null> {
  const { data, error } = await supabase
    .from('invitations')
    .select(
      `id, email, auth_mode, expire_le, parcs_assignes,
       roles(nom),
       invite_par:utilisateurs!invitations_invite_par_id_fkey(prenom, nom)`
    )
    .eq('token', token)
    .is('utilise_le', null)
    .maybeSingle();

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const parcIds: string[] = d.parcs_assignes ?? [];

  let parcsCodes: string[] = [];
  if (parcIds.length > 0) {
    const { data: parcsData } = await supabase
      .from('parcs')
      .select('code')
      .in('id', parcIds);
    parcsCodes = (parcsData ?? []).map((p: { code: string }) => p.code);
  }

  return {
    id: d.id,
    email: d.email,
    role_label: d.roles?.nom ?? 'Utilisateur',
    parcs_codes: parcsCodes,
    invite_par_nom: `${d.invite_par?.prenom ?? ''} ${d.invite_par?.nom ?? ''}`.trim(),
    auth_mode: d.auth_mode,
    expire_le: d.expire_le,
  };
}

export function AcceptationInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attenteConfirmation, setAttenteConfirmation] = useState(false);

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [acceptCgu, setAcceptCgu] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const autoAcceptAttempted = useRef(false);

  // On load: fetch invitation, then check if user arrives already authenticated
  // (returning from email confirmation redirect)
  useEffect(() => {
    if (!token) {
      setErreur("Lien d'invitation invalide");
      setLoading(false);
      return;
    }

    (async () => {
      const inv = await fetchInvitation(token);
      if (!inv) {
        setErreur("Cette invitation est invalide, déjà utilisée ou expirée.");
        setLoading(false);
        return;
      }
      setInvitation(inv);
      setLoading(false);

      // Check if user is returning from email confirmation with an active session
      if (inv.auth_mode === 'email_password' && !autoAcceptAttempted.current) {
        autoAcceptAttempted.current = true;
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (user && user.email?.toLowerCase() === inv.email?.toLowerCase()) {
          const { error: rpcError } = await supabase.rpc('accepter_invitation', {
            p_token: token,
            p_auth_user_id: user.id,
            p_pin_clair: null,
            p_prenom: user.user_metadata?.prenom || '',
            p_nom: user.user_metadata?.nom || '',
            p_telephone: null,
            p_photo_url: null,
          });
          if (!rpcError) {
            navigate('/');
            return;
          }
        }
      }
    })();
  }, [token, navigate]);

  const onPhotoUploaded = useCallback((url: string) => {
    setPhotoUrl(url);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] text-dim flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#5DE5FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (erreur && !invitation) {
    return (
      <div className="min-h-screen bg-[#060918] text-text flex items-center justify-center p-6">
        <div className="bg-[#131836] rounded-2xl p-8 max-w-md text-center border border-white/[0.06]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-lg font-semibold mb-2">Invitation invalide</div>
          <div className="text-sm text-dim leading-relaxed">{erreur}</div>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  // Show "check your email" screen after signUp when email confirmation is required
  if (attenteConfirmation) {
    return (
      <div className="min-h-screen bg-[#060918] text-text flex items-center justify-center p-6">
        <div className="bg-[#131836] rounded-2xl p-8 max-w-md text-center border border-white/[0.06]">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#5DE5FF]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#5DE5FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div className="text-lg font-semibold mb-2">Confirmez votre adresse email</div>
          <div className="text-sm text-dim leading-relaxed mb-4">
            Un email de confirmation a ete envoye a{' '}
            <span className="text-[#5DE5FF] font-medium">{invitation.email}</span>.
            Cliquez sur le lien dans cet email pour activer votre compte.
          </div>
          <div className="bg-[#0a0e27] rounded-xl p-4 text-[12px] text-dim leading-relaxed">
            <div className="font-semibold text-text mb-1">Vous ne trouvez pas l'email ?</div>
            Verifiez vos spams ou dossier courrier indesirable. L'email provient de{' '}
            <span className="text-text">noreply@nikito.tech</span>.
          </div>
        </div>
      </div>
    );
  }

  const isEmailMode = invitation.auth_mode === 'email_password';
  const telValide = TEL_REGEX.test(telephone.replace(/\s/g, ''));

  const peutValider =
    prenom.trim().length > 0 &&
    nom.trim().length > 0 &&
    telValide &&
    acceptCgu &&
    (isEmailMode
      ? password.length >= 6 && password === passwordConfirm
      : pin.length === 6 && pin === pinConfirm);

  const accepter = async () => {
    if (!invitation || !token || !peutValider) return;
    setSubmitting(true);
    setErreur(null);

    try {
      let authUserId: string | null = null;

      if (isEmailMode) {
        // First, check if user already has an active session (e.g. returning visit)
        const { data: existingSession } = await supabase.auth.getSession();
        const existingUser = existingSession?.session?.user;
        if (existingUser && existingUser.email?.toLowerCase() === invitation.email?.toLowerCase()) {
          authUserId = existingUser.id;
        } else {
          // Try to sign up
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: invitation.email!,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/invitation/${token}`,
              data: {
                prenom: prenom.trim(),
                nom: nom.trim(),
              },
            },
          });

          if (signUpError) {
            if (signUpError.message?.includes('already registered')) {
              // User already exists in auth.users -- try to sign in
              const { data: signInData, error: signInError } =
                await supabase.auth.signInWithPassword({
                  email: invitation.email!,
                  password,
                });
              if (signInError) {
                throw new Error(
                  "Ce compte existe deja avec un mot de passe different. " +
                  "Essayez avec le mot de passe que vous avez utilise precedemment, " +
                  "ou contactez le support."
                );
              }
              authUserId = signInData.user?.id ?? null;
            } else {
              throw signUpError;
            }
          } else {
            // signUp succeeded -- check if user is auto-confirmed or needs email confirmation
            const user = signUpData.user;
            const session = signUpData.session;

            if (session && user) {
              // Auto-confirmed (or email confirmation disabled) -- proceed immediately
              authUserId = user.id;
            } else if (user && !session) {
              // Email confirmation is required. Show the waiting screen.
              setAttenteConfirmation(true);
              setSubmitting(false);
              return;
            } else {
              throw new Error("Impossible de creer le compte. Reessayez ou contactez le support.");
            }
          }
        }
      }

      const { error: rpcError } = await supabase.rpc('accepter_invitation', {
        p_token: token,
        p_auth_user_id: authUserId,
        p_pin_clair: !isEmailMode ? pin : null,
        p_prenom: prenom.trim(),
        p_nom: nom.trim(),
        p_telephone: telephone.replace(/\s/g, ''),
        p_photo_url: photoUrl,
      });

      if (rpcError) throw rpcError;

      if (isEmailMode && authUserId) {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          await supabase.auth.signInWithPassword({
            email: invitation.email!,
            password,
          });
        }
      }

      navigate(isEmailMode ? '/' : '/staff/login');
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErreur((e as any).message ?? 'Erreur inconnue');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060918] text-text flex flex-col items-center justify-start py-8 px-4 md:py-12">
      <div className="mb-8">
        <AlbaLoginHero />
      </div>

      <div className="w-full max-w-[520px]">
        <div className="bg-[#131836] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-6 pb-0 md:p-8 md:pb-0">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="inline-block bg-[#E85A9B]/15 text-[#E85A9B] text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                {invitation.role_label}
              </span>
              {invitation.parcs_codes.map((code) => (
                <span
                  key={code}
                  className="inline-block bg-[#5DE5FF]/10 text-[#5DE5FF] text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider"
                >
                  {code}
                </span>
              ))}
            </div>

            {invitation.invite_par_nom && (
              <div className="text-[12px] text-dim mb-6">
                Invite par <span className="text-text font-medium">{invitation.invite_par_nom}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <FieldBlock label="Prenom" required>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Jean"
                  autoFocus
                  className="field-input"
                />
              </FieldBlock>
              <FieldBlock label="Nom" required>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Dupont"
                  className="field-input"
                />
              </FieldBlock>
            </div>

            <FieldBlock label="Telephone portable" required className="mb-4">
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(formatTel(e.target.value))}
                placeholder="+33 6 12 34 56 78"
                className={cn(
                  'field-input',
                  telephone.length > 5 && !telValide && '!border-red/40'
                )}
              />
              {telephone.length > 5 && !telValide && (
                <div className="text-[10px] text-red mt-1.5">
                  Format attendu : +33 6 XX XX XX XX ou 06 XX XX XX XX
                </div>
              )}
            </FieldBlock>

            {isEmailMode && (
              <>
                <FieldBlock label="Mot de passe" required className="mb-4">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caracteres"
                    className="field-input"
                  />
                  {password.length > 0 && password.length < 6 && (
                    <div className="text-[10px] text-amber mt-1.5">
                      Encore {6 - password.length} caractere(s)
                    </div>
                  )}
                </FieldBlock>
                <FieldBlock label="Confirmer le mot de passe" required className="mb-4">
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Retapez votre mot de passe"
                    className={cn(
                      'field-input',
                      passwordConfirm.length > 0 && password !== passwordConfirm && '!border-red/40'
                    )}
                  />
                  {passwordConfirm.length > 0 && password !== passwordConfirm && (
                    <div className="text-[10px] text-red mt-1.5">Les mots de passe ne correspondent pas</div>
                  )}
                  {passwordConfirm.length > 0 && password === passwordConfirm && password.length >= 6 && (
                    <div className="text-[10px] text-green mt-1.5">Les mots de passe correspondent</div>
                  )}
                </FieldBlock>
              </>
            )}

            {!isEmailMode && (
              <div className="mb-4">
                <FieldBlock label="Code de connexion (6 chiffres)" required className="mb-3">
                  <PinInput value={pin} onChange={setPin} />
                </FieldBlock>
                <FieldBlock label="Confirmer le code" required>
                  <PinInput value={pinConfirm} onChange={setPinConfirm} />
                  {pinConfirm.length === 6 && pin !== pinConfirm && (
                    <div className="text-red text-[10px] text-center mt-2">
                      Les codes ne correspondent pas
                    </div>
                  )}
                  {pinConfirm.length === 6 && pin === pinConfirm && (
                    <div className="text-green text-[10px] text-center mt-2">
                      Les codes correspondent
                    </div>
                  )}
                </FieldBlock>
              </div>
            )}

            <div className="mb-5">
              <PhotoCapture
                bucketName="photos-profil"
                storagePath={`invitation_${invitation.id}`}
                onPhotoUploaded={onPhotoUploaded}
                label="Photo de profil (optionnel)"
              />
            </div>

            <label className="flex items-start gap-3 mb-6 cursor-pointer group">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={acceptCgu}
                  onChange={(e) => setAcceptCgu(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={cn(
                  'w-5 h-5 rounded-[5px] border-2 flex items-center justify-center transition-all',
                  acceptCgu
                    ? 'bg-[#5DE5FF] border-[#5DE5FF]'
                    : 'border-white/20 group-hover:border-white/40'
                )}>
                  {acceptCgu && (
                    <svg className="w-3 h-3 text-[#060918]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[12px] text-dim leading-relaxed">
                J'accepte les{' '}
                <span className="text-[#5DE5FF] underline underline-offset-2">
                  conditions d'utilisation
                </span>{' '}
                d'ALBA by Nikito et que mes saisies de controle soient enregistrees.
              </span>
            </label>
          </div>

          <div className="px-6 pb-6 md:px-8 md:pb-8">
            {erreur && (
              <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg mb-4">
                {erreur}
              </div>
            )}

            <button
              onClick={accepter}
              disabled={!peutValider || submitting}
              className={cn(
                'w-full py-4 rounded-xl text-[15px] font-bold transition-all min-h-[52px]',
                peutValider && !submitting
                  ? 'bg-gradient-to-r from-[#E85A9B] to-[#5DE5FF] text-white shadow-lg shadow-[#E85A9B]/20 hover:shadow-[#E85A9B]/30'
                  : 'bg-white/[0.06] text-dim cursor-not-allowed'
              )}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Activation en cours...
                </span>
              ) : (
                'Activer mon compte'
              )}
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-[#6E6E96] mt-5">
          Ce lien expire le{' '}
          {new Date(invitation.expire_le).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          background: #0a0e27;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 12px 14px;
          color: #ffffff;
          font-size: 13px;
          outline: none;
          min-height: 44px;
          transition: border-color 0.15s;
        }
        .field-input:focus {
          border-color: #5DE5FF;
        }
        .field-input::placeholder {
          color: #6E6E96;
        }
      `}</style>
    </div>
  );
}

function FieldBlock({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] text-[#A8A8C8] uppercase tracking-wider mb-2 font-medium">
        {label}
        {required && <span className="text-[#E85A9B] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function PinInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          type="tel"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            const next = value.slice(0, i) + v + value.slice(i + 1);
            onChange(next.slice(0, 6));
            if (v && i < 5) {
              const nextEl = document.querySelectorAll('input[type=tel]')[i + 1] as HTMLInputElement;
              nextEl?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              const prevEl = document.querySelectorAll('input[type=tel]')[i - 1] as HTMLInputElement;
              prevEl?.focus();
            }
          }}
          className={cn(
            'w-[42px] h-[54px] rounded-[10px] bg-[#0a0e27] text-center text-2xl font-bold text-[#5DE5FF] outline-none min-h-[44px]',
            value[i] ? 'border-2 border-[#E85A9B]' : 'border border-white/[0.12]'
          )}
        />
      ))}
    </div>
  );
}
