import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ============================================================
// Login standard (email/password) pour direction, tech, chef équipe, manager
// Le staff opérationnel a son propre login PIN sur tablette parc
// ============================================================

export function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    } else {
      navigate('/gmao', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-bg-app text-text flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6 md:mb-8">
          <Logo size="lg" subtitle="GMAO Lean Ballé" />
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
            Vous êtes staff opérationnel ? Connexion par PIN ›
          </a>
        </form>
      </div>
    </div>
  );
}
