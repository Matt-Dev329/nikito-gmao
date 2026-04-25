import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { formatHeure, formatDateLong } from '@/lib/utils';

// ============================================================
// Login staff en 2 étapes :
//   1. Choisir le parc (où je travaille aujourd'hui)
//   2. Taper mon code 6 chiffres (vérifié via RPC verifier_pin_staff)
// ============================================================

type Etape = 'parc' | 'pin';

export function LoginStaff() {
  const navigate = useNavigate();
  const { data: parcs } = useParcs();
  const [etape, setEtape] = useState<Etape>('parc');
  const [parcChoisi, setParcChoisi] = useState<{ id: string; code: string; nom: string } | null>(
    null
  );
  const [pin, setPin] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const choisirParc = (p: { id: string; code: string; nom: string }) => {
    setParcChoisi(p);
    setPin('');
    setErreur(null);
    setEtape('pin');
  };

  const ajouterChiffre = (c: string) => {
    if (pin.length >= 6) return;
    setPin(pin + c);
    setErreur(null);
  };

  const effacer = () => setPin(pin.slice(0, -1));
  const reset = () => setPin('');

  const valider = async () => {
    if (pin.length !== 6 || !parcChoisi) return;
    setLoading(true);
    setErreur(null);

    const { data, error } = await supabase.rpc('verifier_pin_staff', {
      p_parc_code: parcChoisi.code,
      p_pin: pin,
    });

    setLoading(false);

    if (error || !data || data.length === 0) {
      setErreur('Code incorrect. Réessaye ou demande un nouveau code à ton manager.');
      reset();
      return;
    }

    sessionStorage.setItem(
      'staff_session',
      JSON.stringify({
        utilisateur: data[0],
        parc: parcChoisi,
        connecte_le: new Date().toISOString(),
      })
    );
    localStorage.setItem('alba:device_kind', 'tablet-fixed');
    navigate('/staff/controle-ouverture', { replace: true });
  };

  if (etape === 'parc') {
    return (
      <div className="min-h-screen bg-bg-app text-text">
        <header className="px-[22px] py-[18px] bg-bg-sidebar flex items-center gap-3.5 border-b border-white/[0.06]">
          <Logo size="md" withText={false} />
          <div className="flex-1">
            <div className="text-[11px] text-dim tracking-[1.4px] uppercase">Connexion staff</div>
            <div className="text-base font-semibold text-gradient-logo">
              Étape 1 · Choisir le parc
            </div>
          </div>
          <div className="text-right text-[11px] text-dim">
            {formatDateLong(new Date())} · {formatHeure(new Date())}
          </div>
        </header>

        <main className="p-8 px-6 max-w-[680px] mx-auto">
          <div className="text-[11px] text-dim uppercase tracking-wider text-center mb-5">
            Sur quel parc travailles-tu aujourd'hui ?
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {parcs?.map((p) => (
              <button
                key={p.id}
                onClick={() => choisirParc({ id: p.id, code: p.code, nom: p.nom })}
                className="bg-bg-card border border-white/[0.08] rounded-2xl p-6 px-[18px] text-left hover:border-nikito-pink transition-colors"
              >
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-lg font-bold font-mono text-nikito-cyan">{p.code}</span>
                  {p.ouvert_7j7 && (
                    <span className="bg-amber/20 text-amber px-2 py-0.5 rounded-md text-[10px] font-semibold">
                      7J/7
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold mb-1">{p.nom}</div>
                <div className="text-[11px] text-dim">{p.adresse}</div>
              </button>
            ))}
          </div>

          <div className="mt-5 bg-bg-deep rounded-[10px] p-2.5 px-3.5 flex items-center gap-2.5 text-[11px] text-dim border border-dashed border-nikito-violet/25">
            <span className="text-nikito-cyan">ⓘ</span>
            <span>Tu peux changer de parc à tout moment depuis ton profil.</span>
          </div>
        </main>
      </div>
    );
  }

  // Étape PIN
  return (
    <div className="min-h-screen bg-bg-app text-text">
      <header className="px-[22px] py-[18px] bg-bg-sidebar flex items-center gap-3.5 border-b border-white/[0.06]">
        <button
          onClick={() => setEtape('parc')}
          className="bg-bg-deep border border-white/[0.08] text-dim w-8 h-8 rounded-lg text-sm"
        >
          ‹
        </button>
        <div className="flex-1">
          <div className="text-[11px] text-dim tracking-[1.4px] uppercase">
            {parcChoisi?.code} · {parcChoisi?.nom}
          </div>
          <div className="text-base font-semibold text-gradient-logo">
            Étape 2 · Ton code de connexion
          </div>
        </div>
      </header>

      <main className="p-8 px-6 flex flex-col items-center max-w-[420px] mx-auto">
        <div className="text-sm text-dim mb-6 text-center">Tape ton code à 6 chiffres</div>

        <div className="flex gap-2.5 mb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-[42px] h-[54px] rounded-[10px] bg-bg-card flex items-center justify-center text-2xl font-bold text-nikito-cyan',
                pin.length > i ? 'border-2 border-nikito-pink' : 'border border-white/[0.12]'
              )}
            >
              {pin.length > i ? '●' : ''}
            </div>
          ))}
        </div>
        <div className="text-[10px] text-dim mb-6">{pin.length} / 6 chiffres</div>

        {erreur && (
          <div className="text-red text-xs text-center mb-4 max-w-[320px]">{erreur}</div>
        )}

        <div className="grid grid-cols-3 gap-2.5 mb-[18px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => (
            <button
              key={c}
              onClick={() => ajouterChiffre(c)}
              className="bg-bg-deep border border-white/10 text-text w-[72px] h-[72px] rounded-xl text-2xl font-semibold hover:bg-bg-card"
            >
              {c}
            </button>
          ))}
          <button
            onClick={reset}
            className="bg-transparent border-none text-dim text-[11px]"
          >
            Effacer
          </button>
          <button
            onClick={() => ajouterChiffre('0')}
            className="bg-bg-deep border border-white/10 text-text w-[72px] h-[72px] rounded-xl text-2xl font-semibold hover:bg-bg-card"
          >
            0
          </button>
          <button
            onClick={effacer}
            className="bg-transparent border-none text-dim text-lg"
          >
            ⌫
          </button>
        </div>

        <button
          onClick={valider}
          disabled={pin.length !== 6 || loading}
          className={cn(
            'bg-gradient-cta text-text px-10 py-3.5 rounded-xl text-sm font-bold',
            (pin.length !== 6 || loading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? 'Vérification...' : 'Connecter ›'}
        </button>

        <button className="bg-transparent border-none text-dim text-[11px] mt-3.5 underline">
          J'ai oublié mon code
        </button>
      </main>
    </div>
  );
}
