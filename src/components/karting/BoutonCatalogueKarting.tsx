import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicienKartingEffectif } from '@/hooks/useViewAs';

const ROLES_CATALOGUE = ['chef_maintenance', 'direction', 'admin_it'];

/**
 * Raccourci vers le catalogue pièces karting interne (Sodi RSX2 V2 : vues
 * éclatées, références, stock) pour le chef d'équipe, la direction, l'admin
 * IT et le technicien Karting.
 */
export function BoutonCatalogueKarting({ className }: { className?: string }) {
  const { utilisateur } = useAuth();
  const karting = useTechnicienKartingEffectif(utilisateur);
  const visible = karting || ROLES_CATALOGUE.includes(utilisateur?.role_code ?? '');
  if (!visible) return null;
  return (
    <Link
      to="/gmao/catalogue-karting"
      className={cn(
        'flex items-center gap-3 rounded-xl border border-nikito-cyan/40 bg-nikito-cyan/[0.08] px-4 py-3 min-h-[52px] hover:bg-nikito-cyan/15 transition-colors',
        className
      )}
    >
      <span className="text-[22px] leading-none">📘</span>
      <span className="flex flex-col min-w-0">
        <span className="text-[14px] font-semibold text-nikito-cyan">Catalogue pièces karting</span>
        <span className="text-[11px] text-dim">Sodi RSX2 V2 · vues éclatées, références et stock</span>
      </span>
      <span className="ml-auto text-nikito-cyan text-[13px]">›</span>
    </Link>
  );
}
