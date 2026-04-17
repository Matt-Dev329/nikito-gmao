import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { guidesParRole } from './aideContenu';
import { useTour } from '@/components/tour/useTour';
import type { SectionAide } from './aideContenu';

const MOTIFS = [
  'Bug / Dysfonctionnement',
  'Demande de fonctionnalite',
  'Question sur l\'utilisation',
  'Probleme de connexion',
  'Autre',
] as const;

function renderTexte(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <span key={i} className="font-semibold text-nikito-cyan">
          {part.slice(2, -2)}
        </span>
      );
    }
    return part;
  });
}

function estAvertissement(text: string) {
  return text.startsWith('\u26A0');
}

function SectionAccordeon({
  section,
  ouvert,
  onToggle,
}: {
  section: SectionAide;
  ouvert: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 min-h-[44px] text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-lg flex-shrink-0">{section.emoji}</span>
        <span className="text-[15px] font-medium flex-1">{section.titre}</span>
        <svg
          className={cn('w-4 h-4 text-dim flex-shrink-0 transition-transform duration-200', ouvert && 'rotate-180')}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          ouvert ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <ul className="px-5 pb-5 pt-1 space-y-2">
            {section.items.map((item, i) => (
              <li
                key={i}
                className={cn(
                  'text-[14px] leading-relaxed pl-4 relative',
                  estAvertissement(item) ? 'text-amber' : 'text-dim'
                )}
              >
                <span className="absolute left-0 top-[9px] w-1.5 h-1.5 rounded-full bg-faint" />
                {renderTexte(item)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FormulaireSupport({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [motif, setMotif] = useState('');
  const [objet, setObjet] = useState('');
  const [message, setMessage] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [envoyEnCours, setEnvoyEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const canSubmit = motif.length > 0 && objet.trim().length > 0 && message.trim().length > 0 && !envoyEnCours;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setEnvoyEnCours(true);
    setErreur('');

    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          motif,
          objet,
          message,
          user_name: userName,
          user_email: userEmail,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? 'Erreur lors de l\'envoi');

      setEnvoye(true);
      setMotif('');
      setObjet('');
      setMessage('');
      setTimeout(() => setEnvoye(false), 5000);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setEnvoyEnCours(false);
    }
  };

  const inputCls = 'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan';
  const labelCls = 'block text-[11px] text-dim uppercase tracking-wider mb-2';

  return (
    <div className="mt-10">
      <div className="bg-bg-card rounded-[18px] border border-nikito-violet/20 p-5 md:p-6">
        <h2 className="text-[15px] font-medium mb-5 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-nikito-cyan" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 6l8 5 8-5" />
          </svg>
          Contacter le support
        </h2>

        {envoye ? (
          <div className="flex items-center gap-2 text-green text-[13px] py-4">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10l3 3 7-7" />
            </svg>
            Message envoye avec succes a l'equipe SI.
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Motif</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MOTIFS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotif(motif === m ? '' : m)}
                    className={cn(
                      'px-3 py-2.5 rounded-[10px] text-[12px] leading-tight text-center border transition-colors',
                      motif === m
                        ? 'bg-nikito-cyan/10 border-nikito-cyan/40 text-nikito-cyan'
                        : 'bg-bg-deep border-white/[0.08] text-dim hover:border-white/[0.15]'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Objet</label>
              <input
                type="text"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Resume en quelques mots..."
                className={cn(inputCls, 'placeholder:text-faint')}
              />
            </div>

            <div>
              <label className={labelCls}>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Decrivez votre demande ou probleme..."
                rows={5}
                className={cn(inputCls, 'resize-y min-h-[70px] placeholder:text-faint')}
              />
            </div>

            {erreur && (
              <div className="flex items-center gap-2 text-red text-[12px] bg-red/10 rounded-[10px] px-3.5 py-2.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 7v4M10 13h.01" />
                </svg>
                {erreur}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-faint">Destinataire : si@nikito.com</span>
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-medium min-h-[44px] transition-colors',
                  canSubmit
                    ? 'bg-nikito-cyan text-bg-deep hover:bg-nikito-cyan/90'
                    : 'bg-white/[0.04] text-faint cursor-not-allowed'
                )}
              >
                {envoyEnCours ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 10l7 3 9-8" />
                    <path d="M9 13v5l3-3" />
                  </svg>
                )}
                {envoyEnCours ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function PageAide() {
  const { utilisateur } = useAuth();
  const roleCode = utilisateur?.role_code ?? 'direction';
  const guide = guidesParRole[roleCode];
  const startTour = useTour((s) => s.start);

  const [ouverts, setOuverts] = useState<Record<number, boolean>>({ 0: true });

  const toggle = (index: number) => {
    setOuverts((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          Aide <span className="text-dim font-normal">· {guide.titre}</span>
        </h1>
        <button
          onClick={startTour}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-nikito-cyan/10 border border-nikito-cyan/20 text-nikito-cyan text-[13px] font-medium hover:bg-nikito-cyan/15 transition-colors min-h-[44px] flex-shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L1 7l9 5 9-5-9-5Z" />
            <path d="M15 9.5v5c0 1.5-2.5 3-5 3s-5-1.5-5-3v-5" />
            <path d="M18 7v6" />
          </svg>
          Visite guidee
        </button>
      </div>

      <div className="space-y-3">
        {guide.sections.map((section, i) => (
          <SectionAccordeon
            key={i}
            section={section}
            ouvert={!!ouverts[i]}
            onToggle={() => toggle(i)}
          />
        ))}
      </div>

      <FormulaireSupport userName={utilisateur?.prenom ?? ''} userEmail={utilisateur?.email ?? ''} />
    </div>
  );
}
