import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  abandonnerAction,
  abonner,
  rafraichirEtat,
  reessayerAction,
  rejouer,
  type EtatFile,
} from '@/lib/horsLigne/file';
import { declarerExecuteursHorsLigne } from '@/lib/horsLigne/executeurs';

const LIBELLES_TYPE: Record<string, string> = {
  cloture_intervention: 'Clôture d’intervention',
  controle_staff: 'Contrôle',
  signalement: 'Signalement',
};

/**
 * Bandeau global hors-ligne + synchronisation automatique :
 * - hors connexion : prévient que les saisies sont gardées sur l'appareil ;
 * - au retour du réseau (et toutes les minutes) : envoie les photos et
 *   validations en attente, puis rafraîchit les écrans ;
 * - une saisie refusée par le serveur reste affichée (réessayer / abandonner).
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const [file, setFile] = useState<EtatFile>({ photos: 0, actions: [], synchroEnCours: false });
  const [details, setDetails] = useState(false);
  const [confirmerAbandon, setConfirmerAbandon] = useState<string | null>(null);
  const enAttentePrecedent = useRef(0);

  useEffect(() => {
    declarerExecuteursHorsLigne();
    const desabonner = abonner(setFile);
    rafraichirEtat().then(() => rejouer());
    const id = window.setInterval(() => rejouer(), 60_000);
    return () => {
      desabonner();
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (online) rejouer();
  }, [online]);

  const enAttente = file.photos + file.actions.filter((a) => !a.erreur).length;
  const refusees = file.actions.filter((a) => a.erreur);

  // Des envois viennent d'aboutir : les écrans affichent les données à jour
  useEffect(() => {
    if (enAttente < enAttentePrecedent.current) qc.invalidateQueries();
    enAttentePrecedent.current = enAttente;
  }, [enAttente, qc]);

  if (online && enAttente === 0 && refusees.length === 0) return null;

  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[100] text-[13px] font-semibold text-center">
      {!online ? (
        <div className="bg-amber text-bg-app py-1.5 px-3">
          Hors connexion — tes saisies sont gardées sur l'appareil et partiront automatiquement au retour du réseau
          {enAttente > 0 && ` (${enAttente} en attente)`}.
        </div>
      ) : enAttente > 0 ? (
        <div className="bg-nikito-cyan text-bg-app py-1.5 px-3">
          {file.synchroEnCours ? 'Envoi des saisies faites hors connexion…' : 'Saisies hors connexion en attente d’envoi'} (
          {enAttente})
        </div>
      ) : null}

      {refusees.length > 0 && (
        <div className="bg-red text-text py-1.5 px-3">
          <button onClick={() => setDetails((d) => !d)} className="underline">
            {refusees.length} saisie{refusees.length > 1 ? 's' : ''} hors connexion refusée
            {refusees.length > 1 ? 's' : ''} par le serveur — {details ? 'masquer' : 'voir'}
          </button>
          {details && (
            <div className="mt-2 max-w-[640px] mx-auto text-left font-normal space-y-2 pb-1">
              {refusees.map((a) => (
                <div key={a.id} className="bg-bg-card text-text rounded-lg p-2.5">
                  <div className="text-[12px] font-semibold">
                    {LIBELLES_TYPE[a.type] ?? a.type} · {a.libelle}
                  </div>
                  <div className="text-[11px] text-dim mt-0.5">
                    {new Date(a.creeLe).toLocaleString('fr-FR')} — {a.erreur}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => reessayerAction(a.id)}
                      className="bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 rounded-md px-3 py-1 text-[12px]"
                    >
                      Réessayer
                    </button>
                    <button
                      onClick={() => {
                        if (confirmerAbandon === a.id) {
                          setConfirmerAbandon(null);
                          abandonnerAction(a.id);
                        } else {
                          setConfirmerAbandon(a.id);
                        }
                      }}
                      className="text-red text-[12px] px-2"
                    >
                      {confirmerAbandon === a.id ? 'Confirmer l’abandon définitif' : 'Abandonner'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
