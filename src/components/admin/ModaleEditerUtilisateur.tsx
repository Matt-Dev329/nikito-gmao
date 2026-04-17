import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useParcs } from '@/hooks/queries/useReferentiel';
import {
  useRoles,
  useModifierUtilisateur,
  type UtilisateurRow,
} from '@/hooks/queries/useUtilisateurs';
import { roleLabels } from '@/lib/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  utilisateur: UtilisateurRow;
}

export function ModaleEditerUtilisateur({ open, onClose, utilisateur }: Props) {
  const { data: parcs } = useParcs();
  const { data: roles } = useRoles();
  const modifierMutation = useModifierUtilisateur();

  const [roleId, setRoleId] = useState(utilisateur.role_id);
  const [parcsChoisis, setParcsChoisis] = useState<string[]>(
    utilisateur.parcs.map((p) => p.parc_id)
  );
  const [estManager, setEstManager] = useState(
    utilisateur.parcs.some((p) => p.est_manager)
  );
  const [actif, setActif] = useState(utilisateur.actif);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setRoleId(utilisateur.role_id);
    setParcsChoisis(utilisateur.parcs.map((p) => p.parc_id));
    setEstManager(utilisateur.parcs.some((p) => p.est_manager));
    setActif(utilisateur.actif);
    setErreur(null);
  }, [utilisateur]);

  if (!open) return null;

  const roleCode = roles?.find((r) => r.id === roleId)?.code;
  const peutValider = roleId && parcsChoisis.length > 0;

  const enregistrer = async () => {
    if (!peutValider) return;
    setErreur(null);
    try {
      await modifierMutation.mutateAsync({
        utilisateur_id: utilisateur.id,
        role_id: roleId,
        parc_ids: parcsChoisis,
        est_manager: estManager,
        actif,
      });
      onClose();
    } catch (e) {
      setErreur((e as Error).message ?? 'Erreur inconnue');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[580px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-[22px]">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              Modifier
            </div>
            <div className="text-[19px] font-semibold mt-0.5">
              {utilisateur.prenom} {utilisateur.nom}
            </div>
            <div className="text-xs text-dim mt-1">
              {utilisateur.email || 'Connexion PIN'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            x
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Role
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {(roles ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleId(r.id)}
                className={cn(
                  'py-2.5 px-2 rounded-lg text-[11px] transition-colors',
                  roleId === r.id
                    ? 'bg-gradient-action border-none text-text font-bold'
                    : 'bg-bg-deep border border-white/[0.08] text-dim hover:border-white/20'
                )}
              >
                {roleLabels[r.code] ?? r.nom}
              </button>
            ))}
          </div>
          {(roleCode === 'manager_parc' || roleCode === 'chef_maintenance') && (
            <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={estManager}
                onChange={(e) => setEstManager(e.target.checked)}
                className="accent-nikito-pink"
              />
              Manager principal de ses parcs
            </label>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Parcs assignes
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {(parcs ?? []).map((p) => {
              const checked = parcsChoisis.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setParcsChoisis(
                      checked
                        ? parcsChoisis.filter((id) => id !== p.id)
                        : [...parcsChoisis, p.id]
                    )
                  }
                  className={cn(
                    'py-2.5 px-2 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-colors',
                    checked
                      ? 'bg-nikito-pink/15 border border-nikito-pink text-text'
                      : 'bg-bg-deep border border-white/[0.08] text-dim hover:border-white/20'
                  )}
                >
                  <span
                    className={cn(
                      'w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[10px] font-bold',
                      checked ? 'bg-nikito-pink text-bg-app' : 'border border-white/15'
                    )}
                  >
                    {checked && '\u2713'}
                  </span>
                  {p.code}
                </button>
              );
            })}
          </div>
          {roleCode === 'direction' && (
            <button
              onClick={() => setParcsChoisis((parcs ?? []).map((p) => p.id))}
              className="text-[10px] text-nikito-cyan mt-2 hover:underline"
            >
              Selectionner tous les parcs
            </button>
          )}
        </div>

        <div className="mb-5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Statut du compte
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setActif(true)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-colors',
                actif
                  ? 'bg-green/15 border border-green text-green'
                  : 'bg-bg-deep border border-white/[0.08] text-dim hover:border-white/20'
              )}
            >
              Actif
            </button>
            <button
              onClick={() => setActif(false)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-colors',
                !actif
                  ? 'bg-red/15 border border-red text-red'
                  : 'bg-bg-deep border border-white/[0.08] text-dim hover:border-white/20'
              )}
            >
              Desactive
            </button>
          </div>
        </div>

        {erreur && (
          <div className="bg-red/10 border border-red/30 text-red text-xs p-3 rounded-lg mb-3">
            {erreur}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={enregistrer}
            disabled={!peutValider || modifierMutation.isPending}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!peutValider || modifierMutation.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {modifierMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
