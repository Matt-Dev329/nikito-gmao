import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Pill } from '@/components/ui/Pill';
import { useToast } from '@/components/ui/ToastProvider';
import {
  STATUTS_COMMANDE,
  useAnnulerCommande,
  useAvancerCommandeDirecte,
  useChangerStatutCommande,
  useMarquerCommandeLivree,
  useModifierCommande,
  useCatalogueCommandes,
  useCommandes,
  type Commande,
  type StatutCommande,
} from '@/hooks/queries/useCommandes';
import { usePanier } from '@/hooks/usePanier';
import { useAuth } from '@/hooks/useAuth';
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

export function ListeCommandes({ portee, onModifier }: { portee: 'miennes' | 'toutes' | 'a_preparer'; onModifier?: () => void }) {
  const { data, isLoading, isError, error } = useCommandes(portee);
  const [filtre, setFiltre] = useState<Filtre>(portee === 'toutes' ? 'demandee' : portee === 'a_preparer' ? 'en_cours' : 'toutes');

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
      : portee === 'a_preparer'
      ? [
          { code: 'en_cours', label: 'À préparer' },
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
            <CarteCommande
              key={c.id}
              commande={c}
              gestion={portee === 'toutes'}
              preparation={portee === 'a_preparer'}
              onModifier={onModifier}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CarteCommande({
  commande: c,
  gestion,
  preparation = false,
  onModifier,
}: {
  commande: Commande;
  gestion: boolean;
  /** Destinataire d'une commande directe (ex. technicien Arcade) : la marque commandée puis livrée */
  preparation?: boolean;
  onModifier?: () => void;
}) {
  const toast = useToast();
  const avancer = useAvancerCommandeDirecte();
  const avancerDirecte = async (statut: 'commandee' | 'livree') => {
    try {
      await avancer.mutateAsync({ id: c.id, statut });
      toast.success(`Commande ${c.numero} : ${statut === 'commandee' ? 'commandée' : 'livrée'} — le parc est prévenu`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const [ouverte, setOuverte] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const changer = useChangerStatutCommande();
  const annuler = useAnnulerCommande();
  const livrer = useMarquerCommandeLivree();
  const ajouterAuPanier = usePanier((s) => s.ajouter);
  const [confirmerModif, setConfirmerModif] = useState(false);
  // Chef d'équipe : peut modifier la commande de n'importe qui avant qu'elle soit passée
  const { utilisateur } = useAuth();
  const [edition, setEdition] = useState(false);
  const chefPeutModifier = utilisateur?.role_code === 'chef_maintenance' && ['demandee', 'validee'].includes(c.statut);
  // Destinataire d'une commande directe (ex. Arcade) : modifiable tant qu'elle n'est pas livrée
  const preparateurPeutModifier = preparation && ['validee', 'commandee'].includes(c.statut);
  const statut = STATUTS_COMMANDE[c.statut];
  const nbArticles = c.commande_lignes.reduce((s, l) => s + l.quantite, 0);

  const appliquer = async (s: StatutCommande, motifRefus?: string) => {
    try {
      await changer.mutateAsync({ id: c.id, statut: s, statutActuel: c.statut, motifRefus });
      setRefus(null);
      toast.success(
        s === 'livree'
          ? `Commande ${c.numero} livrée — produits entrés en stock`
          : s === 'validee' && c.commande_lignes.some((l) => l.specifique)
          ? `Commande ${c.numero} validée — article ajouté au catalogue`
          : `Commande ${c.numero} : ${STATUTS_COMMANDE[s].label.toLowerCase()}`
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirmerLivraison = async () => {
    try {
      await livrer.mutateAsync(c.id);
      toast.success(`Commande ${c.numero} livrée — produits entrés en stock`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Modifier une commande pas encore traitée : elle est annulée et ses articles
  // reviennent dans le panier, où on change les quantités avant de la renvoyer.
  const lignesSpecifiques = c.commande_lignes.filter((l) => l.specifique || !l.produit_id);
  const modifierCommande = async () => {
    try {
      await annuler.mutateAsync(c.id);
      c.commande_lignes.filter((l) => l.produit_id && !l.specifique).forEach((l) => ajouterAuPanier(l.produit_id as string, l.quantite));
      toast.success(
        lignesSpecifiques.length
          ? `Commande ${c.numero} remise dans le panier — ${lignesSpecifiques.length} article(s) spécifique(s) à ressaisir`
          : `Commande ${c.numero} remise dans le panier : modifie-la puis renvoie-la`
      );
      setConfirmerModif(false);
      onModifier?.();
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
          {edition ? (
            <EditeurCommande commande={c} onFini={() => setEdition(false)} limiterAMesActivites={preparation && !chefPeutModifier} />
          ) : (
          <table className="w-full text-[13px] mt-3">
            <tbody>
              {c.commande_lignes.map((l) => (
                <tr key={l.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2">
                    {l.produit_nom}
                    {l.specifique && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-nikito-violet/20 text-nikito-violet align-middle">
                        Spécifique
                      </span>
                    )}
                    <div className="text-[11px] text-faint">{[l.activite_nom, l.reference].filter(Boolean).join(' · ')}</div>
                    {l.lien && (
                      <a
                        href={l.lien}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-nikito-cyan hover:underline break-all"
                      >
                        Voir l'article
                      </a>
                    )}
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
          )}
          {(chefPeutModifier || preparateurPeutModifier) && !edition && (
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setEdition(true)}
                className="bg-nikito-cyan/12 text-nikito-cyan border border-nikito-cyan/40 px-4 py-2 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                {chefPeutModifier ? "✏️ Modifier (chef d'équipe)" : '✏️ Modifier la commande'}
              </button>
            </div>
          )}
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
            {preparation && c.statut === 'validee' && (
              <button
                onClick={() => avancerDirecte('commandee')}
                disabled={avancer.isPending}
                className="bg-nikito-cyan/12 text-nikito-cyan border border-nikito-cyan/40 px-4 py-2 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                📦 Marquer commandée
              </button>
            )}
            {preparation && (c.statut === 'validee' || c.statut === 'commandee') && (
              <button
                onClick={() => avancerDirecte('livree')}
                disabled={avancer.isPending}
                className="bg-green/15 text-green border border-green/40 px-4 py-2 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                ✓ Marquer livrée au parc
              </button>
            )}
            {!gestion && !preparation && (c.statut === 'validee' || c.statut === 'commandee') && (
              <button
                onClick={confirmerLivraison}
                disabled={livrer.isPending}
                className="bg-green/15 text-green border border-green/40 px-4 py-2 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                {livrer.isPending ? '…' : '✓ Marquer comme livrée (reçue)'}
              </button>
            )}
            {!gestion && !preparation && c.statut === 'demandee' && onModifier && !confirmerModif && (
              <button
                onClick={() => setConfirmerModif(true)}
                className="bg-nikito-cyan/12 text-nikito-cyan border border-nikito-cyan/40 px-4 py-2 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
              >
                ✏️ Modifier la commande
              </button>
            )}
            {confirmerModif && (
              <div className="w-full bg-bg-deep rounded-xl p-3 text-[12px] text-dim">
                La commande va être retirée et ses articles remis dans ton panier : tu changes les quantités, ajoutes ou retires
                des articles, puis tu la renvoies.
                {lignesSpecifiques.length > 0 && (
                  <span className="block text-amber mt-1">
                    Articles spécifiques à ressaisir dans « Commande spécifique » :{' '}
                    {lignesSpecifiques.map((l) => `${l.quantite} × ${l.produit_nom}`).join(', ')}
                  </span>
                )}
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => setConfirmerModif(false)} className="text-dim px-3 min-h-[40px]">
                    Retour
                  </button>
                  <button
                    onClick={modifierCommande}
                    disabled={annuler.isPending}
                    className="bg-gradient-cta text-text px-4 rounded-[10px] text-[13px] font-bold min-h-[40px]"
                  >
                    {annuler.isPending ? '…' : 'Modifier dans le panier'}
                  </button>
                </div>
              </div>
            )}
            {!gestion && !preparation && c.statut === 'demandee' && !confirmerModif && (
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

/** Édition d'une commande (chef d'équipe, ou destinataire d'une commande directe) : quantités, retrait et ajout d'articles. */
function EditeurCommande({
  commande: c,
  onFini,
  limiterAMesActivites = false,
}: {
  commande: Commande;
  onFini: () => void;
  /** Destinataire (ex. technicien Arcade) : ajouts limités aux activités dont il reçoit les commandes */
  limiterAMesActivites?: boolean;
}) {
  const toast = useToast();
  const modifier = useModifierCommande();
  const { data: catalogue } = useCatalogueCommandes();
  const { utilisateur } = useAuth();
  const mesActivites = useMemo(
    () =>
      new Set(
        (catalogue?.activites ?? [])
          .filter((a) => !!utilisateur && (a.destinataire_ids ?? []).includes(utilisateur.id))
          .map((a) => a.id)
      ),
    [catalogue, utilisateur]
  );
  const [quantites, setQuantites] = useState<Record<string, number>>(() =>
    Object.fromEntries(c.commande_lignes.map((l) => [l.id, l.quantite]))
  );
  const [ajouts, setAjouts] = useState<Array<{ produitId: string; nom: string; quantite: number }>>([]);
  const [recherche, setRecherche] = useState('');

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2 || !catalogue) return [];
    return catalogue.produits
      .filter((p) => !limiterAMesActivites || mesActivites.has(p.activite_id))
      .filter((p) => p.nom.toLowerCase().includes(q) || (p.reference ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [recherche, catalogue, limiterAMesActivites, mesActivites]);

  const changer = (id: string, delta: number) =>
    setQuantites((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));

  const enregistrer = async () => {
    const lignes = [
      ...c.commande_lignes.map((l) => ({ ligne_id: l.id, quantite: quantites[l.id] ?? 0 })),
      ...ajouts.map((a) => ({ produit_id: a.produitId, quantite: a.quantite })),
    ];
    if (!lignes.some((l) => l.quantite > 0)) {
      toast.error('La commande ne peut pas être vide : annule-la plutôt');
      return;
    }
    try {
      const res = await modifier.mutateAsync({ commandeId: c.id, lignes });
      toast.success(`Commande modifiée : elle devient ${res.numero}`);
      onFini();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const bouton = 'w-11 h-11 rounded-lg bg-bg-deep border border-white/[0.08] text-text text-[16px] flex items-center justify-center';

  return (
    <div className="mt-3 flex flex-col gap-2">
      {c.commande_lignes.map((l) => {
        const q = quantites[l.id] ?? 0;
        return (
          <div key={l.id} className={cn('flex items-center gap-2 bg-bg-deep rounded-lg p-2', q === 0 && 'opacity-50')}>
            <div className="flex-1 min-w-0 text-[13px]">
              <div className={cn('truncate', q === 0 && 'line-through')}>{l.produit_nom}</div>
              <div className="text-[11px] text-faint">{[l.activite_nom, l.reference].filter(Boolean).join(' · ')}</div>
            </div>
            <button onClick={() => changer(l.id, -1)} className={bouton} aria-label="Moins">−</button>
            <span className="w-8 text-center text-[14px] font-semibold">{q}</span>
            <button onClick={() => changer(l.id, 1)} className={bouton} aria-label="Plus">+</button>
            <button
              onClick={() => setQuantites((prev) => ({ ...prev, [l.id]: 0 }))}
              className="w-11 h-11 rounded-lg text-red text-[15px]"
              aria-label="Retirer"
            >
              🗑
            </button>
          </div>
        );
      })}

      {ajouts.map((a, i) => (
        <div key={a.produitId} className="flex items-center gap-2 bg-nikito-cyan/[0.06] rounded-lg p-2">
          <div className="flex-1 min-w-0 text-[13px] truncate">+ {a.nom}</div>
          <button
            onClick={() => setAjouts((prev) => prev.map((x, j) => (j === i ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x)))}
            className={bouton}
            aria-label="Moins"
          >
            −
          </button>
          <span className="w-8 text-center text-[14px] font-semibold">{a.quantite}</span>
          <button
            onClick={() => setAjouts((prev) => prev.map((x, j) => (j === i ? { ...x, quantite: x.quantite + 1 } : x)))}
            className={bouton}
            aria-label="Plus"
          >
            +
          </button>
          <button onClick={() => setAjouts((prev) => prev.filter((_, j) => j !== i))} className="w-11 h-11 rounded-lg text-red text-[15px]" aria-label="Retirer">
            🗑
          </button>
        </div>
      ))}

      <input
        type="text"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Ajouter un article du catalogue (nom ou référence)…"
        className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
      />
      {resultats.length > 0 && (
        <div className="flex flex-col gap-1">
          {resultats.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setAjouts((prev) =>
                  prev.some((x) => x.produitId === p.id) ? prev : [...prev, { produitId: p.id, nom: p.nom, quantite: 1 }]
                );
                setRecherche('');
              }}
              className="text-left text-[13px] bg-bg-card border border-white/[0.06] rounded-lg px-3 py-2 min-h-[44px]"
            >
              {p.nom}
              {p.reference && <span className="text-[11px] text-faint ml-1.5">{p.reference}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="text-[11px] text-dim">
        La commande modifiée remplace l'ancienne (nouveau numéro, même demandeur) ; le demandeur est prévenu.
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onFini} className="text-dim px-3 min-h-[44px] text-[13px]">
          Annuler
        </button>
        <button
          onClick={enregistrer}
          disabled={modifier.isPending}
          className="bg-gradient-cta text-text px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-50"
        >
          {modifier.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </div>
    </div>
  );
}
