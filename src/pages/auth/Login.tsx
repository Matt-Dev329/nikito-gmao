import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { AlbaLoginHero } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getDeviceHash } from '@/lib/deviceFingerprint';
import { Verification2FA } from '@/components/auth/Verification2FA';
import { cn } from '@/lib/utils';
import { maskEmail } from '@/lib/deviceFingerprint';

type Screen = 'login' | '2fa' | 'forgot' | 'forgot-sent';

interface Pending2FAState {
  email: string;
  prenom: string;
  tempPassword: string;
}

const RESEND_COOLDOWN = 60;

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authUser, loading: authLoading } = useAuth();

  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending2FA, setPending2FA] = useState<Pending2FAState | null>(null);

  const [resetEmail, setResetEmail] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);

  const entering2FA = useRef(false);

  const destination = (location.state as { from?: string })?.from || '/gmao';

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setInterval(() => setResetCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resetCooldown]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  if (authUser && screen !== '2fa' && !entering2FA.current) {
    return <Navigate to={destination} replace />;
  }

  if (screen === '2fa' && pending2FA) {
    return (
      <Verification2FA
        email={pending2FA.email}
        prenom={pending2FA.prenom}
        tempPassword={pending2FA.tempPassword}
        onSuccess={() => {
          entering2FA.current = false;
          setPending2FA(null);
          navigate(destination, { replace: true });
        }}
        onCancel={() => {
          entering2FA.current = false;
          setPending2FA(null);
          setScreen('login');
        }}
      />
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    entering2FA.current = true;

    const { data: signInData, error: signInError } = await signIn(email, password);

    if (signInError || !signInData.session) {
      entering2FA.current = false;
      setError('Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }

    const { data: utilisateurData } = await supabase
      .from('utilisateurs')
      .select('id, prenom, email')
      .eq('auth_user_id', signInData.user.id)
      .maybeSingle();

    const prenom = utilisateurData?.prenom || '';
    const userEmail = utilisateurData?.email || email;

    const deviceHash = getDeviceHash();

    const { data: deviceReconnu } = await supabase.rpc('verifier_device_reconnu', {
      p_email: userEmail,
      p_device_hash: deviceHash,
    });

    if (deviceReconnu === true) {
      await supabase.rpc('rafraichir_device', { p_device_hash: deviceHash });
      entering2FA.current = false;
      setLoading(false);
      navigate(destination, { replace: true });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await supabase.from('codes_2fa').insert({ email: userEmail, code });

    await supabase.functions.invoke('send-code-2fa', {
      body: { email: userEmail, code, prenom },
    });

    setPending2FA({ email: userEmail, prenom, tempPassword: password });
    setScreen('2fa');

    await supabase.auth.signOut();

    setLoading(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectUrl,
    });

    setLoading(false);

    if (resetError) {
      setError('Une erreur est survenue. Verifiez votre email et reessayez.');
      return;
    }

    setResetCooldown(RESEND_COOLDOWN);
    setScreen('forgot-sent');
  };

  const handleResendReset = async () => {
    if (resetCooldown > 0) return;

    const redirectUrl = `${window.location.origin}/reset-password`;
    await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectUrl,
    });

    setResetCooldown(RESEND_COOLDOWN);
  };

  if (screen === 'forgot') {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8 md:mb-10">
            <AlbaLoginHero />
          </div>

          <form
            onSubmit={handleForgotSubmit}
            className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col gap-4"
          >
            <h1 className="text-xl font-semibold mb-1">Reinitialisation du mot de passe</h1>
            <p className="text-[13px] text-dim leading-relaxed">
              Entrez votre adresse email. Vous recevrez un lien pour creer un nouveau mot de passe.
            </p>

            <div>
              <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
                Email professionnel
              </label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text text-base outline-none focus:border-nikito-cyan min-h-[44px]"
                placeholder="prenom.nom@nikito.fr"
              />
            </div>

            {error && (
              <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold mt-2 min-h-[44px]',
                loading && 'opacity-50 cursor-wait'
              )}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien de reinitialisation'}
            </button>

            <button
              type="button"
              onClick={() => { setScreen('login'); setError(null); }}
              className="text-[13px] text-dim hover:text-nikito-cyan transition-colors min-h-[44px] flex items-center justify-center gap-1.5"
            >
              <span>&larr;</span> Retour a la connexion
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (screen === 'forgot-sent') {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8 md:mb-10">
            <AlbaLoginHero />
          </div>

          <div className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col gap-5 items-center text-center">
            <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <div>
              <h1 className="text-xl font-semibold mb-2">Email envoye</h1>
              <p className="text-[13px] text-dim leading-relaxed">
                Un email de reinitialisation a ete envoye a{' '}
                <span className="text-nikito-cyan font-medium">{maskEmail(resetEmail)}</span>.
                <br />
                Verifiez votre boite de reception (et vos spams).
              </p>
            </div>

            <button
              onClick={handleResendReset}
              disabled={resetCooldown > 0}
              className={cn(
                'text-[13px] underline transition-colors',
                resetCooldown > 0 ? 'text-faint cursor-not-allowed' : 'text-nikito-cyan hover:text-nikito-cyan/80'
              )}
            >
              {resetCooldown > 0 ? `Renvoyer l'email (${resetCooldown}s)` : "Renvoyer l'email"}
            </button>

            <button
              onClick={() => { setScreen('login'); setError(null); }}
              className="text-[13px] text-dim hover:text-nikito-cyan transition-colors min-h-[44px] flex items-center justify-center gap-1.5"
            >
              <span>&larr;</span> Retour a la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8 md:mb-10">
          <AlbaLoginHero />
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col gap-4"
        >
          <h1 className="text-xl font-semibold mb-2">Connexion</h1>

          <div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
              Email professionnel
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text text-base outline-none focus:border-nikito-cyan min-h-[44px]"
              placeholder="prenom.nom@nikito.fr"
            />
          </div>

          <div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text text-base outline-none focus:border-nikito-cyan min-h-[44px]"
            />
          </div>

          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold mt-2 min-h-[44px]',
              loading && 'opacity-50 cursor-wait'
            )}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetEmail(email);
              setError(null);
              setScreen('forgot');
            }}
            className="text-[13px] text-dim hover:text-nikito-cyan transition-colors"
          >
            Mot de passe oublie ?
          </button>

          <a
            href="/staff/login"
            className="text-center text-xs text-dim hover:text-nikito-cyan mt-1 min-h-[44px] flex items-center justify-center"
          >
            Vous etes staff operationnel ? Connexion par PIN
          </a>
        </form>
      </div>
    </div>
  );
}
