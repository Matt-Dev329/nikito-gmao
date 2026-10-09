import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePanier, nombreArticles } from '@/hooks/usePanier';
import { useAccesCommandes, useCommandes } from '@/hooks/queries/useCommandes';
import { OngletCatalogue } from './OngletCatalogue';
import { OngletPanier } from './OngletPanier';
import { ListeCommandes } from './ListeCommandes';
import { GestionCatalogue } from './GestionCatalogue';

type Onglet = 'catalogue' | 'panier' | 'mes_commandes' | 'a_traiter' | 'gestion';

export function PageCommander() {
  const { utilisateur } = useAuth();
  const { peutCommander, estGestionnaire, isLoading } = useAccesCommandes();
  const lignes = usePanier((s) => s.lignes);
  const rattacher = usePanier((s) => s.rattacher);
  const [onglet, setOnglet] = useState<Onglet>('catalogue');
  const toutes = useCommandes('toutes');

  useEffect(() => {
    if (utilisateur) rattacher(utilisateur.id);
  }, [utilisateur, rattacher]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 md:px-7 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-xl h-16 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!peutCommander) return <Navigate to="/gmao" replace />;

  const nbPanier = nombreArticles(lignes);
  const nbATraiter = estGestionnaire
    ? (toutes.data ?? []).filter((c) => c.statut === 'demandee').length
    : 0;

  const onglets: { code: Onglet; label: string; badge?: number; gestion?: boolean }[] = [
    { code: 'catalogue', label: 'Catalogue' },
    { code: 'panier', label: 'Panier', badge: nbPanier },
    { code: 'mes_commandes', label: 'Mes commandes' },
    { code: 'a_traiter', label: 'Commandes reçues', badge: nbATraiter, gestion: true },
    { code: 'gestion', label: 'Gérer le catalogue', gestion: true },
  ];

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="mb-5">
        <h1 className="text-xl md:text-[22px] font-semibold m-0">Commander</h1>
        <p className="text-[13px] text-dim mt-1">
          Choisis tes produits par activité, ajoute-les au panier puis envoie ta demande de commande.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {onglets
          .filter((o) => !o.gestion || estGestionnaire)
          .map((o) => (
            <button
              key={o.code}
              onClick={() => setOnglet(o.code)}
              className={cn(
                'px-4 py-2.5 rounded-pill text-[13px] whitespace-nowrap min-h-[44px]',
                onglet === o.code
                  ? 'bg-gradient-cta text-text font-semibold'
                  : 'bg-bg-card border border-white/[0.08] text-dim'
              )}
            >
              {o.label}
              {!!o.badge && (
                <span
                  className={cn(
                    'ml-1.5 px-2 py-0.5 rounded-lg text-[11px]',
                    onglet === o.code ? 'bg-white/25' : 'bg-amber text-bg-app font-semibold'
                  )}
                >
                  {o.badge}
                </span>
              )}
            </button>
          ))}
      </div>

      {onglet === 'catalogue' && <OngletCatalogue onVoirPanier={() => setOnglet('panier')} />}
      {onglet === 'panier' && (
        <OngletPanier
          onRetourCatalogue={() => setOnglet('catalogue')}
          onEnvoyee={() => setOnglet('mes_commandes')}
        />
      )}
      {onglet === 'mes_commandes' && <ListeCommandes portee="miennes" />}
      {onglet === 'a_traiter' && estGestionnaire && <ListeCommandes portee="toutes" />}
      {onglet === 'gestion' && estGestionnaire && <GestionCatalogue />}
    </div>
  );
}
