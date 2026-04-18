import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useConfig, updateConfig, useInvalidateConfig } from '@/hooks/useConfig';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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
            Mode production
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
            Active les alertes et notifications operationnelles
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListeParcs() {
  const navigate = useNavigate();
  const { data: parcs, isLoading } = useParcs();
  const { utilisateur } = useAuth();

  const isDirection = utilisateur?.role_code === 'direction';

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-[22px]">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Parcs Nikito Group</h1>
          <div className="text-[13px] text-dim mt-1">
            {parcs?.length ?? 0} parc(s) actif(s) · gestion centralisee
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
                {p.ouvert_7j7 && (
                  <span className="bg-amber/20 text-amber px-2.5 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0">
                    7J/7
                  </span>
                )}
              </div>
              <div className="text-xs text-dim space-y-1">
                <div>{p.ville} ({p.code_postal})</div>
                <div>{p.surface_m2 ? `${p.surface_m2.toLocaleString('fr-FR')} m²` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
