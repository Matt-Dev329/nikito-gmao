import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { voitTableauDeBord } from '@/lib/acces';
import { roleLabels } from '@/lib/tokens';
import { cn } from '@/lib/utils';

/**
 * Stats de l'équipe (Ryad uniquement, discret : invisible pour les autres
 * comptes). Par compte : tickets ouverts / clôturés, interventions et temps
 * passé, contrôles et temps passé, bons d'intervention, connexions.
 */
interface LigneStat {
  utilisateur_id: string;
  prenom: string;
  nom: string;
  role_code: string;
  parcs: string | null;
  actif: boolean;
  tickets_ouverts: number;
  tickets_clotures: number;
  interventions: number;
  minutes_intervention: number;
  controles: number;
  minutes_controles: number;
  bons: number;
  minutes_bons: number;
  blesses_declares: number;
  appels_clients: number;
  connexions: number;
  derniere_connexion: string | null;
}

const PERIODES = [
  { code: '7', label: '7 jours', jours: 7 },
  { code: '30', label: '30 jours', jours: 30 },
  { code: '90', label: '3 mois', jours: 90 },
  { code: '365', label: '1 an', jours: 365 },
];

interface LigneBlesses {
  parc: string;
  niveau: string;
  activite: string;
  blesses: number;
  hopital: number;
  client_appele: number;
  appel_attendu: number;
}

type Tri = 'tickets_clotures' | 'tickets_ouverts' | 'minutes_intervention' | 'minutes_controles' | 'minutes_bons' | 'blesses_declares' | 'connexions' | 'derniere_connexion' | 'nom';

const COLONNES: { code: Tri; label: string }[] = [
  { code: 'tickets_ouverts', label: 'Tickets ouverts' },
  { code: 'tickets_clotures', label: 'Tickets clôturés' },
  { code: 'minutes_intervention', label: 'Réparations' },
  { code: 'minutes_controles', label: 'Contrôles' },
  { code: 'minutes_bons', label: 'Bons' },
  { code: 'blesses_declares', label: 'Blessés' },
  { code: 'connexions', label: 'Connexions' },
  { code: 'derniere_connexion', label: 'Dernière connexion' },
];

function duree(min: number): string {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, '0')}`;
}

function depuis(iso: string | null): string {
  if (!iso) return 'jamais';
  const d = new Date(iso);
  const jours = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (jours <= 0) return `aujourd’hui ${heure}`;
  if (jours === 1) return `hier ${heure}`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function PageStats() {
  const { utilisateur } = useAuth();
  if (!voitTableauDeBord(utilisateur)) return <Navigate to="/gmao/operations" replace />;
  return <ContenuStats />;
}

function ContenuStats() {
  const [periode, setPeriode] = useState('30');
  const [role, setRole] = useState('tous');
  const [parc, setParc] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('tickets_clotures');
  const [actifsSeuls, setActifsSeuls] = useState(true);

  const jours = PERIODES.find((p) => p.code === periode)?.jours ?? 30;
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats-equipe', jours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_equipe', {
        p_depuis: new Date(Date.now() - jours * 86_400_000).toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as LigneStat[];
    },
  });

  const blessesQ = useQuery({
    queryKey: ['stats-blesses', jours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_blesses', {
        p_depuis: new Date(Date.now() - jours * 86_400_000).toISOString(),
      });
      if (error) throw error;
      return (data ?? []) as LigneBlesses[];
    },
  });
  const blesses = useMemo(() => {
    const lignes = (blessesQ.data ?? []).filter((l) => parc === 'tous' || l.parc === parc);
    const grouper = (cle: (l: LigneBlesses) => string) => {
      const m = new Map<string, number>();
      lignes.forEach((l) => m.set(cle(l), (m.get(cle(l)) ?? 0) + Number(l.blesses)));
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const somme = (k: keyof LigneBlesses) => lignes.reduce((n, l) => n + Number(l[k]), 0);
    return {
      total: somme('blesses'),
      hopital: somme('hopital'),
      appeles: somme('client_appele'),
      aAppeler: somme('appel_attendu'),
      parParc: grouper((l) => l.parc),
      parNiveau: grouper((l) => `Niveau ${l.niveau}`).sort((a, b) => a[0].localeCompare(b[0])),
      parActivite: grouper((l) => l.activite),
    };
  }, [blessesQ.data, parc]);

  const roles = useMemo(() => [...new Set((data ?? []).map((l) => l.role_code))].sort(), [data]);
  const parcs = useMemo(
    () => [...new Set((data ?? []).flatMap((l) => (l.parcs ?? '').split(', ').filter(Boolean)))].sort(),
    [data]
  );

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (data ?? [])
      .filter((l) => !actifsSeuls || l.actif)
      .filter((l) => role === 'tous' || l.role_code === role)
      .filter((l) => parc === 'tous' || (l.parcs ?? '').split(', ').includes(parc))
      .filter((l) => !q || `${l.prenom} ${l.nom}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (tri === 'nom') return `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr');
        if (tri === 'derniere_connexion') return (b.derniere_connexion ?? '').localeCompare(a.derniere_connexion ?? '');
        return Number(b[tri]) - Number(a[tri]);
      });
  }, [data, actifsSeuls, role, parc, recherche, tri]);

  const totaux = useMemo(
    () =>
      lignes.reduce(
        (t, l) => ({
          ouverts: t.ouverts + Number(l.tickets_ouverts),
          clotures: t.clotures + Number(l.tickets_clotures),
          rep: t.rep + Number(l.minutes_intervention),
          ctl: t.ctl + Number(l.minutes_controles),
          cnx: t.cnx + Number(l.connexions),
        }),
        { ouverts: 0, clotures: 0, rep: 0, ctl: 0, cnx: 0 }
      ),
    [lignes]
  );

  const champ = 'bg-bg-card border border-white/[0.08] rounded-lg px-3 min-h-[40px] text-[13px]';

  return (
    <div className="p-4 md:p-6 md:px-7 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Stats</h1>
        <p className="text-[13px] text-dim mt-0.5">
          Blessés et activité de chaque compte : tickets, réparations, contrôles, bons, blessés et connexions. Visible par toi seul.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {PERIODES.map((p) => (
          <button
            key={p.code}
            onClick={() => setPeriode(p.code)}
            className={cn(
              'px-3.5 rounded-pill text-[13px] min-h-[40px]',
              periode === p.code ? 'bg-gradient-cta text-text font-semibold' : 'bg-bg-card border border-white/[0.08] text-dim'
            )}
          >
            {p.label}
          </button>
        ))}
        <select value={role} onChange={(e) => setRole(e.target.value)} className={champ}>
          <option value="tous">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r as keyof typeof roleLabels] ?? r}
            </option>
          ))}
        </select>
        <select value={parc} onChange={(e) => setParc(e.target.value)} className={champ}>
          <option value="tous">Tous les parcs</option>
          {parcs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom…" className={cn(champ, 'flex-1 min-w-[160px]')} />
        <label className="flex items-center gap-2 text-[12px] text-dim">
          <input type="checkbox" checked={actifsSeuls} onChange={(e) => setActifsSeuls(e.target.checked)} className="accent-nikito-cyan" />
          Comptes actifs
        </label>
      </div>

      {/* Blessés de la période (en haut) */}
      <div className="bg-bg-card rounded-xl border border-red/30 p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div className="text-[13px] font-semibold">🩹 Blessés</div>
          <div className="text-[22px] font-semibold text-red">{blessesQ.isLoading ? '…' : blesses.total}</div>
          <div className="text-[12px] text-dim">
            {blesses.hopital > 0 && <>{blesses.hopital} évacué{blesses.hopital > 1 ? 's' : ''} à l’hôpital · </>}
            {blesses.appeles} client{blesses.appeles > 1 ? 's' : ''} rappelé{blesses.appeles > 1 ? 's' : ''}
            {blesses.aAppeler > 0 && <span className="text-amber"> · {blesses.aAppeler} niveau 3 à rappeler</span>}
          </div>
        </div>
        {blesses.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
            {[
              ['Par parc', blesses.parParc],
              ['Par niveau', blesses.parNiveau],
              ['Par activité', blesses.parActivite],
            ].map(([titre, liste]) => (
              <div key={titre as string}>
                <div className="text-[11px] text-dim uppercase tracking-wider mb-1">{titre as string}</div>
                {(liste as [string, number][]).map(([k, n]) => (
                  <div key={k} className="flex justify-between gap-2 py-0.5 border-b border-white/[0.04]">
                    <span>{k}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {[
          ['Tickets ouverts', String(totaux.ouverts)],
          ['Tickets clôturés', String(totaux.clotures)],
          ['Temps de réparation', duree(totaux.rep)],
          ['Temps de contrôles', duree(totaux.ctl)],
          ['Connexions', String(totaux.cnx)],
        ].map(([l, v]) => (
          <div key={l} className="bg-bg-card rounded-xl p-3 border border-white/[0.06]">
            <div className="text-[11px] text-dim uppercase tracking-wider">{l}</div>
            <div className="text-[20px] font-semibold mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="text-red text-[13px]">Stats indisponibles : {(error as Error).message}</div>
      ) : isLoading ? (
        <div className="text-dim text-[13px] py-8 text-center">Chargement…</div>
      ) : (
        <div className="bg-bg-card rounded-xl border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-[13px] min-w-[940px]">
            <thead>
              <tr className="text-[11px] text-dim uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left px-3 py-2.5 font-normal">
                  <button onClick={() => setTri('nom')} className={cn(tri === 'nom' && 'text-nikito-cyan')}>Personne</button>
                </th>
                {COLONNES.map((c) => (
                  <th key={c.code} className="text-right px-3 py-2.5 font-normal whitespace-nowrap">
                    <button onClick={() => setTri(c.code)} className={cn(tri === c.code && 'text-nikito-cyan')}>
                      {c.label}
                      {tri === c.code ? ' ↓' : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.utilisateur_id} className={cn('border-b border-white/[0.04]', !l.actif && 'opacity-50')}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">
                      {l.prenom} {l.nom}
                    </div>
                    <div className="text-[11px] text-dim">
                      {roleLabels[l.role_code as keyof typeof roleLabels] ?? l.role_code}
                      {l.parcs ? ` · ${l.parcs}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">{l.tickets_ouverts || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{l.tickets_clotures || '—'}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {duree(Number(l.minutes_intervention))}
                    {l.interventions > 0 && <div className="text-[11px] text-dim">{l.interventions} intervention{l.interventions > 1 ? 's' : ''}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {duree(Number(l.minutes_controles))}
                    {l.controles > 0 && <div className="text-[11px] text-dim">{l.controles} contrôle{l.controles > 1 ? 's' : ''}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {duree(Number(l.minutes_bons))}
                    {l.bons > 0 && <div className="text-[11px] text-dim">{l.bons} bon{l.bons > 1 ? 's' : ''}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {l.blesses_declares || '—'}
                    {l.appels_clients > 0 && <div className="text-[11px] text-dim">{l.appels_clients} appel{l.appels_clients > 1 ? 's' : ''} client</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right">{l.connexions || '—'}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-dim">{depuis(l.derniere_connexion)}</td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={COLONNES.length + 1} className="px-3 py-8 text-center text-dim">
                    Aucun compte
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-dim bg-bg-card/90 rounded-lg px-3 py-2 border border-white/[0.06]">
        Connexions : comptées depuis le 26/11/2026 (au plus une toutes les 30 min). Temps de réparation : interventions démarrées et
        clôturées ; temps de contrôles : du démarrage à la validation.
      </p>
    </div>
  );
}
