import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/ui/Logo';
import { PhotosTicket } from '@/components/tickets/PhotosTicket';

/** Ticket arcade tel que renvoyé par la RPC tickets_arcade_consultation */
interface TicketArcade {
  id: string;
  numero_bt: string;
  titre: string | null;
  description: string | null;
  symptome: string | null;
  statut: string;
  declare_le: string;
  resolu_le: string | null;
  parc_code: string;
  parc_nom: string;
  equipement_code: string | null;
  equipement_libelle: string | null;
  numero_reader: string | null;
  priorite: string | null;
  photos_urls: string[];
}

const STATUTS: Record<string, { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-red/15 text-red' },
  en_cours: { label: 'En cours', cls: 'bg-amber/15 text-amber' },
  resolu: { label: 'Résolu', cls: 'bg-green/15 text-green' },
  annule: { label: 'Annulé', cls: 'bg-bg-deep text-dim' },
  ferme: { label: 'Fermé', cls: 'bg-green/15 text-green' },
};
const statut = (s: string) => STATUTS[s] ?? { label: s.replace(/_/g, ' '), cls: 'bg-amber/15 text-amber' };
const estTermine = (s: string) => ['resolu', 'annule', 'ferme'].includes(s);

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * « Technicien Arcade (consultation) » : consultation seule des tickets arcade de ses parcs
 * (le problème et les photos). Aucune action possible : la base refuse toute
 * écriture à ce compte (garde bloquer_ancienne_adresse + stockage).
 */
export function PageConsultationArcade() {
  const { authUser, utilisateur, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [voirTermines, setVoirTermines] = useState(false);

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['tickets-arcade-consultation'],
    enabled: !!authUser,
    queryFn: async () => {
      const { data, error: err } = await supabase.rpc('tickets_arcade_consultation');
      if (err) throw err;
      return (data ?? []) as TicketArcade[];
    },
    refetchInterval: 60_000,
  });

  const enCours = useMemo(() => (tickets ?? []).filter((t) => !estTermine(t.statut)), [tickets]);
  const termines = useMemo(() => (tickets ?? []).filter((t) => estTermine(t.statut)), [tickets]);
  const liste = voirTermines ? termines : enCours;

  if (loading) {
    return <div className="min-h-screen bg-bg-app flex items-center justify-center text-dim text-sm">Chargement…</div>;
  }
  if (!authUser) return <Navigate to="/" replace />;

  const deconnexion = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg-app text-text">
      <header className="sticky top-0 z-10 bg-bg-sidebar border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <Logo size="sm" subtitle="Arcade" />
        <div className="ml-auto text-right min-w-0">
          <div className="text-[13px] font-medium truncate">
            {utilisateur?.prenom} {utilisateur?.nom}
          </div>
          <div className="text-[11px] text-dim">Consultation seule</div>
        </div>
        <button onClick={deconnexion} className="px-3 min-h-[40px] rounded-[10px] text-[12px] text-dim border border-white/[0.08]">
          Déconnexion
        </button>
      </header>

      <main className="p-4 md:p-6 max-w-[860px] mx-auto flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Tickets Arcade</h1>
          <p className="text-[13px] text-dim mt-1">Les pannes signalées sur les bornes arcade de ton parc.</p>
        </div>

        <div className="flex gap-2">
          {[
            { v: false, label: `En cours (${enCours.length})` },
            { v: true, label: `Résolus depuis 30 jours (${termines.length})` },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => {
                setVoirTermines(o.v);
                setOuvert(null);
              }}
              className={cn(
                'px-3 min-h-[40px] rounded-full text-[13px] border',
                voirTermines === o.v ? 'bg-nikito-cyan/15 border-nikito-cyan text-nikito-cyan font-semibold' : 'bg-bg-deep border-white/[0.08] text-dim'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {isLoading && <div className="text-dim text-sm">Chargement des tickets…</div>}
        {error && <div className="text-red text-sm">Impossible de charger les tickets : {(error as Error).message}</div>}
        {!isLoading && !error && liste.length === 0 && (
          <div className="bg-bg-card rounded-xl p-5 text-dim text-sm text-center">
            {voirTermines ? 'Aucun ticket arcade résolu ces 30 derniers jours.' : 'Aucune panne arcade en cours 👍'}
          </div>
        )}

        {liste.map((t) => {
          const s = statut(t.statut);
          const estOuvert = ouvert === t.id;
          return (
            <div key={t.id} className="bg-bg-card rounded-xl border border-white/[0.06]">
              <button onClick={() => setOuvert(estOuvert ? null : t.id)} className="w-full text-left px-4 py-3 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md', s.cls)}>{s.label}</span>
                  <strong>{t.numero_bt}</strong>
                  <span className="text-nikito-cyan font-semibold">{t.parc_code}</span>
                  {t.photos_urls.length > 0 && <span className="text-dim text-[12px]">📷 {t.photos_urls.length}</span>}
                  <span className="text-dim text-[12px] ml-auto">{dateHeure(t.declare_le)}</span>
                </div>
                <div className="text-[14px] font-medium">
                  {[t.equipement_code, t.equipement_libelle].filter(Boolean).join(' · ') || 'Borne arcade'}
                </div>
                <div className="text-[13px] text-dim line-clamp-2">{t.titre}</div>
              </button>
              {estOuvert && (
                <div className="px-4 pb-4 pt-3 border-t border-white/[0.06] flex flex-col gap-3 text-[13px]">
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <Info k="Parc" v={t.parc_nom} />
                    <Info k="N° reader" v={t.numero_reader} />
                    <Info k="Priorité" v={t.priorite} />
                    <Info k="Signalé le" v={dateHeure(t.declare_le)} />
                    {t.resolu_le && <Info k="Résolu le" v={dateHeure(t.resolu_le)} />}
                  </div>
                  <div>
                    <div className="text-dim text-[12px]">Problème</div>
                    <div className="whitespace-pre-wrap">{t.titre || '—'}</div>
                    {t.symptome && <div className="whitespace-pre-wrap mt-1">{t.symptome}</div>}
                    {t.description && <div className="whitespace-pre-wrap mt-1 text-dim">{t.description}</div>}
                  </div>
                  <PhotosTicket incidentId={t.id} chemins={t.photos_urls} dossier={`${t.parc_code}/${t.numero_bt}`} modifiable={false} />
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <span className="text-dim text-[12px]">{k} : </span>
      {v || '—'}
    </div>
  );
}
