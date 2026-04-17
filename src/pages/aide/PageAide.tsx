import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { guidesParRole } from './aideContenu';
import type { SectionAide } from './aideContenu';

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

      <div className="mt-8 text-center">
        <a
          href="mailto:support@nikito.tech"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-bg-card border border-white/[0.06] text-dim hover:text-nikito-cyan hover:border-nikito-cyan/30 transition-colors text-sm min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 6l8 5 8-5" />
          </svg>
          Contacter le support
        </a>
      </div>
    </div>
  );
}
