import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { chargerToutesLesPages } from '@/lib/paginer';
import { useAuth } from '@/hooks/useAuth';
import { useFormationFilter } from '@/hooks/useFormation';
import { Pill } from '@/components/ui/Pill';
import { aAcces, ROLES_HISTORIQUES } from '@/lib/acces';
import { useFiltreParc } from '@/hooks/useParcCourant';

interface TicketHistorique {
  id: string;
  numero_bt: string;
  titre: string | null;
  description: string | null;
  statut: string;
  validation_manager: string | null;
  declare_le: string;
  resolu_le: string | null;
  declare_par_nom: string | null;
  supprime_motif: string | null;
  parc_ticket_code: string | null;
  externe: boolean | null;
  attente_piece: boolean | null;
  equipements: { code: string; libelle: string; categories_equipement: { activite: string | null } | null } | null;
  niveaux_priorite: { code: string; nom: string } | null;
}

type Periode = '30j' | '3m' | '12m' | 'tout';
const PERIODES: [Periode, string, number | null][] = [
  ['30j', '30 jours', 30],
  ['3m', '3 mois', 92],
  ['12m', '12 mois', 366],
  ['tout', 'Tout', null],
];

type FiltreStatut = 'tous' | 'en_cours' | 'a_valider' | 'resolus' | 'annules';
const FILTRES: [FiltreStatut, string][] = [
  ['tous', 'Tous'],
  ['en_cours', 'En cours'],
  ['a_valider', 'À valider'],
  ['resolus', 'Résolus'],
  ['annules', 'Refusés / supprimés'],
];

const OUVERTS = ['ouvert', 'assigne', 'en_cours', 'en_pause'];
const categorie = (t: TicketHistorique): FiltreStatut => {
  if (t.statut === 'annule') return 'annules';
  if (t.validation_manager === 'en_attente') return 'a_valider';
  if (t.statut === 'resolu' || t.statut === 'ferme') return 'resolus';
  return 'en_cours';
};

const ETATS: Record<Exclude<FiltreStatut, 'tous'>, { label: string; classe: string }> = {
  en_cours: { label: 'En cours', classe: 'bg-nikito-cyan/12 text-nikito-cyan' },
  a_valider: { label: 'À valider', classe: 'bg-amber/15 text-amber' },
  resolus: { label: 'Résolu', classe: 'bg-green/15 text-green' },
  annules: { label: 'Refusé / supprimé', classe: 'bg-white/[0.06] text-dim' },
};
const DETAIL_STATUT: Record<string, string> = {
  ouvert: 'à faire',
  assigne: 'assigné',
  en_cours: 'intervention en cours',
  en_pause: 'en pause',
};

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const moisDe = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
function duree(debut: string, fin: string): string {
  const h = (new Date(fin).getTime() - new Date(debut).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
}

function useHistoriqueTickets() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['incidents', 'historique', estFormation],
    queryFn: () =>
      chargerToutesLesPages<TicketHistorique>((debut, fin) =>
        supabase
          .from('incidents')
          .select(
            `id, numero_bt, titre, description, statut, validation_manager, declare_le, resolu_le, declare_par_nom,
             supprime_motif, parc_ticket_code, externe, attente_piece,
             equipements(code, libelle, categories_equipement(activite)),
             niveaux_priorite(code, nom)`
          )
          .eq('est_formation', estFormation)
          .or('est_brouillon.is.null,est_brouillon.eq.false')
          .order('declare_le', { ascending: false })
          .order('id')
          .range(debut, fin)
      ),
    refetchInterval: 120_000,
  });
}

/**
 * Historique de tous les tickets (en cours, à valider, résolus, refusés) :
 * chacun voit ceux de ses parcs (directeurs de parc, managers principaux),
 * le chef d'équipe et la direction voient tout. Droits en base (RLS incidents).
 */
export function PageHistoriqueTickets() {
  const { utilisateur } = useAuth();
  if (utilisateur && !aAcces(utilisateur, ROLES_HISTORIQUES)) return <Navigate to="/gmao/operations" replace />;
  return <ContenuHistoriqueTickets />;
}

function ContenuHistoriqueTickets() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useHistoriqueTickets();
  const [recherche, setRecherche] = useState('');
  const [periode, setPeriode] = useState<Periode>('3m');
  const [statut, setStatut] = useState<FiltreStatut>('tous');
  const [parc, setParc] = useFiltreParc(null, 'code');
  const [activite, setActivite] = useState<string | null>(null);

  const base = useMemo(() => {
    const jours = PERIODES.find(([p]) => p === periode)?.[2] ?? null;
    const depuis = jours ? Date.now() - jours * 86_400_000 : 0;
    const q = recherche.trim().toLowerCase();
    return (data ?? [])
      .filter((t) => new Date(t.declare_le).getTime() >= depuis)
      .filter(
        (t) =>
          !q ||
          [t.numero_bt, t.titre, t.description, t.declare_par_nom, t.parc_ticket_code, t.equipements?.code, t.equipements?.libelle, t.supprime_motif]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q)
      );
  }, [data, periode, recherche]);

  const compter = (liste: TicketHistorique[], cle: (t: TicketHistorique) => string | null | undefined) => {
    const m = new Map<string, number>();
    liste.forEach((t) => {
      const k = cle(t);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  };
  const parcs = useMemo(() => compter(base, (t) => t.parc_ticket_code), [base]);
  const parcActif = parc;
  const duParc = base.filter((t) => !parcActif || t.parc_ticket_code === parcActif);
  const activites = useMemo(() => compter(duParc, (t) => t.equipements?.categories_equipement?.activite ?? 'Autres'), [duParc]);
  const activiteActive = activite && activites.some(([a]) => a === activite) ? activite : null;
  const dansActivite = duParc.filter((t) => !activiteActive || (t.equipements?.categories_equipement?.activite ?? 'Autres') === activiteActive);
  const filtres = dansActivite.filter((t) => statut === 'tous' || categorie(t) === statut);

  const resolus = dansActivite.filter((t) => categorie(t) === 'resolus' && t.resolu_le);
  const delaiMoyenH = resolus.length
    ? resolus.reduce((s, t) => s + (new Date(t.resolu_le!).getTime() - new Date(t.declare_le).getTime()), 0) / resolus.length / 3_600_000
    : null;

  const parMois = useMemo(() => {
    const m = new Map<string, TicketHistorique[]>();
    filtres.forEach((t) => m.set(moisDe(t.declare_le), [...(m.get(moisDe(t.declare_le)) ?? []), t]));
    return [...m.entries()];
  }, [filtres]);

  const exporterCsv = () => {
    const lignes = [
      ['Ticket', 'Signalé le', 'Parc', 'Activité', 'Équipement', 'Titre', 'Description', 'Gravité', 'État', 'Signalé par', 'Résolu le', 'Durée', 'Motif refus / suppression'],
      ...filtres.map((t) => [
        t.numero_bt,
        dateHeure(t.declare_le),
        t.parc_ticket_code ?? '',
        t.equipements?.categories_equipement?.activite ?? '',
        t.equipements ? `${t.equipements.code} · ${t.equipements.libelle}` : '',
        t.titre ?? '',
        t.description ?? '',
        t.niveaux_priorite?.nom ?? '',
        ETATS[categorie(t) as Exclude<FiltreStatut, 'tous'>].label,
        t.declare_par_nom ?? '',
        t.resolu_le ? dateHeure(t.resolu_le) : '',
        t.resolu_le ? duree(t.declare_le, t.resolu_le) : '',
        t.supprime_motif ?? '',
      ]),
    ];
    const csv = lignes.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const lien = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = lien;
    a.download = `historique_tickets_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(lien), 60_000);
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="mb-4">
        <h1 className="text-xl md:text-[22px] font-semibold m-0">Historique des tickets</h1>
        <p className="text-[13px] text-dim mt-1">Tous les tickets de tes parcs : en cours, à valider, résolus, refusés ou supprimés</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (numéro, équipement, panne, personne…)"
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <button
            onClick={exporterCsv}
            disabled={filtres.length === 0}
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
          {FILTRES.map(([f, label]) => (
            <Pill key={f} active={statut === f} onClick={() => setStatut(f)}>
              {label} <span className="opacity-60">· {dansActivite.filter((t) => f === 'tous' || categorie(t) === f).length}</span>
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
        {activites.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill active={!activiteActive} onClick={() => setActivite(null)}>
              Toutes activités
            </Pill>
            {activites.map(([a, n]) => (
              <Pill key={a} active={activiteActive === a} onClick={() => setActivite(a)}>
                {a} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-bg-card rounded-xl h-16 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Chiffre valeur={String(dansActivite.length)} libelle="tickets signalés" />
              <Chiffre valeur={String(dansActivite.filter((t) => categorie(t) === 'en_cours').length)} libelle="en cours" />
              <Chiffre valeur={String(resolus.length)} libelle="résolus" />
              <Chiffre
                valeur={delaiMoyenH === null ? '—' : delaiMoyenH < 48 ? `${Math.round(delaiMoyenH)} h` : `${Math.round(delaiMoyenH / 24)} j`}
                libelle="délai moyen de résolution"
              />
            </div>

            {filtres.length === 0 ? (
              <div className="text-center py-12 text-dim text-sm">Aucun ticket sur cette période.</div>
            ) : (
              parMois.map(([mois, tickets]) => (
                <section key={mois} className="flex flex-col gap-2">
                  <h2 className="text-[12px] text-dim uppercase tracking-wider mt-2 mb-0">
                    {mois} <span className="text-faint">· {tickets.length}</span>
                  </h2>
                  {tickets.map((t) => (
                    <LigneTicket key={t.id} ticket={t} onOuvrir={() => navigate(`/gmao/operations/${t.numero_bt}`)} />
                  ))}
                </section>
              ))
            )}
          </>
        )}
      </div>
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

function LigneTicket({ ticket: t, onOuvrir }: { ticket: TicketHistorique; onOuvrir: () => void }) {
  const cat = categorie(t) as Exclude<FiltreStatut, 'tous'>;
  const etat = ETATS[cat];
  const detail =
    cat === 'en_cours'
      ? [DETAIL_STATUT[t.statut], t.attente_piece ? 'pièce en attente' : null, t.externe ? 'intervenant extérieur' : null].filter(Boolean).join(' · ')
      : null;
  return (
    <button
      onClick={onOuvrir}
      className={cn(
        'w-full text-left bg-bg-card rounded-xl border border-white/[0.06] hover:border-nikito-cyan/40 p-3.5 flex items-center gap-3 transition-colors',
        cat === 'annules' && 'opacity-70'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-nikito-cyan text-[13px]">{t.numero_bt}</span>
          <span className={cn('text-[11px] px-2 py-0.5 rounded-md font-medium', etat.classe)}>{etat.label}</span>
          {detail && <span className="text-[11px] text-dim">{detail}</span>}
          {t.niveaux_priorite?.code === 'bloquant' && OUVERTS.includes(t.statut) && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-red/15 text-red">Bloquant</span>
          )}
        </div>
        <div className="text-[14px] font-semibold mt-1 truncate">
          {[t.equipements?.categories_equipement?.activite, t.equipements?.libelle ?? t.titre].filter(Boolean).join(' · ')}
        </div>
        {t.description && <div className="text-[12px] text-dim truncate">{t.description}</div>}
        {cat === 'annules' && t.supprime_motif && <div className="text-[12px] text-dim truncate">Motif : {t.supprime_motif}</div>}
        <div className="text-[11px] text-faint mt-0.5">
          {[t.parc_ticket_code, dateHeure(t.declare_le), t.declare_par_nom ? `par ${t.declare_par_nom}` : null, t.resolu_le ? `résolu en ${duree(t.declare_le, t.resolu_le)}` : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <span className="text-faint text-[18px]" aria-hidden>
        ›
      </span>
    </button>
  );
}
