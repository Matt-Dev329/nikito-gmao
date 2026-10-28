import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { chargerToutesLesPages } from '@/lib/paginer';
import { Pill } from '@/components/ui/Pill';
import { NotesPartagees } from '@/components/shared/NotesPartagees';
import { SELECT_COMMANDE, STATUTS_COMMANDE, type Commande, type StatutCommande } from '@/hooks/queries/useCommandes';
import { formatDateHeure, formatPrix } from './format';
import { useFiltreParc } from '@/hooks/useParcCourant';

const TONES: Record<string, string> = {
  cyan: 'bg-nikito-cyan/12 text-nikito-cyan',
  amber: 'bg-amber/15 text-amber',
  green: 'bg-green/15 text-green',
  red: 'bg-red/15 text-red',
  dim: 'bg-white/[0.06] text-dim',
};

type Periode = '30j' | '3m' | '12m' | 'tout';
const PERIODES: [Periode, string, number | null][] = [
  ['30j', '30 jours', 30],
  ['3m', '3 mois', 92],
  ['12m', '12 mois', 366],
  ['tout', 'Tout', null],
];

type FiltreStatut = 'toutes' | 'en_cours' | 'livree' | 'refusee' | 'annulee';
const FILTRES_STATUT: [FiltreStatut, string][] = [
  ['toutes', 'Toutes'],
  ['en_cours', 'En cours'],
  ['livree', 'Livrées'],
  ['refusee', 'Refusées'],
  ['annulee', 'Annulées'],
];
const EN_COURS: StatutCommande[] = ['demandee', 'validee', 'commandee'];

/** Commande remplacée par une version modifiée (motif « Remplacée par CMD-… ») */
const estRemplacee = (c: Commande) => c.statut === 'annulee' && (c.motif_refus ?? '').startsWith('Remplacée par');
const nomDemandeur = (c: Commande) => (c.demandeur ? `${c.demandeur.prenom} ${c.demandeur.nom}` : '—');
// Montant « engagé » : ni refusée ni annulée
const compteDansTotal = (c: Commande) => c.statut !== 'refusee' && c.statut !== 'annulee';
const moisDe = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

function useHistoriqueCommandes() {
  return useQuery({
    queryKey: ['commandes', 'historique'],
    queryFn: () =>
      chargerToutesLesPages<Commande>((debut, fin) =>
        supabase
          .from('commandes')
          .select(SELECT_COMMANDE)
          .order('cree_le', { ascending: false })
          .order('id')
          .range(debut, fin)
      ),
    refetchInterval: 120_000,
  });
}

/** Historique de toutes les commandes de tout le monde (gestionnaire des commandes). */
export function OngletHistorique() {
  const { data, isLoading, isError, error } = useHistoriqueCommandes();
  const [recherche, setRecherche] = useState('');
  const [periode, setPeriode] = useState<Periode>('3m');
  const [statut, setStatut] = useState<FiltreStatut>('toutes');
  const [parc, setParc] = useFiltreParc(null, 'code');
  const [voirRemplacees, setVoirRemplacees] = useState(false);

  // Période, recherche et versions remplacées : base commune des filtres parc / statut
  const base = useMemo(() => {
    const jours = PERIODES.find(([p]) => p === periode)?.[2] ?? null;
    const depuis = jours ? Date.now() - jours * 86_400_000 : 0;
    const q = recherche.trim().toLowerCase();
    return (data ?? [])
      .filter((c) => voirRemplacees || !estRemplacee(c))
      .filter((c) => new Date(c.cree_le).getTime() >= depuis)
      .filter(
        (c) =>
          !q ||
          [c.numero, nomDemandeur(c), c.parc?.code, c.parc?.nom, c.commentaire, ...c.commande_lignes.flatMap((l) => [l.produit_nom, l.reference, l.activite_nom])]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
      );
  }, [data, periode, recherche, voirRemplacees]);

  const parcs = useMemo(() => {
    const m = new Map<string, number>();
    base.forEach((c) => c.parc && m.set(c.parc.code, (m.get(c.parc.code) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [base]);
  const parcActif = parc;

  const correspondStatut = (c: Commande, f: FiltreStatut) =>
    f === 'toutes' || (f === 'en_cours' ? EN_COURS.includes(c.statut) : c.statut === f);
  const duParc = base.filter((c) => !parcActif || c.parc?.code === parcActif);
  const filtrees = duParc.filter((c) => correspondStatut(c, statut));

  const totalEngage = filtrees.filter(compteDansTotal).reduce((s, c) => s + (c.total_estime ?? 0), 0);
  const nbArticles = filtrees.filter(compteDansTotal).reduce((s, c) => s + c.commande_lignes.reduce((n, l) => n + l.quantite, 0), 0);

  const parMois = useMemo(() => {
    const m = new Map<string, Commande[]>();
    filtrees.forEach((c) => m.set(moisDe(c.cree_le), [...(m.get(moisDe(c.cree_le)) ?? []), c]));
    return [...m.entries()];
  }, [filtrees]);

  const exporterCsv = () => {
    const lignes = [
      ['Numéro', 'Date', 'Parc', 'Demandeur', 'Statut', 'Activité', 'Article', 'Référence', 'Quantité', 'Unité', 'Prix unitaire', 'Montant', 'Commentaire'],
      ...filtrees.flatMap((c) =>
        c.commande_lignes.map((l) => [
          c.numero,
          formatDateHeure(c.cree_le),
          c.parc?.code ?? '',
          nomDemandeur(c),
          STATUTS_COMMANDE[c.statut].label,
          l.activite_nom ?? '',
          l.produit_nom,
          l.reference ?? '',
          String(l.quantite),
          l.unite,
          l.prix_unitaire != null ? String(l.prix_unitaire).replace('.', ',') : '',
          l.prix_unitaire != null ? String(l.prix_unitaire * l.quantite).replace('.', ',') : '',
          c.commentaire ?? '',
        ])
      ),
    ];
    const csv = lignes.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const lien = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = lien;
    a.download = `historique_commandes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(lien), 60_000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (numéro, article, référence, personne, parc…)"
          className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        <button
          onClick={exporterCsv}
          disabled={filtrees.length === 0}
          className="bg-bg-card border border-white/[0.08] text-dim hover:text-text px-4 rounded-xl text-[13px] min-h-[44px] disabled:opacity-40"
        >
          ⤓ Exporter (Excel)
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PERIODES.map(([p, label]) => (
          <Pill key={p} variant="cyan" active={periode === p} onClick={() => setPeriode(p)}>
            {label}
          </Pill>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTRES_STATUT.map(([f, label]) => (
          <Pill key={f} active={statut === f} onClick={() => setStatut(f)}>
            {label} <span className="opacity-60">· {duParc.filter((c) => correspondStatut(c, f)).length}</span>
          </Pill>
        ))}
      </div>
      {parcs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Pill active={!parcActif} onClick={() => setParc(null)}>
            Tous les parcs
          </Pill>
          {parcs.map(([p, n]) => (
            <Pill key={p} active={parcActif === p} onClick={() => setParc(p)}>
              {p} <span className="opacity-60">· {n}</span>
            </Pill>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-[12px] text-dim cursor-pointer self-start min-h-[36px]">
        <input type="checkbox" checked={voirRemplacees} onChange={(e) => setVoirRemplacees(e.target.checked)} className="w-4 h-4 accent-nikito-cyan" />
        Afficher aussi les anciennes versions des commandes modifiées
      </label>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Chiffre valeur={String(filtrees.length)} libelle={filtrees.length > 1 ? 'commandes' : 'commande'} />
            <Chiffre valeur={String(nbArticles)} libelle="articles commandés" />
            <Chiffre valeur={formatPrix(totalEngage)} libelle="montant estimé" />
          </div>
          <div className="text-[11px] text-faint -mt-1">Articles et montant : hors commandes refusées ou annulées.</div>

          {filtrees.length === 0 ? (
            <div className="text-center py-12 text-dim text-sm">Aucune commande sur cette période.</div>
          ) : (
            parMois.map(([mois, commandes]) => (
              <section key={mois} className="flex flex-col gap-2">
                <h2 className="text-[12px] text-dim uppercase tracking-wider mt-2 mb-0">
                  {mois} <span className="text-faint">· {commandes.length}</span>
                </h2>
                {commandes.map((c) => (
                  <LigneHistorique key={c.id} commande={c} />
                ))}
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06] p-3 text-center">
      <div className="text-[16px] md:text-[18px] font-semibold">{valeur}</div>
      <div className="text-[11px] text-dim">{libelle}</div>
    </div>
  );
}

function LigneHistorique({ commande: c }: { commande: Commande }) {
  const [ouverte, setOuverte] = useState(false);
  const statut = STATUTS_COMMANDE[c.statut];
  const remplacee = estRemplacee(c);
  const nb = c.commande_lignes.reduce((n, l) => n + l.quantite, 0);

  return (
    <div className={cn('bg-bg-card rounded-xl border border-white/[0.06]', remplacee && 'opacity-60')}>
      <button onClick={() => setOuverte((o) => !o)} className="w-full text-left p-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-nikito-cyan text-[13px]">{c.numero}</span>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-md font-medium', TONES[statut.tone])}>
              {remplacee ? 'Modifiée' : statut.label}
            </span>
            {c.directe && <span className="text-[11px] px-2 py-0.5 rounded-md bg-nikito-violet/15 text-nikito-violet">Directe</span>}
          </div>
          <div className="text-[12px] text-dim mt-1 truncate">
            {[c.parc?.code, nomDemandeur(c), formatDateHeure(c.cree_le)].filter(Boolean).join(' · ')}
          </div>
          {!ouverte && (
            <div className="text-[12px] text-faint mt-0.5 truncate">
              {c.commande_lignes.map((l) => `${l.quantite} × ${l.produit_nom}`).join(', ')}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[14px] font-semibold">{formatPrix(c.total_estime)}</div>
          <div className="text-[11px] text-faint">
            {nb} article{nb > 1 ? 's' : ''}
          </div>
        </div>
      </button>

      {ouverte && (
        <div className="px-3.5 pb-3.5 border-t border-white/[0.04]">
          <table className="w-full text-[13px] mt-2">
            <tbody>
              {c.commande_lignes.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2">
                    {l.produit_nom}
                    {l.specifique && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-nikito-violet/20 text-nikito-violet align-middle">Spécifique</span>
                    )}
                    <div className="text-[11px] text-faint">{[l.activite_nom, l.reference].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {l.quantite} {l.unite}
                  </td>
                  <td className="py-2 text-right text-dim whitespace-nowrap pl-3">
                    {l.prix_unitaire != null ? formatPrix(l.prix_unitaire * l.quantite) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.commentaire && (
            <p className="text-[12px] text-dim mt-3 whitespace-pre-line">
              <span className="text-faint uppercase text-[10px] tracking-wider block mb-0.5">Commentaire</span>
              {c.commentaire}
            </p>
          )}
          {c.motif_refus && (
            <p className={cn('text-[12px] mt-2', c.statut === 'refusee' ? 'text-red' : 'text-dim')}>
              {c.statut === 'refusee' ? 'Motif du refus : ' : ''}
              {c.motif_refus}
            </p>
          )}
          {c.traitee_le && <p className="text-[11px] text-faint mt-2">Dernier changement le {formatDateHeure(c.traitee_le)}</p>}
          <NotesPartagees type="commande" objetId={c.id} className="mt-3 p-3" />
        </div>
      )}
    </div>
  );
}
