import { useEffect, useCallback } from 'react';
import { useMaintenanceData } from '@/hooks/queries/useMaintenanceData';
import { useAnalyseIA } from '@/hooks/queries/useAnalyseIA';
import { ScoreSanteGlobal } from '@/components/ia-predictive/ScoreSanteGlobal';
import { EquipementsRisque } from '@/components/ia-predictive/EquipementsRisque';
import { AlertesIA } from '@/components/ia-predictive/AlertesIA';
import { RecommandationsIA } from '@/components/ia-predictive/RecommandationsIA';
import { KpiPredictionsCards } from '@/components/ia-predictive/KpiPredictionsCards';
import { supabase } from '@/lib/supabase';
import type { EquipementRisque, RecommandationIA } from '@/types/ia-predictive';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className ?? ''}`} />
  );
}

function AnalyseLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-nikito-cyan/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-nikito-cyan animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          {'\uD83E\uDDE0'}
        </div>
      </div>
      <div className="text-[13px] text-dim">Analyse en cours...</div>
      <div className="text-[11px] text-faint">L'IA analyse vos donnees de maintenance (5-10 secondes)</div>
    </div>
  );
}

function EtatVide() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <span className="text-4xl">{'\uD83E\uDDE0'}</span>
      <div className="text-[13px] text-dim text-center max-w-md">
        Pas assez de donnees pour une analyse predictive.
        Commencez par enregistrer des controles et des incidents.
      </div>
    </div>
  );
}

function EtatErreur({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <span className="text-4xl">{'\u26A0\uFE0F'}</span>
      <div className="text-[13px] text-dim text-center max-w-md">{message}</div>
      <button
        onClick={onRetry}
        className="bg-nikito-cyan/10 border border-nikito-cyan/30 text-nikito-cyan px-4 py-2.5 rounded-lg text-[12px] font-medium min-h-[44px] hover:bg-nikito-cyan/20 transition-colors"
      >
        Reessayer
      </button>
    </div>
  );
}

export function PageIAPredictive() {
  const { data: maintenanceData, isLoading: dataLoading } = useMaintenanceData();
  const { analyse, loading: iaLoading, error, lastAnalyse, lancer } = useAnalyseIA();

  useEffect(() => {
    if (maintenanceData && !analyse && !iaLoading && !error) {
      lancer(maintenanceData);
    }
  }, [maintenanceData, analyse, iaLoading, error, lancer]);

  const handleRelancer = useCallback(() => {
    if (maintenanceData) {
      lancer(maintenanceData, true);
    }
  }, [maintenanceData, lancer]);

  const handleCreerPreventif = useCallback(async (eq: EquipementRisque) => {
    const { error: err } = await supabase.from('maintenances_preventives').insert({
      equipement_id: eq.equipement_id,
      type: 'preventif_previsionnel',
      libelle: `[IA] ${eq.action_recommandee}`.slice(0, 200),
      description: `Prediction IA : ${eq.prediction}\n\nJustification : ${eq.justification}`,
      prochaine_echeance: eq.date_panne_estimee || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    });
    if (!err) {
      alert('Maintenance preventive creee avec succes.');
    }
  }, []);

  const handleAppliquerReco = useCallback(async (rec: RecommandationIA) => {
    alert(`Recommandation notee : ${rec.titre}\n\nCreez manuellement la tache dans Preventif.`);
  }, []);

  const isLoading = dataLoading || iaLoading;
  const noData = maintenanceData && maintenanceData.equipements.length === 0;

  return (
    <div className="p-4 md:p-6 md:px-7 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{'\uD83E\uDDE0'}</span>
            <h1 className="text-xl md:text-2xl lg:text-[22px] font-semibold m-0">
              IA Predictive
            </h1>
          </div>
          <div className="text-[11px] text-dim">
            Analyse automatique des donnees de maintenance par intelligence artificielle
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastAnalyse && (
            <div className="text-[11px] text-faint">
              Derniere analyse : {lastAnalyse.toLocaleString('fr-FR')}
            </div>
          )}
          <button
            onClick={handleRelancer}
            disabled={isLoading}
            className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[12px] font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all flex items-center gap-2"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
            Relancer l'analyse
          </button>
        </div>
      </div>

      {isLoading && !analyse && <AnalyseLoader />}
      {!isLoading && noData && <EtatVide />}
      {!isLoading && error && !analyse && <EtatErreur message={error} onRetry={handleRelancer} />}

      {analyse && (
        <div className="flex flex-col gap-5">
          <ScoreSanteGlobal
            score={analyse.score_sante_global}
            tendance={analyse.tendance}
          />

          <KpiPredictionsCards predictions={analyse.kpi_predictions} />

          <EquipementsRisque
            equipements={analyse.equipements_a_risque}
            onCreerPreventif={handleCreerPreventif}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AlertesIA alertes={analyse.alertes} />
            <RecommandationsIA
              recommandations={analyse.recommandations}
              onAppliquer={handleAppliquerReco}
            />
          </div>

          {iaLoading && (
            <div className="text-center text-[11px] text-dim py-2">
              Actualisation en cours...
            </div>
          )}
        </div>
      )}

      {dataLoading && !maintenanceData && (
        <div className="space-y-4">
          <SkeletonBlock className="h-[160px] w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SkeletonBlock className="h-[80px]" />
            <SkeletonBlock className="h-[80px]" />
            <SkeletonBlock className="h-[80px]" />
            <SkeletonBlock className="h-[80px]" />
          </div>
          <SkeletonBlock className="h-[200px] w-full" />
        </div>
      )}
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 0 1 10.3-4.2M14 8a6 6 0 0 1-10.3 4.2" />
      <path d="M12 1v4h-4M4 15v-4h4" />
    </svg>
  );
}
