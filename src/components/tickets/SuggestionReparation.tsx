import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Suggestion {
  diagnostic: string;
  actions: string;
  piste: string | null;
  confiance: 'faible' | 'moyenne' | 'elevee';
}

const CONFIANCE = {
  faible: { label: 'Confiance faible', cls: 'text-amber' },
  moyenne: { label: 'Confiance moyenne', cls: 'text-nikito-cyan' },
  elevee: { label: 'Confiance élevée', cls: 'text-green' },
};

/**
 * « ✨ Proposer » : l'IA suggère le diagnostic et les actions à partir du
 * problème signalé (texte + photo) et de l'historique des réparations. Le
 * technicien choisit d'utiliser la proposition, puis la corrige avant de
 * clôturer : rien n'est enregistré sans lui.
 */
export function SuggestionReparation({
  incidentId,
  diagnostic,
  actions,
  onUtiliser,
}: {
  incidentId: string;
  diagnostic: string;
  actions: string;
  onUtiliser: (s: { diagnostic: string; actions: string }) => void;
}) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const proposer = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.functions.invoke('suggerer-reparation', {
        body: { incident_id: incidentId, diagnostic, actions },
      });
      if (error || !data?.success) throw new Error((data?.error as string) || 'Suggestion indisponible pour le moment');
      setSuggestion(data as Suggestion);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Suggestion indisponible pour le moment');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl p-3.5 px-4 border border-nikito-cyan/25 flex flex-col gap-2.5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="text-[13px] font-semibold">✨ Aide à la rédaction</div>
          <div className="text-[11px] text-dim">
            Proposition à partir du problème signalé et des réparations passées. À vérifier et corriger avant de clôturer.
          </div>
        </div>
        <button
          onClick={proposer}
          disabled={chargement}
          className="px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 disabled:opacity-50"
        >
          {chargement ? 'Analyse…' : suggestion ? '↻ Nouvelle proposition' : '✨ Proposer'}
        </button>
      </div>

      {erreur && <div className="text-[12px] text-red">{erreur}</div>}

      {suggestion && (
        <div className="flex flex-col gap-2 text-[13px]">
          {suggestion.piste && (
            <div className="bg-amber/10 border border-amber/30 rounded-lg px-3 py-2 text-[12px]">
              <strong className="text-amber">Historique :</strong> {suggestion.piste}
            </div>
          )}
          <div className="bg-bg-deep rounded-lg p-3">
            <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Diagnostic proposé</div>
            <div className="whitespace-pre-wrap">{suggestion.diagnostic}</div>
          </div>
          <div className="bg-bg-deep rounded-lg p-3">
            <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Actions proposées</div>
            <div className="whitespace-pre-wrap">{suggestion.actions}</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cn('text-[11px] font-semibold', CONFIANCE[suggestion.confiance]?.cls ?? 'text-dim')}>
              {CONFIANCE[suggestion.confiance]?.label ?? ''}
            </span>
            <button
              onClick={() => {
                onUtiliser({ diagnostic: suggestion.diagnostic, actions: suggestion.actions });
                setSuggestion(null);
              }}
              className="ml-auto px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-gradient-cta text-text"
            >
              Utiliser (je corrige ensuite)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
