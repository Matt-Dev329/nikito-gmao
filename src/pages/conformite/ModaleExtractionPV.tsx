import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const PROGRESS_MESSAGES = [
  'Telechargement du PV...',
  'Lecture du document par Claude...',
  'Identification des prescriptions...',
  'Classification par categorie...',
  'Estimation des delais...',
];

interface Props {
  commissionId: string;
  documentId?: string;
  commissionLabel: string;
  onClose: () => void;
  existingExtractionId?: string | null;
}

export function ModaleExtractionPV({ commissionId, documentId, commissionLabel, onClose, existingExtractionId }: Props) {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const [phase, setPhase] = useState<'confirm' | 'loading' | 'error' | 'duplicate'>(
    existingExtractionId ? 'duplicate' : 'confirm',
  );
  const [progressIdx, setProgressIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'loading') return;
    const id = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_MESSAGES.length - 1));
    }, 3000);
    return () => clearInterval(id);
  }, [phase]);

  const lancerExtraction = async () => {
    setPhase('loading');
    setProgressIdx(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? supabaseAnonKey;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/extract-pv-prescriptions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commission_id: commissionId,
            document_id: documentId ?? null,
            user_id: utilisateur?.id ?? null,
          }),
        },
      );

      const data = await res.json().catch(() => ({ success: false, error: 'Reponse invalide' }));

      if (!data.success || !data.extraction_id) {
        setErrorMsg(data.error ?? data.detail ?? 'Echec extraction');
        setPhase('error');
        return;
      }

      navigate(`/gmao/conformite/extractions/${data.extraction_id}`);
    } catch (err) {
      setErrorMsg(String(err instanceof Error ? err.message : err));
      setPhase('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={phase === 'loading' ? undefined : onClose}>
      <div className="bg-bg-card rounded-2xl border border-white/[0.08] shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        {phase === 'confirm' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-cyan-400 flex items-center justify-center">
                <RobotIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold">Extraction automatique</h3>
                <p className="text-[11px] text-dim">{commissionLabel}</p>
              </div>
            </div>
            <p className="text-[13px] text-dim leading-relaxed mb-5">
              Cette action va analyser le PV avec Claude AI et creer des brouillons de prescriptions que vous pourrez valider.
            </p>
            <div className="bg-bg-deep rounded-lg p-3 mb-5 border border-white/[0.04]">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-dim">Cout estime</span>
                <span className="font-semibold text-nikito-cyan">~ 0,15 EUR</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
              <button
                onClick={lancerExtraction}
                className="bg-gradient-to-br from-pink-500 to-cyan-400 text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
              >
                Lancer l'extraction
              </button>
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="py-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500 to-cyan-400 flex items-center justify-center animate-pulse">
              <RobotIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-[15px] font-semibold mb-1">Analyse en cours par Claude...</h3>
            <p className="text-[12px] text-dim mb-6">{PROGRESS_MESSAGES[progressIdx]}</p>
            <div className="space-y-1">
              {PROGRESS_MESSAGES.map((m, i) => (
                <div key={m} className={`text-[11px] ${i <= progressIdx ? 'text-nikito-cyan' : 'text-faint'}`}>
                  {i <= progressIdx ? '\u2713' : '\u2022'} {m}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <h3 className="text-[15px] font-semibold text-red mb-2">Echec de l'extraction</h3>
            <p className="text-[12px] text-dim mb-4 break-words">{errorMsg}</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Fermer</button>
              <button
                onClick={lancerExtraction}
                className="bg-gradient-to-br from-pink-500 to-cyan-400 text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]"
              >
                Reessayer
              </button>
            </div>
          </div>
        )}

        {phase === 'duplicate' && existingExtractionId && (
          <div>
            <h3 className="text-[15px] font-semibold mb-2">Extraction existante</h3>
            <p className="text-[13px] text-dim mb-5">
              Une extraction a deja ete realisee pour ce PV. Vous pouvez consulter le resultat ou relancer une nouvelle analyse.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[13px] text-dim hover:text-text min-h-[44px]">Annuler</button>
              <button
                onClick={() => navigate(`/gmao/conformite/extractions/${existingExtractionId}`)}
                className="px-4 py-2 text-[13px] border border-nikito-cyan/40 text-nikito-cyan rounded-xl min-h-[44px] hover:bg-nikito-cyan/10"
              >
                Voir l'extraction
              </button>
              <button
                onClick={() => setPhase('confirm')}
                className="bg-gradient-to-br from-pink-500 to-cyan-400 text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold min-h-[44px]"
              >
                Relancer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 2v4M8 2v2M16 2v2" />
      <circle cx="9" cy="14" r="1" />
      <circle cx="15" cy="14" r="1" />
      <path d="M9 18h6" />
    </svg>
  );
}
