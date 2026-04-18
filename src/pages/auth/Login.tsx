import { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { AlbaLoginHero } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getDeviceHash } from '@/lib/deviceFingerprint';
import { Verification2FA } from '@/components/auth/Verification2FA';
import { cn } from '@/lib/utils';

interface Pending2FAState {
  email: string;
  prenom: string;
  tempPassword: string;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authUser, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending2FA, setPending2FA] = useState<Pending2FAState | null>(null);

  const destination = (location.state as { from?: string })?.from || '/gmao';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  if (authUser && !pending2FA) {
    return <Navigate to={destination} replace />;
  }

  if (pending2FA) {
    return (
      <Verification2FA
        email={pending2FA.email}
        prenom={pending2FA.prenom}
        tempPassword={pending2FA.tempPassword}
        onSuccess={() => {
          setPending2FA(null);
          navigate(destination, { replace: true });
        }}
        onCancel={() => {
          setPending2FA(null);
        }}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: signInData, error: signInError } = await signIn(email, password);

    if (signInError || !signInData.session) {
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
      setLoading(false);
      navigate(destination, { replace: true });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase.from('codes_2fa').insert({ email: userEmail, code });
    await supabase.functions.invoke('send-code-2fa', {
      body: { email: userEmail, code, prenom },
    });

    await supabase.auth.signOut();

    setLoading(false);
    setPending2FA({ email: userEmail, prenom, tempPassword: password });
  };

  return (
    <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8 md:mb-10">
          <AlbaLoginHero />
        </div>

        <form
          onSubmit={handleSubmit}
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

          <a
            href="/staff/login"
            className="text-center text-xs text-dim hover:text-nikito-cyan mt-2 min-h-[44px] flex items-center justify-center"
          >
            Vous etes staff operationnel ? Connexion par PIN
          </a>
        </form>
      </div>
    </div>
  );
}
