import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicienKartingEffectif } from '@/hooks/useViewAs';

/** Catalogue officiel des pièces du kart Sodi RSX2 V2 (vues éclatées, références) */
export const URL_CATALOGUE_SODI_RSX2 = 'https://www.itakashop-pro.com/fr/spareparts/5497-sodi-rsx2-v2#./index.svg';

const ROLES_CATALOGUE = ['chef_maintenance', 'direction', 'admin_it'];

/**
 * Raccourci vers le catalogue pièces Sodi RSX2 V2 (ITAKAshop PRO) pour le chef
 * d'équipe et le technicien Karting. Le site demande la connexion au compte
 * pro : chacun s'y connecte lui-même, ALBA ne stocke aucun identifiant.
 */
export function BoutonCatalogueKarting({ className }: { className?: string }) {
  const { utilisateur } = useAuth();
  const karting = useTechnicienKartingEffectif(utilisateur);
  const visible = karting || ROLES_CATALOGUE.includes(utilisateur?.role_code ?? '');
  if (!visible) return null;
  return (
    <a
      href={URL_CATALOGUE_SODI_RSX2}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-nikito-cyan/40 bg-nikito-cyan/[0.08] px-4 py-3 min-h-[52px] hover:bg-nikito-cyan/15 transition-colors',
        className
      )}
    >
      <span className="text-[22px] leading-none">📘</span>
      <span className="flex flex-col min-w-0">
        <span className="text-[14px] font-semibold text-nikito-cyan">Catalogue pièces Sodi RSX2 V2</span>
        <span className="text-[11px] text-dim">Vues éclatées et références · ITAKAshop PRO (connexion avec le compte pro)</span>
      </span>
      <span className="ml-auto text-nikito-cyan text-[13px]">↗</span>
    </a>
  );
}
