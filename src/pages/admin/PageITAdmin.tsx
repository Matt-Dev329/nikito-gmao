import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useConfig } from '@/hooks/useConfig';

interface SystemCheck {
  label: string;
  status: 'ok' | 'warning' | 'error' | 'loading';
  detail: string;
}

interface EdgeFnStatus {
  name: string;
  status: 'ok' | 'error' | 'loading';
  latencyMs: number | null;
  detail: string;
}

interface TableStats {
  name: string;
  count: number;
  hasRls: boolean;
}

interface RecentError {
  source: string;
  message: string;
  time: string;
}

const EDGE_FUNCTIONS = [
  'analyse-ia-predictive',
  'check-controles-manquants',
  'send-code-2fa',
  'send-invitation-email',
  'send-rapport-controles',
  'send-rapport-ia',
  'send-recap-manager',
  'send-support-email',
  'notify-arcade-incident',
  'generer-rapport-ia-hebdo',
  'sync-roller-gxs',
];

const CORE_TABLES = [
  'parcs',
  'equipements',
  'utilisateurs',
  'incidents',
  'interventions',
  'controles',
  'controle_items',
  'categories_equipement',
  'points_controle',
  'niveaux_priorite',
  'fournisseurs',
  'config_globale',
  'pieces_detachees',
  'maintenances_preventives',
  'plaintes',
];

export function PageITAdmin() {
  const { utilisateur } = useAuth();
  const { config } = useConfig();
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [edgeFns, setEdgeFns] = useState<EdgeFnStatus[]>([]);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);
  const [activeTab, setActiveTab] = useState<'sante' | 'edge' | 'tables' | 'config' | 'logs'>('sante');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runHealthChecks = useCallback(async () => {
    setRunning(true);
    const results: SystemCheck[] = [];

    // DB connection
    try {
      const start = Date.now();
      const { error } = await supabase.from('config_globale').select('cle').limit(1);
      const latency = Date.now() - start;
      results.push({
        label: 'Connexion base de donnees',
        status: error ? 'error' : latency > 2000 ? 'warning' : 'ok',
        detail: error ? error.message : `Latence : ${latency}ms`,
      });
    } catch (e) {
      results.push({
        label: 'Connexion base de donnees',
        status: 'error',
        detail: String(e),
      });
    }

    // Auth service
    try {
      const { data } = await supabase.auth.getSession();
      results.push({
        label: 'Service authentification',
        status: data.session ? 'ok' : 'warning',
        detail: data.session ? `Session active — expire ${new Date(data.session.expires_at! * 1000).toLocaleString('fr-FR')}` : 'Pas de session active',
      });
    } catch (e) {
      results.push({
        label: 'Service authentification',
        status: 'error',
        detail: String(e),
      });
    }

    // Storage
    try {
      const { data, error } = await supabase.storage.listBuckets();
      results.push({
        label: 'Service stockage (buckets)',
        status: error ? 'error' : 'ok',
        detail: error ? error.message : `${data?.length ?? 0} bucket(s) configures`,
      });
    } catch (e) {
      results.push({
        label: 'Service stockage',
        status: 'error',
        detail: String(e),
      });
    }

    // Config
    results.push({
      label: 'Mode application',
      status: config?.app_en_production ? 'ok' : 'warning',
      detail: config?.app_en_production ? 'PRODUCTION' : 'PRE-LANCEMENT',
    });

    if (config?.date_lancement) {
      const d = new Date(config.date_lancement);
      const now = new Date();
      const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
      results.push({
        label: 'Date de lancement',
        status: diff <= 0 ? 'ok' : diff <= 7 ? 'warning' : 'ok',
        detail: diff <= 0 ? `Lance depuis ${Math.abs(diff)} jours` : `Dans ${diff} jours (${d.toLocaleDateString('fr-FR')})`,
      });
    }

    // Users count
    try {
      const { count } = await supabase.from('utilisateurs').select('id', { count: 'exact', head: true }).eq('actif', true);
      results.push({
        label: 'Utilisateurs actifs',
        status: (count ?? 0) > 0 ? 'ok' : 'warning',
        detail: `${count ?? 0} utilisateurs actifs`,
      });
    } catch {
      results.push({ label: 'Utilisateurs actifs', status: 'error', detail: 'Impossible de compter' });
    }

    // Parcs
    try {
      const { count } = await supabase.from('parcs').select('id', { count: 'exact', head: true });
      results.push({
        label: 'Parcs configures',
        status: (count ?? 0) > 0 ? 'ok' : 'warning',
        detail: `${count ?? 0} parcs`,
      });
    } catch {
      results.push({ label: 'Parcs configures', status: 'error', detail: 'Erreur' });
    }

    // Incidents ouverts
    try {
      const { count } = await supabase
        .from('incidents')
        .select('id', { count: 'exact', head: true })
        .in('statut', ['ouvert', 'assigne', 'en_cours'])
        .eq('est_formation', false);
      results.push({
        label: 'Incidents ouverts (production)',
        status: (count ?? 0) > 10 ? 'warning' : 'ok',
        detail: `${count ?? 0} incident(s) ouvert(s)`,
      });
    } catch {
      results.push({ label: 'Incidents ouverts', status: 'error', detail: 'Erreur' });
    }

    setChecks(results);
    setLastRun(new Date());
    setRunning(false);
  }, [config]);

  const runEdgeFnChecks = useCallback(async () => {
    setRunning(true);
    const results: EdgeFnStatus[] = [];

    for (const fn of EDGE_FUNCTIONS) {
      try {
        const start = Date.now();
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'OPTIONS',
          headers: { 'Content-Type': 'application/json' },
        });
        const latency = Date.now() - start;
        results.push({
          name: fn,
          status: res.ok || res.status === 200 ? 'ok' : 'error',
          latencyMs: latency,
          detail: `HTTP ${res.status} — ${latency}ms`,
        });
      } catch (e) {
        results.push({
          name: fn,
          status: 'error',
          latencyMs: null,
          detail: String(e),
        });
      }
    }

    setEdgeFns(results);
    setRunning(false);
  }, []);

  const runTableChecks = useCallback(async () => {
    setRunning(true);
    const results: TableStats[] = [];

    for (const table of CORE_TABLES) {
      try {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        results.push({ name: table, count: count ?? 0, hasRls: true });
      } catch {
        results.push({ name: table, count: -1, hasRls: false });
      }
    }

    setTableStats(results);
    setRunning(false);
  }, []);

  const loadRecentErrors = useCallback(async () => {
    const errors: RecentError[] = [];
    try {
      const { data } = await supabase
        .from('incidents')
        .select('numero_bt, titre, declare_le')
        .eq('est_formation', false)
        .in('statut', ['ouvert', 'assigne'])
        .order('declare_le', { ascending: false })
        .limit(15);
      if (data) {
        for (const d of data) {
          errors.push({
            source: 'Incident',
            message: `${d.numero_bt} — ${d.titre}`,
            time: new Date(d.declare_le).toLocaleString('fr-FR'),
          });
        }
      }
    } catch { /* ignore */ }
    setRecentErrors(errors);
  }, []);

  useEffect(() => {
    runHealthChecks();
  }, [runHealthChecks]);

  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'edge' && edgeFns.length === 0) runEdgeFnChecks();
    if (tab === 'tables' && tableStats.length === 0) runTableChecks();
    if (tab === 'logs' && recentErrors.length === 0) loadRecentErrors();
  }, [edgeFns.length, tableStats.length, recentErrors.length, runEdgeFnChecks, runTableChecks, loadRecentErrors]);

  const isDirection = utilisateur?.role_code === 'direction' || utilisateur?.role_code === 'chef_maintenance';
  if (!isDirection) {
    return (
      <div className="p-6 text-dim text-sm">Acces reserve a la direction.</div>
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TerminalIcon className="w-5 h-5 text-nikito-cyan" />
            <h1 className="text-xl md:text-2xl lg:text-[22px] font-semibold m-0">
              Administration IT
            </h1>
          </div>
          <div className="text-[11px] text-dim">
            Diagnostics systeme, sante des services, et outils de debug
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRun && (
            <span className="text-[11px] text-faint">
              Dernier check : {lastRun.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button
            onClick={() => {
              if (activeTab === 'sante') runHealthChecks();
              else if (activeTab === 'edge') runEdgeFnChecks();
              else if (activeTab === 'tables') runTableChecks();
              else if (activeTab === 'logs') loadRecentErrors();
            }}
            disabled={running}
            className="bg-gradient-cta text-text px-4 py-2.5 rounded-lg text-[12px] font-medium min-h-[44px] disabled:opacity-50 hover:brightness-110 transition-all flex items-center gap-2"
          >
            <RefreshIcon className={cn('w-3.5 h-3.5', running && 'animate-spin')} />
            Rafraichir
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {([
          { key: 'sante', label: 'Sante systeme' },
          { key: 'edge', label: 'Edge Functions' },
          { key: 'tables', label: 'Tables DB' },
          { key: 'config', label: 'Configuration' },
          { key: 'logs', label: 'Incidents ouverts' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'px-4 py-2.5 rounded-[10px] text-[12px] font-medium whitespace-nowrap min-h-[40px] transition-colors',
              activeTab === tab.key
                ? 'bg-nikito-cyan/10 text-nikito-cyan border border-nikito-cyan/30'
                : 'bg-bg-card border border-white/[0.06] text-dim hover:text-text hover:bg-white/[0.04]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sante' && <TabSante checks={checks} running={running} />}
      {activeTab === 'edge' && <TabEdgeFunctions fns={edgeFns} running={running} />}
      {activeTab === 'tables' && <TabTables tables={tableStats} running={running} />}
      {activeTab === 'config' && <TabConfig />}
      {activeTab === 'logs' && <TabLogs errors={recentErrors} />}
    </div>
  );
}

function TabSante({ checks, running }: { checks: SystemCheck[]; running: boolean }) {
  if (running && checks.length === 0) return <LoadingState label="Verification en cours..." />;

  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warnCount = checks.filter((c) => c.status === 'warning').length;
  const errCount = checks.filter((c) => c.status === 'error').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="OK" value={okCount} color="green" />
        <StatCard label="Attention" value={warnCount} color="amber" />
        <StatCard label="Erreurs" value={errCount} color="red" />
      </div>

      <div className="bg-bg-card rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <StatusDot status={check.status} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium">{check.label}</div>
              <div className="text-[11px] text-dim truncate">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabEdgeFunctions({ fns, running }: { fns: EdgeFnStatus[]; running: boolean }) {
  if (running && fns.length === 0) return <LoadingState label="Test des edge functions..." />;
  if (fns.length === 0) return <LoadingState label="Chargement..." />;

  const okCount = fns.filter((f) => f.status === 'ok').length;

  return (
    <div className="space-y-4">
      <div className="bg-bg-card rounded-xl border border-white/[0.06] px-4 py-3">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Edge Functions</div>
        <div className="text-lg font-semibold">
          <span className="text-green">{okCount}</span>
          <span className="text-dim text-[13px]"> / {fns.length} operationnelles</span>
        </div>
      </div>

      <div className="bg-bg-card rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {fns.map((fn) => (
          <div key={fn.name} className="flex items-center gap-3 px-4 py-3">
            <StatusDot status={fn.status} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-mono font-medium">{fn.name}</div>
              <div className="text-[11px] text-dim">{fn.detail}</div>
            </div>
            {fn.latencyMs !== null && (
              <span className={cn(
                'text-[11px] font-mono px-2 py-0.5 rounded',
                fn.latencyMs < 500 ? 'text-green bg-green/10' : fn.latencyMs < 2000 ? 'text-amber bg-amber/10' : 'text-red bg-red/10'
              )}>
                {fn.latencyMs}ms
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabTables({ tables, running }: { tables: TableStats[]; running: boolean }) {
  if (running && tables.length === 0) return <LoadingState label="Comptage des tables..." />;
  if (tables.length === 0) return <LoadingState label="Chargement..." />;

  const totalRows = tables.reduce((sum, t) => sum + Math.max(0, t.count), 0);

  return (
    <div className="space-y-4">
      <div className="bg-bg-card rounded-xl border border-white/[0.06] px-4 py-3">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Base de donnees</div>
        <div className="text-lg font-semibold">
          {tables.length} tables - {totalRows.toLocaleString('fr-FR')} lignes
        </div>
      </div>

      <div className="bg-bg-card rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {tables.map((t) => (
          <div key={t.name} className="flex items-center gap-3 px-4 py-2.5">
            <StatusDot status={t.count >= 0 ? 'ok' : 'error'} />
            <span className="text-[12px] font-mono font-medium flex-1">{t.name}</span>
            <span className={cn(
              'text-[12px] font-mono px-2 py-0.5 rounded',
              t.count > 0 ? 'text-nikito-cyan bg-nikito-cyan/10' : t.count === 0 ? 'text-dim bg-white/[0.04]' : 'text-red bg-red/10'
            )}>
              {t.count >= 0 ? t.count.toLocaleString('fr-FR') : 'erreur'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabConfig() {
  const [configs, setConfigs] = useState<Array<{ cle: string; valeur: string }>>([]);
  const [envInfo, setEnvInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('config_globale').select('cle, valeur').order('cle');
      setConfigs(data ?? []);
    })();

    setEnvInfo({
      'Supabase URL': supabaseUrl,
      'User Agent': navigator.userAgent.slice(0, 80),
      'Ecran': `${window.screen.width}x${window.screen.height}`,
      'Viewport': `${window.innerWidth}x${window.innerHeight}`,
      'Langue': navigator.language,
      'Date locale': new Date().toLocaleString('fr-FR'),
      'Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-bg-card rounded-xl border border-white/[0.06]">
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="text-[13px] font-semibold">Configuration globale (config_globale)</div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {configs.map((c) => (
            <div key={c.cle} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[12px] font-mono text-dim flex-1">{c.cle}</span>
              <span className="text-[12px] font-mono text-nikito-cyan">{c.valeur}</span>
            </div>
          ))}
          {configs.length === 0 && (
            <div className="px-4 py-3 text-[12px] text-dim">Aucune configuration</div>
          )}
        </div>
      </div>

      <div className="bg-bg-card rounded-xl border border-white/[0.06]">
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <div className="text-[13px] font-semibold">Environnement client</div>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {Object.entries(envInfo).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[12px] text-dim flex-1">{k}</span>
              <span className="text-[12px] font-mono text-text truncate max-w-[300px]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabLogs({ errors }: { errors: RecentError[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-bg-card rounded-xl border border-white/[0.06] px-4 py-3">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-1">Incidents ouverts (production)</div>
        <div className="text-lg font-semibold">{errors.length} incident(s)</div>
      </div>

      <div className="bg-bg-card rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
        {errors.length === 0 ? (
          <div className="px-4 py-6 text-[12px] text-dim text-center">Aucun incident ouvert</div>
        ) : (
          errors.map((err, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5">
              <span className="bg-red/10 text-red text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">
                {err.source}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] truncate">{err.message}</div>
                <div className="text-[10px] text-faint">{err.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'green' | 'amber' | 'red' }) {
  const colors = {
    green: 'text-green bg-green/10 border-green/20',
    amber: 'text-amber bg-amber/10 border-amber/20',
    red: 'text-red bg-red/10 border-red/20',
  };
  return (
    <div className={cn('rounded-xl px-4 py-3 border text-center', colors[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] opacity-80">{label}</div>
    </div>
  );
}

function StatusDot({ status }: { status: 'ok' | 'warning' | 'error' | 'loading' }) {
  return (
    <span className={cn(
      'w-2.5 h-2.5 rounded-full flex-shrink-0',
      status === 'ok' && 'bg-green',
      status === 'warning' && 'bg-amber',
      status === 'error' && 'bg-red',
      status === 'loading' && 'bg-dim animate-pulse',
    )} />
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 gap-3">
      <RefreshIcon className="w-4 h-4 text-dim animate-spin" />
      <span className="text-[13px] text-dim">{label}</span>
    </div>
  );
}

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="14" rx="2" />
      <path d="M6 8l3 2-3 2" />
      <path d="M11 12h3" />
    </svg>
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
