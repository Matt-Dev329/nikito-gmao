import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';

export interface AnalyseContratDonnees {
  statut: 'en_attente' | 'en_cours' | 'terminee' | 'echec';
  resume: string | null;
  objet: string | null;
  prestations: { intitule: string; detail: string | null }[];
  frequence_interventions: string | null;
  delais_intervention: string | null;
  date_debut: string | null;
  date_fin: string | null;
  duree: string | null;
  reconduction: string | null;
  preavis: string | null;
  date_limite_resiliation: string | null;
  montant: string | null;
  conditions_paiement: string | null;
  obligations_nikito: string[];
  exclusions: string[];
  penalites: string | null;
  contacts: string | null;
  points_attention: string[];
  erreur: string | null;
}

const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR');

/** Explication du contrat par l'analyse automatique : à quoi il sert, puis le détail à la demande. */
export function AnalyseContrat({ documentId, analyse }: { documentId: string; analyse: AnalyseContratDonnees | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [lancement, setLancement] = useState(false);

  const analyser = async () => {
    setLancement(true);
    // Rafraîchit tout de suite pour afficher « analyse en cours »
    setTimeout(() => qc.invalidateQueries({ queryKey: ['documents-techniques', 'contrat'] }), 1500);
    const { data, error } = await supabase.functions.invoke('analyser-contrat', { body: { document_id: documentId } });
    setLancement(false);
    qc.invalidateQueries({ queryKey: ['documents-techniques', 'contrat'] });
    if (error || data?.success === false) toast.error(data?.error ?? error?.message ?? 'Analyse impossible');
    else toast.success('Contrat analysé');
  };

  if (lancement || analyse?.statut === 'en_cours' || analyse?.statut === 'en_attente') {
    return <div className="mt-2 text-[12px] text-nikito-cyan animate-pulse">Analyse du contrat en cours… (1 à 2 minutes)</div>;
  }
  if (!analyse || analyse.statut === 'echec') {
    return (
      <div className="mt-2 flex flex-col gap-1">
        {analyse?.erreur && <div className="text-[11px] text-red">Analyse impossible : {analyse.erreur}</div>}
        <button onClick={analyser} className="self-start text-[12px] text-nikito-cyan font-semibold underline-offset-2 hover:underline min-h-[32px]">
          {analyse ? '↻ Relancer l’analyse' : '🔎 Analyser ce contrat'}
        </button>
      </div>
    );
  }

  const lignes: [string, string | null][] = [
    ['Objet', analyse.objet],
    ['Fréquence', analyse.frequence_interventions],
    ['Délai d’intervention', analyse.delais_intervention],
    ['Début', analyse.date_debut ? dateFr(analyse.date_debut) : null],
    ['Fin', analyse.date_fin ? dateFr(analyse.date_fin) : null],
    ['Durée', analyse.duree],
    ['Reconduction', analyse.reconduction],
    ['Préavis', analyse.preavis],
    ['Résilier avant le', analyse.date_limite_resiliation ? dateFr(analyse.date_limite_resiliation) : null],
    ['Prix', analyse.montant],
    ['Paiement', analyse.conditions_paiement],
    ['Pénalités', analyse.penalites],
    ['Contacts', analyse.contacts],
  ];
  const listes: [string, string[]][] = [
    ['Ce que Nikito doit faire', analyse.obligations_nikito ?? []],
    ['Non couvert', analyse.exclusions ?? []],
  ];

  return (
    <div className="mt-2 bg-bg-deep rounded-lg p-2.5 text-[12px]">
      <div className="text-[10px] text-nikito-cyan uppercase tracking-wider mb-1">À quoi sert ce contrat</div>
      <div className="text-text leading-relaxed">{analyse.resume}</div>
      {analyse.date_limite_resiliation && (
        <div className="mt-1.5 text-amber">⏰ Résilier avant le {dateFr(analyse.date_limite_resiliation)} si besoin</div>
      )}
      {(analyse.points_attention ?? []).length > 0 && (
        <ul className="mt-1.5 list-disc pl-4 text-amber/90 space-y-0.5">
          {analyse.points_attention.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      <button onClick={() => setOuvert((o) => !o)} className="mt-1.5 text-nikito-cyan font-semibold min-h-[32px]">
        {ouvert ? 'Masquer le détail' : 'Voir le détail'}
      </button>
      {ouvert && (
        <div className="mt-1 flex flex-col gap-2">
          {(analyse.prestations ?? []).length > 0 && (
            <div>
              <div className="text-dim mb-0.5">Prestations incluses</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {analyse.prestations.map((p, i) => (
                  <li key={i}>
                    {p.intitule}
                    {p.detail && <span className="text-dim"> — {p.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            {lignes
              .filter(([, v]) => v)
              .map(([l, v]) => (
                <div key={l} className="contents">
                  <dt className="text-dim whitespace-nowrap">{l}</dt>
                  <dd className="m-0 text-text">{v}</dd>
                </div>
              ))}
          </dl>
          {listes
            .filter(([, v]) => v.length > 0)
            .map(([l, v]) => (
              <div key={l}>
                <div className="text-dim mb-0.5">{l}</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {v.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          <button onClick={analyser} className={cn('self-start text-dim underline-offset-2 hover:underline min-h-[32px]')}>
            ↻ Relancer l’analyse
          </button>
        </div>
      )}
    </div>
  );
}
