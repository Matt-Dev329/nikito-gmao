import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { guidesParRole } from './aideContenu';
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
  const formRef = useRef<HTMLFormElement>(null);

  const canSubmit = motif.length > 0 && objet.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const sujetComplet = `[GMAO - ${motif}] ${objet}`;
    const corpsComplet = `${message}\n\n---\nEnvoye depuis l'aide GMAO\nUtilisateur : ${userName} (${userEmail})`;

    const mailto = `mailto:si@nikito.com?subject=${encodeURIComponent(sujetComplet)}&body=${encodeURIComponent(corpsComplet)}`;
    window.location.href = mailto;

    setEnvoye(true);
    setTimeout(() => {
      setMotif('');
      setObjet('');
      setMessage('');
      setEnvoye(false);
    }, 4000);
  };

  return (
    <div className="mt-10">
      <div className="bg-bg-card rounded-xl border border-white/[0.06] p-5">
        <h2 className="text-[15px] font-medium mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-dim" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 6l8 5 8-5" />
          </svg>
          Contacter le support
        </h2>

        {envoye ? (
          <div className="flex items-center gap-2 text-green text-sm py-4">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10l3 3 7-7" />
            </svg>
            Votre client mail va s'ouvrir avec le message pre-rempli.
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-dim mb-1.5">Motif</label>
              <select
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="w-full bg-bg-body border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text min-h-[44px] focus:outline-none focus:border-nikito-cyan/40 transition-colors"
              >
                <option value="" disabled>Choisir un motif...</option>
                {MOTIFS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-dim mb-1.5">Objet</label>
              <input
                type="text"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Resume en quelques mots..."
                className="w-full bg-bg-body border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text min-h-[44px] placeholder:text-faint focus:outline-none focus:border-nikito-cyan/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-dim mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Decrivez votre demande ou probleme..."
                rows={5}
                className="w-full bg-bg-body border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-faint focus:outline-none focus:border-nikito-cyan/40 transition-colors resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-faint">Destinataire : si@nikito.com</span>
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors',
                  canSubmit
                    ? 'bg-nikito-cyan text-bg-body hover:bg-nikito-cyan/90'
                    : 'bg-white/[0.04] text-faint cursor-not-allowed'
                )}
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 10l7 3 9-8" />
                  <path d="M9 13v5l3-3" />
                </svg>
                Envoyer
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

  const [ouverts, setOuverts] = useState<Record<number, boolean>>({ 0: true });

  const toggle = (index: number) => {
    setOuverts((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">
          Aide <span className="text-dim font-normal">· {guide.titre}</span>
        </h1>
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
