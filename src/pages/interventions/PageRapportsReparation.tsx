import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { dateParis } from '@/lib/dates';
import { useAuth } from '@/hooks/useAuth';
import { useFormationFilter } from '@/hooks/useFormation';
import { useSignedUrls } from '@/hooks/useSignedUrl';
import { useToast } from '@/components/ui/ToastProvider';
import { Pill } from '@/components/ui/Pill';
import { BoutonTelecharger } from '@/components/ui/BoutonTelecharger';
import { nomDepuisChemin } from '@/lib/telecharger';

export const ROLES_RAPPORTS = ['direction', 'chef_maintenance', 'directeur_parc', 'manager_parc', 'technicien', 'admin_it'];

interface Rapport {
  cle: string;
  incident_id: string;
  numero_bt: string;
  activite: string;
  categorie: string | null;
  equipement: string | null;
  equipement_code: string | null;
  parc_code: string | null;
  parc_nom: string | null;
  zone: string | null;
  criticite: string | null;
  intervenant: string | null;
  externe: boolean;
  debut: string | null;
  fin: string;
  diagnostic: string | null;
  actions: string | null;
  resolu_premier_coup: boolean | null;
  photos_avant: string[];
  photos_apres: string[];
  pieces: { nom: string; reference: string; quantite: number }[];
}

const PERIODES = [
  { code: '7', label: '7 jours', jours: 7 },
  { code: '30', label: '30 jours', jours: 30 },
  { code: '90', label: '3 mois', jours: 90 },
  { code: '365', label: '1 an', jours: 365 },
];

function duree(debut: string | null, fin: string): string {
  if (!debut) return '—';
  const min = Math.max(0, Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, '0')}`;
  return `${Math.round(h / 24)} j`;
}

function useRapports(jours: number) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['rapports-reparation', jours, estFormation],
    queryFn: async () => {
      const depuis = dateParis(Date.now() - jours * 86_400_000);
      const { data, error } = await supabase.rpc('rapports_reparation', { p_depuis: depuis, p_formation: estFormation });
      if (error) throw error;
      return (data ?? []) as Rapport[];
    },
  });
}

/** Tous les rapports de réparation (équipe + intervenants extérieurs), rangés par activité. */
export function PageRapportsReparation() {
  const { utilisateur } = useAuth();
  if (utilisateur && !ROLES_RAPPORTS.includes(utilisateur.role_code)) return <Navigate to="/" replace />;
  return <ContenuRapports />;
}

function ContenuRapports() {
  const [periode, setPeriode] = useState('30');
  const [activite, setActivite] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const jours = PERIODES.find((p) => p.code === periode)?.jours ?? 30;
  const { data: rapports, isLoading, isError, error } = useRapports(jours);

  const activites = useMemo(() => {
    const m = new Map<string, number>();
    (rapports ?? []).forEach((r) => m.set(r.activite, (m.get(r.activite) ?? 0) + 1));
    return [...m.entries()].sort((a, b) =>
      a[0] === 'Autres' ? 1 : b[0] === 'Autres' ? -1 : a[0].localeCompare(b[0], 'fr')
    );
  }, [rapports]);
  const activiteActive = activite && activites.some(([a]) => a === activite) ? activite : null;

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (rapports ?? []).filter(
      (r) =>
        (!activiteActive || r.activite === activiteActive) &&
        (!q ||
          [r.numero_bt, r.equipement, r.equipement_code, r.parc_code, r.intervenant, r.diagnostic, r.actions]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q))
    );
  }, [rapports, activiteActive, recherche]);

  // Regroupement par activité (dans l'ordre alphabétique, « Autres » en dernier)
  const groupes = useMemo(() => {
    const m = new Map<string, Rapport[]>();
    filtres.forEach((r) => m.set(r.activite, [...(m.get(r.activite) ?? []), r]));
    return [...m.entries()].sort((a, b) =>
      a[0] === 'Autres' ? 1 : b[0] === 'Autres' ? -1 : a[0].localeCompare(b[0], 'fr')
    );
  }, [filtres]);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <h1 className="text-xl md:text-[22px] font-semibold m-0">Rapports de réparation</h1>
      <p className="text-[13px] text-dim mt-1 mb-4">
        Toutes les réparations terminées, rangées par activité ({(rapports ?? []).length} sur la période)
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PERIODES.map((p) => (
            <Pill key={p.code} active={periode === p.code} onClick={() => setPeriode(p.code)}>
              {p.label}
            </Pill>
          ))}
        </div>
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (BT, équipement, parc, technicien, diagnostic…)"
          className="bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
        />
        {activites.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Pill variant="cyan" active={!activiteActive} onClick={() => setActivite(null)}>
              Toutes <span className="opacity-60">· {(rapports ?? []).length}</span>
            </Pill>
            {activites.map(([a, n]) => (
              <Pill key={a} variant="cyan" active={activiteActive === a} onClick={() => setActivite(a)}>
                {a} <span className="opacity-60">· {n}</span>
              </Pill>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : groupes.length === 0 ? (
        <div className="text-center py-16 text-dim text-sm">Aucun rapport de réparation sur cette période.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupes.map(([act, liste]) => (
            <section key={act}>
              <h2 className="text-[13px] text-dim uppercase tracking-wider mb-2">
                {act} <span className="text-faint">· {liste.length}</span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {liste.map((r) => (
                  <CarteRapport key={r.cle} rapport={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CarteRapport({ rapport: r }: { rapport: Rapport }) {
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const [pdfEnCours, setPdfEnCours] = useState(false);
  const { data: urls } = useSignedUrls(ouvert ? [...r.photos_avant, ...r.photos_apres] : [], 'alba-interventions');

  const telechargerPdf = async () => {
    setPdfEnCours(true);
    try {
      const { exportInterventionPDF } = await import('@/pages/technicien/exportInterventionPDF');
      await exportInterventionPDF({
        numeroBT: r.numero_bt,
        titre: [r.activite, r.equipement].filter(Boolean).join(' · '),
        equipementLibelle: r.equipement ?? '',
        equipementCode: r.equipement_code ?? '',
        parcNom: r.parc_nom ?? '',
        zoneNom: r.zone ?? '',
        criticite: r.criticite ?? 'mineur',
        diagnostic: r.diagnostic ?? '',
        actions: r.actions ?? '',
        resoluPremierCoup: r.resolu_premier_coup,
        debut: r.debut,
        fin: r.fin,
        technicienNom: r.intervenant ?? '',
        pieces: r.pieces,
        photoBucket: 'alba-interventions',
        photoAvantPath: r.photos_avant[0] ?? null,
        photoApresPath: r.photos_apres[0] ?? null,
      });
    } catch (e) {
      toast.error(`PDF impossible : ${(e as Error).message}`);
    } finally {
      setPdfEnCours(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06]">
      <button onClick={() => setOuvert((o) => !o)} className="w-full text-left p-3.5 px-4 flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold truncate">
            {[r.activite, r.equipement].filter(Boolean).join(' · ')}
          </div>
          <div className="text-[12px] text-dim mt-0.5">
            {new Date(r.fin).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} ·{' '}
            {r.numero_bt}
            {r.parc_code ? ` · ${r.parc_code}` : ''} · {r.intervenant ?? '—'}
            {!r.externe && ` · ${duree(r.debut, r.fin)}`}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {r.externe ? (
            <span className="text-[10px] bg-amber/15 text-amber px-2 py-0.5 rounded">Extérieur</span>
          ) : r.resolu_premier_coup === true ? (
            <span className="text-[10px] bg-green/15 text-green px-2 py-0.5 rounded">1er coup</span>
          ) : r.resolu_premier_coup === false ? (
            <span className="text-[10px] bg-red/15 text-red px-2 py-0.5 rounded">Pas au 1er coup</span>
          ) : null}
          <span className="text-dim text-[12px]">{ouvert ? '▲' : '▼'}</span>
        </div>
      </button>

      {ouvert && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 grid gap-3 text-[13px]">
          {r.diagnostic && (
            <div>
              <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Diagnostic</div>
              <div className="whitespace-pre-line">{r.diagnostic}</div>
            </div>
          )}
          {r.actions && (
            <div>
              <div className="text-[11px] text-dim uppercase tracking-wider mb-1">
                {r.externe ? 'Compte-rendu de l’intervenant' : 'Actions réalisées'}
              </div>
              <div className="whitespace-pre-line">{r.actions}</div>
            </div>
          )}
          {r.pieces.length > 0 && (
            <div>
              <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Pièces utilisées</div>
              <ul className="list-disc pl-5">
                {r.pieces.map((p) => (
                  <li key={`${p.reference}-${p.nom}`}>
                    {p.quantite} × {p.nom} <span className="text-dim">({p.reference})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(r.photos_avant.length > 0 || r.photos_apres.length > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {[...r.photos_avant.map((p) => ['AVANT', p]), ...r.photos_apres.map((p) => ['APRÈS', p])].map(([lib, p]) => (
                <a key={p} href={urls?.[p]} target="_blank" rel="noreferrer" className="block relative">
                  <div className="text-[10px] text-dim mb-1">{lib}</div>
                  <BoutonTelecharger
                    url={urls?.[p]}
                    nom={nomDepuisChemin(p, `${r.numero_bt}_${lib === 'AVANT' ? 'avant' : 'apres'}`)}
                    compact
                    className="absolute top-6 right-1.5"
                  />
                  {urls?.[p] ? (
                    <img src={urls[p]} alt={`Photo ${lib}`} loading="lazy" className="w-full aspect-[4/3] object-cover rounded-lg bg-bg-deep" />
                  ) : (
                    <div className="w-full aspect-[4/3] rounded-lg bg-bg-deep animate-pulse" />
                  )}
                </a>
              ))}
            </div>
          )}
          <div className={cn('flex flex-wrap gap-2 pt-1')}>
            <button
              onClick={() => navigate(`/gmao/operations/${r.numero_bt}`)}
              className="bg-bg-deep border border-white/[0.08] px-4 rounded-[10px] text-[13px] min-h-[44px]"
            >
              Voir le ticket
            </button>
            {!r.externe && (
              <button
                onClick={telechargerPdf}
                disabled={pdfEnCours}
                className="bg-nikito-cyan/15 text-nikito-cyan border border-nikito-cyan/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                {pdfEnCours ? 'PDF…' : 'Télécharger le PDF'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
