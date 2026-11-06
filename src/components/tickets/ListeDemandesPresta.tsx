import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { DemandeEnCours } from '@/hooks/queries/useDemandesEnCours';

const STATUTS: Record<DemandeEnCours['statut'], { label: string; classe: string }> = {
  a_envoyer: { label: 'À envoyer', classe: 'bg-amber/15 text-amber' },
  envoyee: { label: 'Envoyée', classe: 'bg-nikito-cyan/15 text-nikito-cyan' },
  planifiee: { label: 'Planifiée', classe: 'bg-nikito-cyan/15 text-nikito-cyan' },
};
const dateFr = (d: string) => new Date(d).toLocaleDateString('fr-FR');

/** Onglet « Demandes presta » d'Opérations : demandes en cours, ouvertes dans leur page pour les traiter */
export function ListeDemandesPresta({ demandes }: { demandes: DemandeEnCours[] }) {
  const navigate = useNavigate();
  if (demandes.length === 0) {
    return <div className="text-center py-12 text-dim text-sm">Aucune demande spécifique ou prestataire en cours</div>;
  }
  return (
    <>
      {demandes.map((d) => (
        <button
          key={d.id}
          onClick={() => navigate('/gmao/demandes-prestataires')}
          className={cn(
            'w-full text-left bg-bg-card rounded-xl border p-3.5 flex items-center gap-3 hover:border-nikito-cyan/40 transition-colors',
            d.urgente ? 'border-red/40' : 'border-white/[0.06]'
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-dim font-medium">
                {d.type === 'specifique' ? 'Demande spécifique' : 'Demande d’intervention'}
              </span>
              <span className={cn('text-[11px] px-2 py-0.5 rounded-md font-medium', STATUTS[d.statut].classe)}>{STATUTS[d.statut].label}</span>
              {d.urgente && <span className="text-[11px] px-2 py-0.5 rounded-md bg-red/15 text-red font-semibold">Urgent</span>}
            </div>
            <div className="text-[14px] font-semibold mt-1 truncate">{d.objet}</div>
            {d.description && <div className="text-[12px] text-dim truncate">{d.description}</div>}
            <div className="text-[11px] text-faint mt-0.5">
              {[
                d.parc?.code,
                d.prestataire,
                d.domaine,
                d.auteur ? `par ${d.auteur.prenom} ${d.auteur.nom}` : null,
                `le ${dateFr(d.cree_le)}`,
                d.date_prevue ? `prévue le ${dateFr(d.date_prevue)}` : d.date_souhaitee ? `souhaitée le ${dateFr(d.date_souhaitee)}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <span className="text-faint text-[18px]" aria-hidden>
            ›
          </span>
        </button>
      ))}
    </>
  );
}
