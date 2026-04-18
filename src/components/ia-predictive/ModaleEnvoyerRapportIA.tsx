import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { buildIAPdfBase64 } from '@/pages/ia-predictive/exportIAPDF';
import type { AnalyseIA } from '@/types/ia-predictive';

interface Props {
  analyse: AnalyseIA;
  onClose: () => void;
}

export function ModaleEnvoyerRapportIA({ analyse, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<{ ok: boolean; message: string } | null>(null);

  const handleEnvoyer = async () => {
    if (!email) return;
    setEnCours(true);
    setResultat(null);

    try {
      const pdfBase64 = buildIAPdfBase64(analyse);

      const session = (await supabase.auth.getSession()).data.session;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-rapport-ia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? supabaseAnonKey}`,
          'Apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          destinataire_email: email,
          score_sante: analyse.score_sante_global,
          tendance: analyse.tendance,
          nb_equipements_risque: analyse.equipements_a_risque.length,
          nb_alertes: analyse.alertes.length,
          nb_recommandations: analyse.recommandations.length,
          kpi: analyse.kpi_predictions,
          equipements_risque: analyse.equipements_a_risque.slice(0, 10).map((eq) => ({
            code: eq.equipement_code,
            libelle: eq.equipement_libelle,
            parc: eq.parc,
            score: eq.score_risque,
            priorite: eq.priorite,
            action: eq.action_recommandee,
          })),
          alertes: analyse.alertes.slice(0, 10).map((a) => ({
            type: a.type,
            message: a.message,
            parc: a.parc,
            priorite: a.priorite,
          })),
          pdf_base64: pdfBase64,
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
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Rapport IA Predictive</div>
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
              placeholder="email@exemple.com"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </div>

          <div className="bg-bg-deep rounded-xl p-3.5 space-y-1.5">
            <div className="text-[10px] text-dim uppercase tracking-wider">Resume du rapport</div>
            <div className="text-[13px]">
              <span className="text-dim">Score de sante : </span>
              <span className={cn(
                'font-semibold',
                analyse.score_sante_global >= 80 ? 'text-green' :
                analyse.score_sante_global >= 50 ? 'text-amber' : 'text-red'
              )}>
                {analyse.score_sante_global}/100
              </span>
            </div>
            <div className="text-[13px]">
              <span className="text-dim">Equipements a risque : </span>
              <span className="text-text">{analyse.equipements_a_risque.length}</span>
            </div>
            <div className="text-[13px]">
              <span className="text-dim">Alertes : </span>
              <span className="text-text">{analyse.alertes.length}</span>
            </div>
            <div className="text-[13px]">
              <span className="text-dim">Recommandations : </span>
              <span className="text-text">{analyse.recommandations.length}</span>
            </div>
          </div>

          <div className="text-[11px] text-faint flex items-center gap-1.5">
            <PdfIcon className="w-3.5 h-3.5 flex-shrink-0" />
            Le rapport PDF complet sera joint a l'email
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
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px] flex items-center justify-center gap-2',
              (!email || enCours) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <MailIcon className="w-4 h-4" />
            {enCours ? 'Envoi en cours...' : 'Envoyer le rapport'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="2" />
      <path d="M1 5l7 4 7-4" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
      <path d="M10 1v4h4" />
      <path d="M6 9h4" />
      <path d="M6 11.5h4" />
    </svg>
  );
}
