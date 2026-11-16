import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/ToastProvider';

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;
const MAX = 5;

/** Découpe « a@x.fr, b@y.fr ; c@z.fr » en adresses */
function adresses(saisie: string): string[] {
  return [...new Set(saisie.split(/[\s,;]+/).map((a) => a.trim().toLowerCase()).filter(Boolean))];
}

export interface EnvoiMail {
  le: string;
  par_nom?: string | null;
  a?: string[];
}

/** Envoi d'un ticket par mail (prestataire, collègue…) avec un message facultatif. */
export function ModaleEnvoyerTicketMail({
  incidentId,
  numeroBT,
  onClose,
}: {
  incidentId: string;
  numeroBT: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const liste = adresses(saisie);
  const invalides = liste.filter((a) => !EMAIL.test(a));
  const valide = liste.length > 0 && liste.length <= MAX && invalides.length === 0;

  const envoyer = async () => {
    if (!valide) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.functions.invoke('envoyer-ticket-mail', {
        body: { incident_id: incidentId, destinataires: liste, message: message.trim() },
      });
      if (error || !data?.success) throw new Error((data?.error as string) || error?.message || 'Envoi impossible');
      toast.success(`Ticket ${numeroBT} envoyé à ${liste.join(', ')}`);
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['incident'] });
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[480px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[16px] font-bold">✉️ Envoyer {numeroBT} par mail</div>
          <div className="text-[12px] text-dim mt-0.5">
            Le mail contient le détail du ticket, les interventions et les liens vers les photos (valables 7 jours). Tu es
            en copie, et la personne peut te répondre directement.
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Adresse(s) mail — jusqu’à {MAX}, séparées par une virgule</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            multiple
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="prenom.nom@entreprise.fr"
            className="bg-bg-app border border-white/10 rounded-lg px-3 min-h-[44px] text-[14px]"
            autoFocus
          />
          {invalides.length > 0 && <span className="text-[12px] text-red">Adresse invalide : {invalides.join(', ')}</span>}
          {liste.length > MAX && <span className="text-[12px] text-red">{MAX} adresses maximum</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Message (facultatif)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ex. : Pouvez-vous passer cette semaine pour regarder ce problème ?"
            className="bg-bg-app border border-white/10 rounded-lg px-3 py-2 text-[14px]"
          />
        </label>

        {erreur && <div className="text-[13px] text-red">{erreur}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 min-h-[44px] rounded-[10px] text-[13px] text-dim">
            Annuler
          </button>
          <button
            onClick={envoyer}
            disabled={!valide || envoi}
            className="px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-gradient-cta text-text disabled:opacity-50"
          >
            {envoi ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Historique des envois par mail d'un ticket (meta.envois_mail) */
export function HistoriqueEnvoisMail({ envois }: { envois: EnvoiMail[] }) {
  if (envois.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      {envois.map((e, i) => (
        <div key={i} className="text-[12px] text-dim">
          ✉️ Envoyé à {(e.a ?? []).join(', ')}
          {e.par_nom ? ` par ${e.par_nom}` : ''} le{' '}
          {new Date(e.le).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </div>
      ))}
    </div>
  );
}
