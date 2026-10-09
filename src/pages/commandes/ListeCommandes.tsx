import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/ToastProvider';
import {
  STATUTS_COMMANDE,
  useAnnulerCommande,
  useChangerStatutCommande,
  useCommandes,
  type Commande,
  type StatutCommande,
} from '@/hooks/queries/useCommandes';
import { formatDateHeure, formatPrix } from './format';

const TONES: Record<string, string> = {
  cyan: 'bg-nikito-cyan/12 text-nikito-cyan',
  amber: 'bg-amber/15 text-amber',
  green: 'bg-green/15 text-green',
  red: 'bg-red/15 text-red',
  dim: 'bg-white/[0.06] text-dim',
};

// Étapes proposées au gestionnaire selon le statut courant
const SUITES: Partial<Record<StatutCommande, StatutCommande[]>> = {
  demandee: ['validee', 'refusee'],
  validee: ['commandee', 'refusee'],
  commandee: ['livree'],
};

const LIBELLES_ACTION: Partial<Record<StatutCommande, string>> = {
  validee: 'Valider',
  commandee: 'Marquer commandée',
  livree: 'Marquer livrée · entrer en stock',
  refusee: 'Refuser',
};

type Filtre = 'en_cours' | 'toutes' | StatutCommande;

export function ListeCommandes({ portee }: { portee: 'miennes' | 'toutes' }) {
  const { data, isLoading, isError, error } = useCommandes(portee);
  const [filtre, setFiltre] = useState<Filtre>(portee === 'toutes' ? 'demandee' : 'toutes');

  const commandes = useMemo(() => {
    const all = data ?? [];
    if (filtre === 'toutes') return all;
    if (filtre === 'en_cours') return all.filter((c) => ['demandee', 'validee', 'commandee'].includes(c.statut));
    return all.filter((c) => c.statut === filtre);
  }, [data, filtre]);

  const filtres: { code: Filtre; label: string }[] =
    portee === 'toutes'
      ? [
          { code: 'demandee', label: 'À traiter' },
          { code: 'en_cours', label: 'En cours' },
          { code: 'livree', label: 'Livrées' },
          { code: 'toutes', label: 'Toutes' },
        ]
      : [
          { code: 'toutes', label: 'Toutes' },
          { code: 'en_cours', label: 'En cours' },
          { code: 'livree', label: 'Livrées' },
        ];

  return (
    <div>
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {filtres.map((f) => (
          <Pill key={f.code} variant="cyan" active={filtre === f.code} onClick={() => setFiltre(f.code)}>
            {f.label}
          </Pill>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-red text-[13px] bg-red/10 rounded-lg p-3">Erreur : {(error as Error).message}</div>
      ) : commandes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune commande.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {commandes.map((c) => (
            <CarteCommande key={c.id} commande={c} gestion={portee === 'toutes'} />
          ))}
        </div>
      )}
    </div>
  );
}

function CarteCommande({ commande: c, gestion }: { commande: Commande; gestion: boolean }) {
  const toast = useToast();
  const [ouverte, setOuverte] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const changer = useChangerStatutCommande();
  const annuler = useAnnulerCommande();
  const statut = STATUTS_COMMANDE[c.statut];
  const nbArticles = c.commande_lignes.reduce((s, l) => s + l.quantite, 0);

  const appliquer = async (s: StatutCommande, motifRefus?: string) => {
    try {
      await changer.mutateAsync({ id: c.id, statut: s, motifRefus });
      setRefus(null);
      toast.success(
        s === 'livree'
          ? `Commande ${c.numero} livrée — produits entrés en stock`
          : `Commande ${c.numero} : ${STATUTS_COMMANDE[s].label.toLowerCase()}`
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const annulerCommande = async () => {
    try {
      await annuler.mutateAsync(c.id);
      toast.info(`Commande ${c.numero} annulée`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl border border-white/[0.06]">
      <button onClick={() => setOuverte((o) => !o)} className="w-full text-left p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-nikito-cyan text-[13px]">{c.numero}</span>
            <span className={cn('text-[11px] px-2 py-0.5 rounded-md font-medium', TONES[statut.tone])}>{statut.label}</span>
          </div>
          <div className="text-[12px] text-dim mt-1">
            {[
              c.parc ? `${c.parc.code} · ${c.parc.nom}` : null,
              gestion && c.demandeur ? `${c.demandeur.prenom} ${c.demandeur.nom}` : null,
              formatDateHeure(c.cree_le),
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-semibold">{formatPrix(c.total_estime)}</div>
          <div className="text-[11px] text-faint">
            {nbArticles} article{nbArticles > 1 ? 's' : ''}
          </div>
        </div>
      </button>

      {ouverte && (
        <div className="px-4 pb-4 border-t border-white/[0.04]">
          <table className="w-full text-[13px] mt-3">
            <tbody>
              {c.commande_lignes.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2">
                    {l.produit_nom}
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
          {c.statut === 'refusee' && c.motif_refus && (
            <p className="text-[12px] text-red mt-3">Motif du refus : {c.motif_refus}</p>
          )}

          <div className="flex flex-wrap gap-2 mt-4 justify-end">
            {!gestion && c.statut === 'demandee' && (
              <button
                onClick={annulerCommande}
                disabled={annuler.isPending}
                className="border border-white/15 text-dim px-4 py-2 rounded-[10px] text-[12px] min-h-[40px]"
              >
                Annuler ma commande
              </button>
            )}
            {gestion &&
              refus === null &&
              (SUITES[c.statut] ?? []).map((s) => (
                <button
                  key={s}
                  onClick={() => (s === 'refusee' ? setRefus('') : appliquer(s))}
                  disabled={changer.isPending}
                  className={cn(
                    'px-4 py-2 rounded-[10px] text-[12px] font-semibold min-h-[40px] border',
                    s === 'refusee'
                      ? 'bg-red/10 text-red border-red/30'
                      : 'bg-nikito-cyan/12 text-nikito-cyan border-nikito-cyan/40'
                  )}
                >
                  {LIBELLES_ACTION[s]}
                </button>
              ))}
          </div>

          {gestion && refus !== null && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={refus}
                onChange={(e) => setRefus(e.target.value)}
                placeholder="Motif du refus (facultatif)"
                className="flex-1 bg-bg-deep border border-white/[0.08] rounded-[10px] p-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[40px]"
              />
              <button onClick={() => setRefus(null)} className="text-dim text-[12px] px-3 min-h-[40px]">
                Annuler
              </button>
              <button
                onClick={() => appliquer('refusee', refus.trim())}
                disabled={changer.isPending}
                className="bg-red/15 text-red border border-red/30 px-4 py-2 rounded-[10px] text-[12px] font-semibold min-h-[40px]"
              >
                Confirmer le refus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
