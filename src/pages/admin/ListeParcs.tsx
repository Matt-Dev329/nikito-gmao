import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useConfig, updateConfig, useInvalidateConfig } from '@/hooks/useConfig';
import { useActiverProductionParc, useDesactiverProductionParc } from '@/hooks/queries/useReferentiel';
import { useAuth } from '@/hooks/useAuth';
import { useFormationFilter } from '@/hooks/useFormation';
import { cn } from '@/lib/utils';

interface ParcProduction {
  id: string;
  code: string;
  nom: string;
  ville: string;
  code_postal: string;
  surface_m2: number | null;
  ouvert_7j7: boolean;
  en_production: boolean;
  date_mise_en_production: string | null;
  mis_en_prod_par: { prenom: string; nom: string } | null;
}

function useParcsAvecProducteur() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['parcs_production', estFormation],
    queryFn: async () => {
      let q = supabase
        .from('parcs')
        .select('id, code, nom, ville, code_postal, surface_m2, ouvert_7j7, en_production, date_mise_en_production, utilisateurs!parcs_mis_en_prod_par_id_fkey(prenom, nom)')
        .eq('actif', true);
      if (!estFormation) {
        q = q.neq('code', 'ECO');
      }
      const { data, error } = await q.order('code');
      if (error) throw error;
      return (data ?? []).map((p) => {
        const u = p.utilisateurs as unknown;
        const mis_en_prod_par = u && typeof u === 'object' && 'prenom' in (u as Record<string, unknown>)
          ? u as { prenom: string; nom: string }
          : null;
        return { ...p, mis_en_prod_par } as ParcProduction;
      });
    },
  });
}

// -- Checklist items for activation confirmation --
const CHECKLIST_ITEMS = [
  'Tous les staff operationnels du parc ont recu leur PIN',
  'Le manager du parc a ete briefee',
  'Les equipements sont a jour dans Alba',
  'Je comprends que les alertes deviendront actives et les controles obligatoires',
] as const;

// -- Activation Modal --
function ModaleActiverProduction({
  parc,
  onClose,
  onConfirm,
  saving,
}: {
  parc: ParcProduction;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const [checks, setChecks] = useState<boolean[]>(CHECKLIST_ITEMS.map(() => false));
  const allChecked = checks.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-sidebar rounded-2xl border border-white/[0.08] w-full max-w-lg p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-1">Activer la production</h2>
        <p className="text-[13px] text-dim mb-5">
          {parc.code} &middot; {parc.nom}
        </p>

        <div className="bg-amber/10 border border-amber/20 rounded-xl p-3.5 mb-5">
          <div className="text-[12px] text-amber font-semibold mb-1">Attention</div>
          <div className="text-[12px] text-dim">
            L'activation rendra les controles obligatoires, les alertes actives et les notifications email operationnelles pour ce parc.
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {CHECKLIST_ITEMS.map((label, i) => (
            <label key={i} className="flex items-start gap-3 cursor-pointer group">
              <div
                className={cn(
                  'w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors',
                  checks[i]
                    ? 'bg-green border-green'
                    : 'border-white/20 group-hover:border-white/40'
                )}
                onClick={(e) => {
                  e.preventDefault();
                  setChecks((prev) => prev.map((v, j) => (j === i ? !v : v)));
                }}
              >
                {checks[i] && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </div>
              <span
                className={cn('text-[13px]', checks[i] ? 'text-text' : 'text-dim')}
                onClick={() => setChecks((prev) => prev.map((v, j) => (j === i ? !v : v)))}
              >
                {label}
              </span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-bg-deep border border-white/[0.08] text-text px-4 py-3 rounded-xl text-[13px] font-medium min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!allChecked || saving}
            className={cn(
              'flex-1 text-white px-4 py-3 rounded-xl text-[13px] font-bold min-h-[44px] transition-all',
              allChecked && !saving
                ? 'opacity-100 active:scale-[0.97]'
                : 'opacity-40 cursor-not-allowed'
            )}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
            }}
          >
            {saving ? 'Activation...' : 'ACTIVER LA PRODUCTION'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Deactivation Modal --
function ModaleDesactiverProduction({
  parc,
  onClose,
  onConfirm,
  saving,
}: {
  parc: ParcProduction;
  onClose: () => void;
  onConfirm: (motif: string) => void;
  saving: boolean;
}) {
  const [motif, setMotif] = useState('');
  const motifValide = motif.trim().length >= 20;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-sidebar rounded-2xl border border-white/[0.08] w-full max-w-lg p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-1">Desactiver la production</h2>
        <p className="text-[13px] text-dim mb-5">
          {parc.code} &middot; {parc.nom}
        </p>

        <div className="bg-red/10 border border-red/20 rounded-xl p-3.5 mb-5">
          <div className="text-[12px] text-red font-semibold mb-1">Attention</div>
          <div className="text-[12px] text-dim">
            Desactiver la production de <strong className="text-text">{parc.nom}</strong> va suspendre toutes les alertes et desactiver l'obligation des controles. A utiliser uniquement en cas de probleme majeur.
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Motif de la desactivation (min. 20 caracteres)
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Expliquez la raison de la desactivation..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text text-[13px] outline-none focus:border-red/50 min-h-[80px] resize-none"
          />
          <div className={cn('text-[11px] mt-1', motifValide ? 'text-dim' : 'text-red/60')}>
            {motif.trim().length}/20 caracteres minimum
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-bg-deep border border-white/[0.08] text-text px-4 py-3 rounded-xl text-[13px] font-medium min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(motif.trim())}
            disabled={!motifValide || saving}
            className={cn(
              'flex-1 bg-red text-white px-4 py-3 rounded-xl text-[13px] font-bold min-h-[44px] transition-all',
              motifValide && !saving
                ? 'opacity-100 active:scale-[0.97]'
                : 'opacity-40 cursor-not-allowed'
            )}
          >
            {saving ? 'Desactivation...' : 'DESACTIVER'}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Production Card for each parc --
function CarteProductionParc({
  parc,
  isDirection,
  onActiver,
  onDesactiver,
}: {
  parc: ParcProduction;
  isDirection: boolean;
  onActiver: () => void;
  onDesactiver: () => void;
}) {
  const enProd = parc.en_production;
  const dateProd = parc.date_mise_en_production
    ? new Date(parc.date_mise_en_production).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const parQui = parc.mis_en_prod_par
    ? `${parc.mis_en_prod_par.prenom} ${parc.mis_en_prod_par.nom}`
    : null;

  return (
    <div className={cn(
      'bg-bg-card rounded-2xl p-4 md:p-5 border-l-[3px]',
      enProd ? 'border-l-green' : 'border-l-amber'
    )}>
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0">
          <div className="text-[11px] text-dim font-mono">{parc.code}</div>
          <div className="text-base font-semibold truncate">{parc.nom}</div>
        </div>
        <span className={cn(
          'px-2.5 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 whitespace-nowrap',
          enProd ? 'bg-green/15 text-green' : 'bg-amber/15 text-amber'
        )}>
          {enProd ? 'EN PRODUCTION' : 'PRE-LANCEMENT'}
        </span>
      </div>

      <div className="text-xs text-dim mb-4">
        {parc.ville} ({parc.code_postal})
        {parc.surface_m2 ? ` · ${parc.surface_m2.toLocaleString('fr-FR')} m\u00B2` : ''}
      </div>

      {enProd && dateProd && (
        <div className="text-[12px] text-dim mb-4">
          En production depuis le <span className="text-text font-medium">{dateProd}</span>
          {parQui && <span> (par {parQui})</span>}
        </div>
      )}

      {!enProd && (
        <div className="text-[12px] text-dim mb-4">
          Ce parc est en attente d'activation. Les controles et alertes ne sont pas actifs.
        </div>
      )}

      {isDirection && (
        <div>
          {enProd ? (
            <button
              onClick={onDesactiver}
              className="bg-transparent border border-red/30 text-red px-4 py-2.5 rounded-xl text-[12px] font-semibold min-h-[44px] hover:bg-red/10 transition-colors"
            >
              Desactiver la production
            </button>
          ) : (
            <button
              onClick={onActiver}
              className="text-white px-4 py-2.5 rounded-xl text-[12px] font-bold min-h-[44px] active:scale-[0.97] transition-transform"
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
              }}
            >
              Activer la production
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -- Config globale section (preserved from before) --
function ConfigLancement() {
  const { config, dateLancement, enProduction, isLoading } = useConfig();
  const invalidateConfig = useInvalidateConfig();
  const [saving, setSaving] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (!initialized && config.date_lancement) {
    setDateValue(config.date_lancement);
    setInitialized(true);
  }

  const handleSaveDate = async () => {
    if (!dateValue) return;
    setSaving(true);
    await updateConfig('date_lancement', dateValue);
    invalidateConfig();
    setSaving(false);
  };

  const handleToggleProduction = async () => {
    setSaving(true);
    await updateConfig('app_en_production', enProduction ? 'false' : 'true');
    invalidateConfig();
    setSaving(false);
  };

  if (isLoading) return null;

  const avantLancement = dateLancement ? new Date() < dateLancement : true;

  return (
    <div className="bg-bg-card rounded-2xl p-4 md:p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-nikito-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 className="text-base font-semibold">Configuration generale</h2>
        <span className={cn(
          'ml-auto px-2.5 py-0.5 rounded-md text-[10px] font-bold',
          avantLancement
            ? 'bg-nikito-cyan/20 text-nikito-cyan'
            : 'bg-green/20 text-green'
        )}>
          {avantLancement ? 'PRE-LANCEMENT' : 'EN PRODUCTION'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Date de lancement
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="flex-1 bg-bg-deep border border-white/[0.08] rounded-lg p-2.5 text-text text-sm outline-none focus:border-nikito-cyan min-h-[44px]"
            />
            <button
              onClick={handleSaveDate}
              disabled={saving || dateValue === config.date_lancement}
              className={cn(
                'bg-nikito-cyan/20 text-nikito-cyan px-4 rounded-lg text-[12px] font-semibold min-h-[44px] transition-colors',
                (saving || dateValue === config.date_lancement) && 'opacity-40 cursor-not-allowed'
              )}
            >
              {saving ? '...' : 'Enregistrer'}
            </button>
          </div>
          {dateLancement && (
            <div className="text-[11px] text-dim mt-1.5">
              {avantLancement
                ? `Lancement dans ${Math.ceil((dateLancement.getTime() - Date.now()) / 86_400_000)} jour(s)`
                : 'Date de lancement passee'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Mode production (global)
          </label>
          <button
            onClick={handleToggleProduction}
            disabled={saving}
            className={cn(
              'flex items-center gap-3 bg-bg-deep border border-white/[0.08] rounded-lg p-3 w-full min-h-[44px] transition-colors',
              saving && 'opacity-50'
            )}
          >
            <div className={cn(
              'w-10 h-5 rounded-full relative transition-colors',
              enProduction ? 'bg-green' : 'bg-white/20'
            )}>
              <div className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                enProduction ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </div>
            <span className="text-[13px]">
              {enProduction ? 'Application en production' : 'Application en pre-lancement'}
            </span>
          </button>
          <div className="text-[11px] text-dim mt-1.5">
            Active les features cross-parcs (IA, exports corporate)
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Toast notification --
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-green/90 text-white rounded-xl px-5 py-3.5 text-[13px] font-medium shadow-2xl flex items-center gap-3 animate-[slideUp_0.3s_ease-out]">
      {message}
      <button onClick={onClose} className="text-white/60 hover:text-white ml-2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
    </div>
  );
}

// -- Main page --
export function ListeParcs() {
  const navigate = useNavigate();
  const { data: parcs, isLoading } = useParcsAvecProducteur();
  const { utilisateur } = useAuth();
  const activerMut = useActiverProductionParc();
  const desactiverMut = useDesactiverProductionParc();

  const isDirection = utilisateur?.role_code === 'direction' || utilisateur?.role_code === 'admin_it' as string;

  const [modaleActiver, setModaleActiver] = useState<ParcProduction | null>(null);
  const [modaleDesactiver, setModaleDesactiver] = useState<ParcProduction | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stats = useMemo(() => {
    if (!parcs) return { total: 0, enProd: 0, preLancement: 0 };
    return {
      total: parcs.length,
      enProd: parcs.filter((p) => p.en_production).length,
      preLancement: parcs.filter((p) => !p.en_production).length,
    };
  }, [parcs]);

  const handleActiver = async () => {
    if (!modaleActiver || !utilisateur) return;
    await activerMut.mutateAsync({ parcId: modaleActiver.id, utilisateurId: utilisateur.id });
    setToast(`${modaleActiver.nom} est officiellement en production !`);
    setModaleActiver(null);
    setTimeout(() => setToast(null), 5000);
  };

  const handleDesactiver = async (motif: string) => {
    if (!modaleDesactiver) return;
    console.log(`[AUDIT] Desactivation production ${modaleDesactiver.code} - Motif: ${motif} - Par: ${utilisateur?.id}`);
    await desactiverMut.mutateAsync({ parcId: modaleDesactiver.id });
    setToast(`${modaleDesactiver.nom} est repasse en pre-lancement.`);
    setModaleDesactiver(null);
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-[22px]">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Parcs Nikito Group</h1>
          <div className="text-[13px] text-dim mt-1">
            {stats.total} parc(s) actif(s) &middot;{' '}
            <span className="text-green">{stats.enProd} en production</span>
            {stats.preLancement > 0 && (
              <span className="text-amber"> &middot; {stats.preLancement} en pre-lancement</span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/gmao/parcs/nouveau')}
          className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[13px] font-bold min-h-[44px] w-full sm:w-auto"
        >
          + Creer un parc
        </button>
      </div>

      {isDirection && <ConfigLancement />}

      {isDirection && (
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Statut production par parc
          </h2>
          {isLoading ? (
            <div className="text-dim text-sm">Chargement...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {parcs?.map((p) => (
                <CarteProductionParc
                  key={p.id}
                  parc={p}
                  isDirection={isDirection}
                  onActiver={() => setModaleActiver(p)}
                  onDesactiver={() => setModaleDesactiver(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isDirection && (
        <>
          {isLoading ? (
            <div className="text-dim">Chargement...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {parcs?.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/gmao/parcs/${p.id}`)}
                  className="bg-bg-card rounded-2xl p-4 md:p-5 cursor-pointer hover:bg-bg-deep transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-dim font-mono">{p.code}</div>
                      <div className="text-base font-semibold truncate">{p.nom}</div>
                    </div>
                    <span className={cn(
                      'px-2.5 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0',
                      p.en_production ? 'bg-green/20 text-green' : 'bg-amber/20 text-amber'
                    )}>
                      {p.en_production ? 'PROD' : 'PRE-LANC.'}
                    </span>
                  </div>
                  <div className="text-xs text-dim space-y-1">
                    <div>{p.ville} ({p.code_postal})</div>
                    <div>{p.surface_m2 ? `${p.surface_m2.toLocaleString('fr-FR')} m\u00B2` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {modaleActiver && (
        <ModaleActiverProduction
          parc={modaleActiver}
          onClose={() => setModaleActiver(null)}
          onConfirm={handleActiver}
          saving={activerMut.isPending}
        />
      )}

      {modaleDesactiver && (
        <ModaleDesactiverProduction
          parc={modaleDesactiver}
          onClose={() => setModaleDesactiver(null)}
          onConfirm={handleDesactiver}
          saving={desactiverMut.isPending}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
