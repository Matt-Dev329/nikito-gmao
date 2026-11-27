import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { roleLabels } from '@/lib/tokens';
import { cn } from '@/lib/utils';

/** Détail d'une personne dans les Stats (Ryad uniquement, contrôlé en base) */

interface Ticket {
  numero_bt: string;
  titre: string;
  le: string;
  statut?: string;
  parc: string | null;
  equipement: string | null;
  declare_le?: string;
}
interface Intervention {
  numero_bt: string;
  titre: string;
  le: string;
  minutes: number | null;
  diagnostic: string | null;
  actions_realisees: string | null;
  parc: string | null;
  en_binome: boolean | null;
}
interface Controle {
  type: string;
  le: string;
  parc: string | null;
  minutes: number | null;
}
interface Bon {
  numero: string | null;
  le: string;
  activite: string | null;
  equipement: string | null;
  minutes: number | null;
  parc: string | null;
}
interface Blesse {
  numero: string | null;
  le: string;
  niveau: string | null;
  activite: string | null;
  evacuation_hopital: boolean | null;
  parc: string | null;
  declare: boolean;
  appel: boolean;
}
interface Connexion {
  le: string;
  mode: string | null;
  appareil: string | null;
}
interface Detail {
  tickets_ouverts: Ticket[];
  tickets_clotures: Ticket[];
  interventions: Intervention[];
  controles: Controle[];
  bons: Bon[];
  blesses: Blesse[];
  connexions: Connexion[];
}

export interface PersonneStat {
  utilisateur_id: string;
  prenom: string;
  nom: string;
  role_code: string;
  parcs: string | null;
}

type Onglet = keyof Detail;

const ONGLETS: { code: Onglet; label: string }[] = [
  { code: 'tickets_clotures', label: 'Tickets clôturés' },
  { code: 'tickets_ouverts', label: 'Tickets ouverts' },
  { code: 'interventions', label: 'Réparations' },
  { code: 'controles', label: 'Contrôles' },
  { code: 'bons', label: 'Bons' },
  { code: 'blesses', label: 'Blessés' },
  { code: 'connexions', label: 'Connexions' },
];

const STATUTS: Record<string, string> = {
  ouvert: 'Ouvert',
  assigne: 'Assigné',
  en_cours: 'En cours',
  en_pause: 'En pause',
  resolu: 'Résolu',
  ferme: 'Fermé',
  annule: 'Annulé',
};

function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function duree(min: number | null | undefined): string {
  if (min === null || min === undefined) return '';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  return `${Math.floor(min / 1440)} j ${Math.floor((min % 1440) / 60)} h`;
}

function Ligne({ haut, bas, droite, lien }: { haut: string; bas?: string; droite?: string; lien?: string }) {
  const contenu = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium truncate">{haut}</div>
        {bas && <div className="text-[11px] text-dim mt-0.5 line-clamp-2">{bas}</div>}
      </div>
      {droite && <div className="text-[11px] text-dim text-right whitespace-pre-line shrink-0">{droite}</div>}
    </>
  );
  const classe = 'flex gap-3 items-start px-3 py-2.5 border-b border-white/[0.04]';
  return lien ? (
    <Link to={lien} className={cn(classe, 'hover:bg-white/[0.03]')}>
      {contenu}
    </Link>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

export function FichePersonne({ personne, jours, onFermer }: { personne: PersonneStat; jours: number; onFermer: () => void }) {
  const [onglet, setOnglet] = useState<Onglet>('tickets_clotures');
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats-detail', personne.utilisateur_id, jours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_detail_personne', {
        p_utilisateur_id: personne.utilisateur_id,
        p_depuis: new Date(Date.now() - jours * 86_400_000).toISOString(),
      });
      if (error) throw error;
      return data as Detail;
    },
  });

  // Échap pour fermer
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onFermer]);

  // Premier onglet non vide à l'ouverture
  useEffect(() => {
    if (!data) return;
    const premier = ONGLETS.find((o) => (data[o.code] ?? []).length > 0);
    if (premier) setOnglet(premier.code);
  }, [data]);

  const liste = data?.[onglet] ?? [];

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <button aria-label="Fermer" onClick={onFermer} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full md:w-[560px] h-full bg-bg-app border-l border-white/[0.08] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div>
            <div className="text-[17px] font-semibold">
              {personne.prenom} {personne.nom}
            </div>
            <div className="text-[12px] text-dim">
              {roleLabels[personne.role_code as keyof typeof roleLabels] ?? personne.role_code}
              {personne.parcs ? ` · ${personne.parcs}` : ''} · {jours} derniers jours
            </div>
          </div>
          <button onClick={onFermer} className="text-dim hover:text-text text-[22px] leading-none min-h-[40px] min-w-[40px]" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-white/[0.06]">
          {ONGLETS.map((o) => (
            <button
              key={o.code}
              onClick={() => setOnglet(o.code)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap border',
                onglet === o.code ? 'bg-nikito-cyan/15 border-nikito-cyan/40 text-nikito-cyan' : 'border-white/[0.08] text-dim'
              )}
            >
              {o.label} {data ? `(${(data[o.code] ?? []).length})` : ''}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="text-red text-[13px] p-4">Détail indisponible : {(error as Error).message}</div>
          ) : isLoading ? (
            <div className="text-dim text-[13px] p-8 text-center">Chargement…</div>
          ) : liste.length === 0 ? (
            <div className="text-dim text-[13px] p-8 text-center">Rien sur la période</div>
          ) : onglet === 'tickets_ouverts' || onglet === 'tickets_clotures' ? (
            (liste as Ticket[]).map((t, i) => (
              <Ligne
                key={`${t.numero_bt}-${i}`}
                lien={`/gmao/operations/${t.numero_bt}`}
                haut={`${t.numero_bt} · ${t.titre}`}
                bas={[t.parc, t.equipement, t.statut ? STATUTS[t.statut] ?? t.statut : null].filter(Boolean).join(' · ')}
                droite={
                  onglet === 'tickets_clotures' && t.declare_le
                    ? `${dateCourte(t.le)}\nen ${duree(Math.round((new Date(t.le).getTime() - new Date(t.declare_le).getTime()) / 60000))}`
                    : dateCourte(t.le)
                }
              />
            ))
          ) : onglet === 'interventions' ? (
            (liste as Intervention[]).map((iv, i) => (
              <Ligne
                key={`${iv.numero_bt}-${i}`}
                lien={`/gmao/operations/${iv.numero_bt}`}
                haut={`${iv.numero_bt} · ${iv.titre}`}
                bas={[iv.parc, iv.en_binome ? 'en binôme' : null, iv.diagnostic, iv.actions_realisees].filter(Boolean).join(' · ')}
                droite={`${dateCourte(iv.le)}${iv.minutes !== null ? `\n${duree(iv.minutes)}` : ''}`}
              />
            ))
          ) : onglet === 'controles' ? (
            (liste as Controle[]).map((c, i) => (
              <Ligne
                key={i}
                haut={`Contrôle ${c.type}`}
                bas={c.parc ?? undefined}
                droite={`${dateCourte(c.le)}${c.minutes !== null ? `\n${duree(c.minutes)}` : ''}`}
              />
            ))
          ) : onglet === 'bons' ? (
            (liste as Bon[]).map((b, i) => (
              <Ligne
                key={i}
                lien="/gmao/bons"
                haut={[b.numero, b.activite, b.equipement].filter(Boolean).join(' · ') || "Bon d'intervention"}
                bas={b.parc ?? undefined}
                droite={`${dateCourte(b.le)}${b.minutes ? `\n${duree(b.minutes)}` : ''}`}
              />
            ))
          ) : onglet === 'blesses' ? (
            (liste as Blesse[]).map((b, i) => (
              <Ligne
                key={i}
                lien="/gmao/blesses"
                haut={[b.numero, b.activite, b.niveau ? `niveau ${b.niveau}` : null].filter(Boolean).join(' · ')}
                bas={[b.parc, b.declare ? 'déclaré' : null, b.appel ? 'client rappelé' : null, b.evacuation_hopital ? 'hôpital' : null].filter(Boolean).join(' · ')}
                droite={dateCourte(b.le)}
              />
            ))
          ) : (
            (liste as Connexion[]).map((c, i) => (
              <Ligne key={i} haut={dateCourte(c.le)} bas={[c.mode === 'staff' || c.mode === 'pin' ? 'code PIN' : c.mode === 'compte' ? 'compte' : c.mode, c.appareil].filter(Boolean).join(' · ')} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
