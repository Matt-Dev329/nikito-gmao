import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ControleHistorique } from '@/hooks/queries/useHistoriqueControles';
import { supabase } from '@/lib/supabase';

interface ModaleEnvoyerRapportProps {
  controles: ControleHistorique[];
  dateDebut: string;
  dateFin: string;
  parcCode?: string;
  onClose: () => void;
}

export function ModaleEnvoyerRapport({ controles, dateDebut, dateFin, parcCode, onClose }: ModaleEnvoyerRapportProps) {
  const [email, setEmail] = useState('controles@nikito.com');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<{ ok: boolean; message: string } | null>(null);

  const handleEnvoyer = async () => {
    if (!email) return;
    setEnCours(true);
    setResultat(null);

    try {
      const lignes = controles.map((c) => ({
        date: c.date_planifiee,
        parc: c.parc_code,
        type: c.type,
        controleur: c.realise_par_nom ?? '-',
        statut: c.statut,
        ok: c.nb_ok,
        ko: c.nb_ko,
        hash: c.hash_integrite ?? '',
      }));

      const parcLabel = parcCode || 'Tous les parcs';
      const env = (import.meta as unknown as { env: Record<string, string> }).env;
      const supabaseUrl = env.VITE_SUPABASE_URL;
      const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

      const session = (await supabase.auth.getSession()).data.session;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-rapport-controles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? supabaseKey}`,
          'Apikey': supabaseKey,
        },
        body: JSON.stringify({
          destinataire_email: email,
          parc_label: parcLabel,
          date_debut: dateDebut,
          date_fin: dateFin,
          total_controles: controles.length,
          total_valides: controles.filter((c) => c.statut === 'valide').length,
          total_non_conformites: controles.reduce((s, c) => s + c.nb_ko, 0),
          lignes,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResultat({ ok: true, message: 'Rapport envoye avec succes.' });
      } else {
        setResultat({ ok: false, message: data.error ?? 'Echec de l\'envoi.' });
      }
    } catch (err) {
      setResultat({ ok: false, message: `Erreur : ${(err as Error).message}` });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl p-5 md:p-6 max-w-[440px] w-full border border-white/[0.08] shadow-2xl">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Rapport DGCCRF</div>
            <div className="text-[17px] font-semibold mt-0.5">Envoyer par email</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            x
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Destinataire</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </div>

          <div className="bg-bg-deep rounded-xl p-3.5 space-y-1.5">
            <div className="text-[10px] text-dim uppercase tracking-wider">Resume du rapport</div>
            <div className="text-[13px]">
              <span className="text-dim">Periode : </span>
              <span className="text-text">{dateDebut} au {dateFin}</span>
            </div>
            <div className="text-[13px]">
              <span className="text-dim">Parc : </span>
              <span className="text-text">{parcCode || 'Tous les parcs'}</span>
            </div>
            <div className="text-[13px]">
              <span className="text-dim">Controles : </span>
              <span className="text-text">{controles.length}</span>
            </div>
          </div>

          {resultat && (
            <div className={cn(
              'text-[12px] rounded-lg p-3',
              resultat.ok ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
            )}>
              {resultat.message}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-5">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={handleEnvoyer}
            disabled={!email || enCours}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!email || enCours) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {enCours ? 'Envoi en cours...' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
