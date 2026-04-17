import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ============================================================
// Page acceptation invitation
// URL: /invitation/:token
//
// Selon auth_mode de l'invitation :
//   - email_password : champ email pré-rempli + choix mot de passe
//   - pin_seul       : choix code 6 chiffres (avec confirmation)
//
// Appelle la RPC accepter_invitation au final
// ============================================================

interface InvitationDetails {
  id: string;
  email: string | null;
  prenom: string;
  nom: string;
  role_label: string;
  parcs_noms: string[];
  invite_par_nom: string;
  auth_mode: 'email_password' | 'pin_seul';
  expire_le: string;
}

export function AcceptationInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Champs
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setErreur('Lien d\'invitation invalide');
      setLoading(false);
      return;
    }

    // Récupérer les détails de l'invitation (vue publique non-RLS à créer côté SQL)
    supabase
      .from('invitations')
      .select(
        `id, email, prenom, nom, auth_mode, expire_le,
         roles(nom),
         invite_par:utilisateurs!invitations_invite_par_id_fkey(prenom, nom)`
      )
      .eq('token', token)
      .is('utilise_le', null)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setErreur('Cette invitation est invalide, déjà utilisée ou expirée.');
          setLoading(false);
          return;
        }

        // Récupérer les noms des parcs si parcs_assignes
        // (simplification : on charge tout sans le détail parc ici)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        setInvitation({
          id: d.id,
          email: d.email,
          prenom: d.prenom,
          nom: d.nom,
          role_label: d.roles?.nom ?? 'Utilisateur',
          parcs_noms: [],
          invite_par_nom: `${d.invite_par?.prenom ?? ''} ${d.invite_par?.nom ?? ''}`,
          auth_mode: d.auth_mode,
          expire_le: d.expire_le,
        });
        setLoading(false);
      });
  }, [token]);

  const accepter = async () => {
    if (!invitation || !token) return;
    setSubmitting(true);
    setErreur(null);

    try {
      let authUserId: string | null = null;

      if (invitation.auth_mode === 'email_password') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: invitation.email!,
          password,
        });

        if (signUpError) {
          if (signUpError.message?.includes('already registered')) {
            const { data: signInData, error: signInError } =
              await supabase.auth.signInWithPassword({
                email: invitation.email!,
                password,
              });
            if (signInError) throw signInError;
            authUserId = signInData.user?.id ?? null;
          } else {
            throw signUpError;
          }
        } else {
          authUserId = signUpData.user?.id ?? null;
        }
      }

      const { error: rpcError } = await supabase.rpc('accepter_invitation', {
        p_token: token,
        p_auth_user_id: authUserId,
        p_pin_clair: invitation.auth_mode === 'pin_seul' ? pin : null,
      });

      if (rpcError) throw rpcError;

      if (invitation.auth_mode === 'pin_seul') {
        navigate('/staff/login');
      } else {
        navigate('/');
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setErreur((e as any).message ?? 'Erreur inconnue');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-app text-dim flex items-center justify-center">
        Chargement...
      </div>
    );
  }

  if (erreur && !invitation) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-6">
        <div className="bg-bg-card rounded-2xl p-6 max-w-md text-center">
          <div className="text-4xl mb-3">🔒</div>
          <div className="text-base font-semibold mb-2">Invitation invalide</div>
          <div className="text-sm text-dim">{erreur}</div>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  const peutValider =
    invitation.auth_mode === 'email_password'
      ? password.length >= 8
      : pin.length === 6 && pin === pinConfirm;

  return (
    <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-bg-app rounded-2xl overflow-hidden border border-nikito-violet/20">
        {/* Bandeau bienvenue */}
        <div className="bg-gradient-cta p-7 px-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-bg-app/20 rounded-2xl mb-3">
            <Logo size="md" withText={false} />
          </div>
          <div className="text-[11px] text-bg-app/70 tracking-[1.4px] font-semibold">
            BIENVENUE CHEZ NIKITO GMAO
          </div>
          <div className="text-[22px] font-bold text-bg-app mt-1.5">
            Salut {invitation.prenom} ! 👋
          </div>
        </div>

        <main className="p-6 px-[26px]">
          {/* Récap */}
          <div className="bg-bg-card rounded-xl p-3.5 px-4 mb-[22px]">
            <div className="text-[11px] text-dim uppercase tracking-wider mb-2">
              Tu as été invité par
            </div>
            <div className="text-[13px] mb-2.5">
              <strong>{invitation.invite_par_nom}</strong>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-[11px] text-dim">
              <div>
                Rôle : <strong className="text-text">{invitation.role_label}</strong>
              </div>
              {invitation.email && (
                <div>
                  Email : <strong className="text-text">{invitation.email}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Mode email_password */}
          {invitation.auth_mode === 'email_password' && (
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5">
                Choisis ton mot de passe
              </label>
              <div className="text-[11px] text-dim mb-3.5 leading-relaxed">
                Minimum 8 caractères. Un mélange de lettres, chiffres et symboles est conseillé.
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 px-3.5 text-text text-sm outline-none focus:border-nikito-cyan"
                placeholder="••••••••"
                autoFocus
              />
              {password.length > 0 && password.length < 8 && (
                <div className="text-amber text-[10px] mt-2">
                  Encore {8 - password.length} caractère(s)
                </div>
              )}
            </div>
          )}

          {/* Mode pin_seul */}
          {invitation.auth_mode === 'pin_seul' && (
            <div className="mb-[18px]">
              <label className="block text-xs font-semibold mb-1.5">
                Choisis ton code de connexion
              </label>
              <div className="text-[11px] text-dim mb-3.5 leading-relaxed">
                6 chiffres. Tu l'utiliseras à chaque fois sur la tablette du parc.{' '}
                <strong className="text-amber">
                  Choisis-en un dont tu te souviendras facilement
                </strong>{' '}
                (mais évite ta date de naissance).
              </div>

              <PinInput value={pin} onChange={setPin} autoFocus />

              <label className="block text-xs font-semibold mb-1.5 mt-3.5">
                Confirme ton code
              </label>
              <PinInput value={pinConfirm} onChange={setPinConfirm} />

              {pinConfirm.length === 6 && pin !== pinConfirm && (
                <div className="text-red text-[10px] text-center mt-2">
                  Les codes ne correspondent pas
                </div>
              )}
              {pinConfirm.length === 6 && pin === pinConfirm && (
                <div className="text-green text-[10px] text-center mt-2">
                  ✓ Les codes correspondent
                </div>
              )}
            </div>
          )}

          {/* RGPD */}
          <div className="bg-bg-deep rounded-[10px] p-3 px-3.5 mb-[18px] border border-dashed border-nikito-violet/30">
            <div className="flex items-start gap-2">
              <span className="text-nikito-cyan text-sm flex-shrink-0">ⓘ</span>
              <div className="text-[11px] text-dim leading-relaxed">
                En activant ton compte, tu acceptes que Nikito GMAO enregistre{' '}
                <strong className="text-text">tes saisies de contrôle</strong> (qui, quand, quoi).
                Aucune donnée personnelle au-delà de ton prénom·nom n'est collectée.
              </div>
            </div>
          </div>

          {erreur && (
            <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg mb-3">
              {erreur}
            </div>
          )}

          <button
            onClick={accepter}
            disabled={!peutValider || submitting}
            className={cn(
              'bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold w-full mb-3',
              (!peutValider || submitting) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {submitting ? 'Activation...' : 'Activer mon compte ›'}
          </button>

          <div className="text-center text-[11px] text-faint">
            Ce lien expire le{' '}
            {new Date(invitation.expire_le).toLocaleString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Sous-composant PinInput
// ------------------------------------------------------------
function PinInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          type="tel"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
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
            'w-[42px] h-[54px] rounded-[10px] bg-bg-deep text-center text-2xl font-bold text-nikito-cyan outline-none',
            value[i] ? 'border-2 border-nikito-pink' : 'border border-white/[0.12]'
          )}
        />
      ))}
    </div>
  );
}
