import { useState, useMemo } from 'react';
import { KpiCard } from '@/components/kpi/KpiCard';
import { Card } from '@/components/ui/Card';
import { CritTag } from '@/components/ui/CritTag';
import { Pill } from '@/components/ui/Pill';
import { useRecurrencesActives } from '@/hooks/queries/useKpi';
import { useFiches5Pourquoi } from '@/hooks/queries/useTickets';
import { useParcs } from '@/hooks/queries/useReferentiel';
import type { Criticite } from '@/types/database';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className ?? ''}`} />
  );
}

function RecurrenceSkeleton() {
  return (
    <Card className="mb-3 p-4 px-[18px] animate-pulse">
      <div className="flex items-center gap-2.5 flex-wrap">
        <SkeletonBlock className="h-5 w-20" />
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="h-3 w-28 ml-auto" />
      </div>
      <div className="grid grid-cols-3 gap-2.5 mt-3.5">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
      </div>
    </Card>
  );
}

function getCriticite(pannes30j: number, plaintes7j: number): Criticite {
  if (pannes30j >= 5 || plaintes7j >= 3) return 'bloquant';
  if (pannes30j >= 3 || plaintes7j >= 1) return 'majeur';
  return 'mineur';
}

export function Recurrences() {
  const [parcActif, setParcActif] = useState<string | null>(null);
  const [seuilPannes, setSeuilPannes] = useState(3);

  const recurrencesQ = useRecurrencesActives();
  const fiches5pQ = useFiches5Pourquoi();
  const parcsQ = useParcs();

  const loading = recurrencesQ.isLoading || fiches5pQ.isLoading;

  const recurrences = useMemo(() => {
    if (!recurrencesQ.data) return [];
    let filtered = recurrencesQ.data as Record<string, unknown>[];
    if (parcActif) {
      const parcNom = (parcsQ.data as Record<string, unknown>[] | undefined)
        ?.find((p) => p.id === parcActif);
      if (parcNom) {
        filtered = filtered.filter((r) => r.parc_nom === (parcNom.nom as string));
      }
    }
    return filtered
      .filter((r) => (r.pannes_30j as number) >= seuilPannes || (r.a_surveiller as boolean))
      .sort((a, b) => (b.pannes_30j as number) - (a.pannes_30j as number));
  }, [recurrencesQ.data, parcActif, parcsQ.data, seuilPannes]);

  const fiches5p = useMemo(() => {
    if (!fiches5pQ.data) return [];
    return fiches5pQ.data as Record<string, unknown>[];
  }, [fiches5pQ.data]);

  const kpi = useMemo(() => {
    const aSurveiller = recurrences.length;
    const fichesOuvertes = fiches5p.filter((f) => f.statut === 'ouvert' || f.statut === 'valide').length;
    const audits = fiches5p.filter((f) => f.statut === 'audit_en_cours').length;
    const standards = fiches5p.filter((f) => f.statut === 'clos').length;
    return { aSurveiller, fichesOuvertes, audits, standards };
  }, [recurrences, fiches5p]);

  const parcs = (parcsQ.data ?? []) as Record<string, unknown>[];

  return (
    <div className="p-4 md:p-6 md:px-7 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-[18px]">
        <div>
          <div className="text-[11px] text-dim tracking-[1.5px] uppercase mb-1">
            Boucle d'apprentissage Lean
          </div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Récurrences actives · à arbitrer</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSeuilPannes(seuilPannes === 2 ? 3 : 2)}
            className={
              seuilPannes === 2
                ? 'bg-gradient-cta text-text px-3.5 py-1.5 rounded-lg text-xs font-medium min-h-[44px] md:min-h-0'
                : 'bg-bg-card border border-white/[0.08] text-text px-3.5 py-1.5 rounded-lg text-xs min-h-[44px] md:min-h-0'
            }
          >
            {seuilPannes === 2 ? '>=2 pannes/30j' : '>=3 pannes/30j'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        <Pill active={parcActif === null} onClick={() => setParcActif(null)}>
          Tous les parcs
        </Pill>
        {parcs.map((p) => (
          <Pill
            key={p.id as string}
            active={parcActif === (p.id as string)}
            onClick={() => setParcActif(p.id as string)}
          >
            {p.code as string} · {p.nom as string}
          </Pill>
        ))}
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-[22px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-20" />
            ))}
          </div>
          <RecurrenceSkeleton />
          <RecurrenceSkeleton />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-[22px]">
            <KpiCard label="Équipements à surveiller" valeur={kpi.aSurveiller.toString()} couleur="red" />
            <KpiCard label="5 Pourquoi en cours" valeur={kpi.fichesOuvertes.toString()} couleur="amber" />
            <KpiCard label="Audits 90j programmés" valeur={kpi.audits.toString()} couleur="cyan" />
            <KpiCard label="Standards évolutifs validés" valeur={kpi.standards.toString()} couleur="green" />
          </div>

          {recurrences.length === 0 ? (
            <div className="text-center py-12 text-dim text-sm">
              Aucune récurrence active détectée
            </div>
          ) : (
            recurrences.map((rec, idx) => {
              const pannes30j = rec.pannes_30j as number;
              const pannes90j = rec.pannes_90j as number;
              const plaintes7j = rec.plaintes_7j as number;
              const criticite = getCriticite(pannes30j, plaintes7j);
              const a5p = rec.a_5_pourquoi as boolean;
              const equipId = rec.equipement_id as string;

              const fiche5p = fiches5p.find(
                (f) => (f.equipement_id as string) === equipId && f.statut !== 'clos'
              );

              const borderColor = criticite === 'bloquant' ? 'pink'
                : criticite === 'majeur' ? 'amber' : 'cyan';

              return (
                <Card key={equipId} borderLeft={borderColor as 'pink' | 'amber' | 'cyan'} className="mb-3">
                  {idx === 0 && fiche5p ? (
                    <RecurrenceDetaillée
                      rec={rec}
                      fiche5p={fiche5p}
                      criticite={criticite}
                      pannes30j={pannes30j}
                      pannes90j={pannes90j}
                      plaintes7j={plaintes7j}
                    />
                  ) : (
                    <RecurrenceCompacte
                      rec={rec}
                      criticite={criticite}
                      pannes30j={pannes30j}
                      plaintes7j={plaintes7j}
                      a5p={a5p}
                    />
                  )}
                </Card>
              );
            })
          )}

          {fiches5p.filter((f) => f.statut === 'audit_en_cours').length > 0 && (
            <div className="mt-[18px]">
              {fiches5p
                .filter((f) => f.statut === 'audit_en_cours')
                .map((f) => {
                  const equip = f.equipements as Record<string, unknown> | null;
                  return (
                    <Card
                      key={f.id as string}
                      borderLeft="cyan"
                      className="mb-3 p-3.5 px-[18px] flex items-center gap-3.5 flex-wrap"
                    >
                      <div className="bg-nikito-cyan text-bg-app w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                        A
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-[13px] font-semibold">
                          Audit 90j · {equip?.libelle as string ?? equip?.code as string ?? ''}
                        </div>
                        <div className="text-[11px] text-dim mt-0.5">
                          Date audit : {f.date_audit as string ?? 'à planifier'}
                        </div>
                      </div>
                      <button className="bg-transparent border border-nikito-cyan text-nikito-cyan py-2 px-3.5 rounded-lg text-xs min-h-[44px]">
                        Préparer audit
                      </button>
                    </Card>
                  );
                })}
            </div>
          )}

          <div className="bg-bg-deep rounded-xl p-3.5 px-[18px] flex items-center gap-3.5 border border-dashed border-nikito-cyan/30 mt-4">
            <div className="text-[11px] text-dim leading-relaxed flex-1">
              <strong className="text-nikito-pink">Cycle PDCA strict :</strong> quand tu valides un 5
              Pourquoi, l'audit 90j est programmé automatiquement. Si une panne identique se reproduit
              dans cet intervalle, la contre-mesure est marquée "inefficace" et le 5 Pourquoi se
              rouvre.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RecurrenceDetaillée({
  rec,
  fiche5p,
  criticite,
  pannes30j,
  pannes90j,
  plaintes7j,
}: {
  rec: Record<string, unknown>;
  fiche5p: Record<string, unknown>;
  criticite: Criticite;
  pannes30j: number;
  pannes90j: number;
  plaintes7j: number;
}) {
  const pourquois = [
    fiche5p.pourquoi_1 as string | null,
    fiche5p.pourquoi_2 as string | null,
    fiche5p.pourquoi_3 as string | null,
    fiche5p.pourquoi_4 as string | null,
    fiche5p.pourquoi_5 as string | null,
  ];

  return (
    <>
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <CritTag niveau={criticite} />
        <span className="text-[15px] font-semibold">{rec.libelle as string}</span>
        <span className="bg-bg-deep text-dim px-2 py-0.5 rounded text-[11px]">{rec.code as string}</span>
        <span className="sm:ml-auto text-[11px] text-dim">{rec.parc_nom as string}</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-3.5">
        <div className="bg-bg-deep rounded-lg p-3 px-3.5">
          <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Pannes 30j</div>
          <div className="text-xl font-semibold text-red">{pannes30j}</div>
        </div>
        <div className="bg-bg-deep rounded-lg p-3 px-3.5">
          <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Pannes 90j</div>
          <div className="text-xl font-semibold text-amber">{pannes90j}</div>
        </div>
        <div className="bg-bg-deep rounded-lg p-3 px-3.5">
          <div className="text-[10px] text-dim uppercase tracking-wider mb-1">Plaintes 7j</div>
          <div className="text-xl font-semibold text-nikito-pink">{plaintes7j}</div>
        </div>
      </div>

      <div className="bg-bg-deep rounded-[10px] p-3.5 px-4 mb-3.5">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-2.5">
          5 Pourquoi · {fiche5p.statut as string}
        </div>
        <div className="flex flex-col gap-2">
          {fiche5p.cause_racine ? (
            <Pourquoi numero="P" texte={`Symptôme : ${fiche5p.cause_racine as string}`} couleurNum="pink" />
          ) : null}
          {pourquois.map((p, i) =>
            p ? (
              <Pourquoi
                key={i}
                numero={String(i + 1)}
                texte={`Pourquoi ? ${p}`}
                couleurNum="cyan"
              />
            ) : i === 0 || pourquois[i - 1] ? (
              <Pourquoi
                key={i}
                numero={String(i + 1)}
                texte="À renseigner..."
                couleurNum="cyan"
                italic
              />
            ) : null
          )}
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap">
        <button className="flex-1 min-w-[160px] bg-gradient-cta text-text py-3 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]">
          Continuer le 5 Pourquoi
        </button>
        <button className="bg-bg-deep border border-white/10 text-text py-3 px-4 rounded-[10px] text-[13px] min-h-[44px]">
          Voir historique pannes
        </button>
        <button className="bg-bg-deep border border-white/10 text-text py-3 px-4 rounded-[10px] text-[13px] min-h-[44px]">
          Plaintes liées
        </button>
      </div>
    </>
  );
}

function RecurrenceCompacte({
  rec,
  criticite,
  pannes30j,
  plaintes7j,
  a5p,
}: {
  rec: Record<string, unknown>;
  criticite: Criticite;
  pannes30j: number;
  plaintes7j: number;
  a5p: boolean;
}) {
  return (
    <div className="p-4 px-[18px]">
      <div className="flex items-center gap-2.5 flex-wrap">
        <CritTag niveau={criticite} />
        <span className="text-sm font-semibold">{rec.libelle as string}</span>
        <span className="bg-bg-deep text-dim px-2 py-0.5 rounded text-[11px]">{rec.code as string}</span>
        {a5p && (
          <span className="bg-bg-deep text-nikito-pink px-2 py-0.5 rounded-md text-[11px]">
            5P en cours
          </span>
        )}
        <span className="ml-auto text-[11px] text-dim">
          {pannes30j} pannes/30j{plaintes7j > 0 ? ` · ${plaintes7j} plainte${plaintes7j > 1 ? 's' : ''}/7j` : ''}
        </span>
      </div>
      <div className="mt-2.5 flex gap-2">
        <button className="bg-gradient-cta text-text py-2 px-3.5 rounded-lg text-xs font-medium min-h-[44px]">
          {a5p ? 'Voir 5 Pourquoi' : 'Ouvrir 5 Pourquoi'}
        </button>
        <button className="bg-bg-deep border border-white/10 text-dim py-2 px-3.5 rounded-lg text-xs min-h-[44px]">
          Historique
        </button>
      </div>
    </div>
  );
}

function Pourquoi({
  numero,
  texte,
  couleurNum,
  italic,
}: {
  numero: string;
  texte: string;
  couleurNum: 'pink' | 'cyan';
  italic?: boolean;
}) {
  const bg = couleurNum === 'pink' ? 'bg-nikito-pink' : 'bg-nikito-cyan';
  return (
    <div className="flex gap-3 items-start">
      <div className={`${bg} text-bg-app w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0`}>
        {numero}
      </div>
      <div className={`text-[13px] leading-relaxed ${italic ? 'text-dim italic' : ''}`}>
        {texte}
      </div>
    </div>
  );
}
