import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlbaLoginHero } from '@/components/ui/Logo';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(pw: string): PasswordStrength {
  if (pw.length < 6) return 'weak';
  const hasLetters = /[a-zA-Z]/.test(pw);
  const hasNumbers = /[0-9]/.test(pw);
  if (pw.length >= 8 && hasLetters && hasNumbers) return 'strong';
  return 'medium';
}

const strengthConfig: Record<PasswordStrength, { label: string; color: string; width: string }> = {
  weak: { label: 'Trop court (min. 6 caracteres)', color: 'bg-red', width: 'w-1/3' },
  medium: { label: 'Moyen', color: 'bg-orange-400', width: 'w-2/3' },
  strong: { label: 'Fort', color: 'bg-green', width: 'w-full' },
};

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
    });

    const timeout = setTimeout(() => {
      setReady((prev) => {
        if (!prev) setTokenError(true);
        return prev;
      });
    }, 5000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const cfg = strengthConfig[strength];
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && password === confirm && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      if (updateError.message.includes('expired') || updateError.message.includes('invalid')) {
        setTokenError(true);
      } else {
        setError(updateError.message);
      }
      return;
    }

    await supabase.rpc('supprimer_devices_utilisateur_courant');

    await supabase.auth.signOut({ scope: 'global' });

    setLoading(false);
    setSuccess(true);
  };

  if (tokenError) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8 md:mb-10">
            <AlbaLoginHero />
          </div>
          <div className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col gap-5 items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold mb-2">Lien expire</h1>
              <p className="text-[13px] text-dim leading-relaxed">
                Ce lien de reinitialisation a expire ou est invalide. Veuillez refaire une demande.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold min-h-[44px] w-full"
            >
              Retour a la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8 md:mb-10">
            <AlbaLoginHero />
          </div>
          <div className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col gap-5 items-center text-center">
            <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold mb-2">Mot de passe modifie</h1>
              <p className="text-[13px] text-dim leading-relaxed">
                Votre mot de passe a ete modifie avec succes.
                Vous pouvez maintenant vous connecter.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold min-h-[44px] w-full"
            >
              Se connecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg-app text-text flex items-center justify-center">
        <div className="text-dim text-sm">Verification du lien...</div>
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
          onSubmit={handleSubmit}
          className="bg-bg-card rounded-2xl p-5 md:p-6 flex flex-col gap-4"
        >
          <h1 className="text-xl font-semibold mb-1">Nouveau mot de passe</h1>
          <p className="text-[13px] text-dim leading-relaxed">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>

          <div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 pr-12 text-text text-base outline-none focus:border-nikito-cyan min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-text transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {password.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="h-1.5 bg-bg-deep rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all duration-300', cfg.color, cfg.width)} />
                </div>
                <p className={cn(
                  'text-[11px]',
                  strength === 'weak' ? 'text-red' : strength === 'medium' ? 'text-orange-400' : 'text-green'
                )}>
                  {cfg.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={cn(
                  'w-full bg-bg-deep border rounded-lg p-3 pr-12 text-text text-base outline-none min-h-[44px]',
                  mismatch ? 'border-red/50' : 'border-white/[0.08] focus:border-nikito-cyan'
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-text transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {mismatch && (
              <p className="text-[11px] text-red mt-1.5">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'bg-gradient-cta text-text py-3.5 rounded-xl text-sm font-bold mt-2 min-h-[44px]',
              !canSubmit && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? 'Modification en cours...' : 'Changer mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
