import { cn } from '@/lib/utils';
import { useControleDetail, type ControleHistorique } from '@/hooks/queries/useHistoriqueControles';
import type { TypeControle } from '@/types/database';

const typeLabel: Record<TypeControle, string> = {
  quotidien: 'Quotidien',
  hebdo: 'Hebdo',
  mensuel: 'Mensuel',
};

const statutLabel: Record<string, string> = {
  valide: 'Valide',
  en_cours: 'En cours',
  echec: 'Echec',
  remplace: 'Remplace',
  a_faire: 'A faire',
};

const statutStyle: Record<string, string> = {
  valide: 'bg-green/15 text-green',
  en_cours: 'bg-amber/15 text-amber',
  echec: 'bg-red/15 text-red',
  remplace: 'bg-dim/15 text-dim',
  a_faire: 'bg-dim/10 text-dim',
};

const etatStyle: Record<string, { bg: string; label: string }> = {
  ok: { bg: 'bg-green/15 text-green', label: 'OK' },
  degrade: { bg: 'bg-amber/15 text-amber', label: 'DEG' },
  hs: { bg: 'bg-red/15 text-red', label: 'HS' },
};

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '-';
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  if (ms < 0) return '-';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

interface ModaleDetailControleProps {
  controle: ControleHistorique;
  onClose: () => void;
  onExportPDF: (controle: ControleHistorique) => void;
  onNavigateCorrection?: (id: string) => void;
}

export function ModaleDetailControle({ controle, onClose, onExportPDF, onNavigateCorrection }: ModaleDetailControleProps) {
  const { data, isLoading } = useControleDetail(controle.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[820px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-white/[0.08] max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-bg-card z-10 px-5 pt-5 pb-4 border-b border-white/[0.06] flex justify-between items-start">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              Detail du controle
            </div>
            <div className="text-[19px] font-semibold mt-0.5">
              {controle.parc_code} - {typeLabel[controle.type]} - {formatDateLong(controle.date_planifiee)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex-shrink-0"
          >
            x
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCell label="Parc" value={`${controle.parc_code} - ${controle.parc_nom}`} />
            <InfoCell label="Type" value={typeLabel[controle.type]} />
            <InfoCell label="Controleur" value={controle.realise_par_nom ?? '-'} />
            <InfoCell label="Role" value={controle.realise_par_role ?? '-'} />
            <InfoCell label="Duree" value={formatDuree(controle.date_demarrage, controle.date_validation)} />
            <InfoCell label="Statut">
              <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-bold', statutStyle[controle.statut])}>
                {statutLabel[controle.statut] ?? controle.statut}
              </span>
            </InfoCell>
            <InfoCell label="Points OK" value={String(controle.nb_ok)} accent="text-green" />
            <InfoCell label="Points KO" value={String(controle.nb_ko)} accent="text-red" />
          </div>

          {(controle.signature_at || controle.gps_latitude || controle.hash_integrite) && (
            <div className="bg-bg-deep rounded-xl p-4 space-y-2">
              <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Signature electronique</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
                {controle.signature_at && (
                  <div><span className="text-dim">Signe le : </span><span className="text-text">{formatDatetime(controle.signature_at)}</span></div>
                )}
                {controle.gps_latitude && controle.gps_longitude && (
                  <div><span className="text-dim">GPS : </span><span className="text-text">{controle.gps_latitude.toFixed(5)}, {controle.gps_longitude.toFixed(5)}</span></div>
                )}
                {controle.hash_integrite && (
                  <div className="md:col-span-3"><span className="text-dim">Hash : </span><span className="text-text font-mono text-[11px] break-all">{controle.hash_integrite}</span></div>
                )}
              </div>
            </div>
          )}

          {controle.signature_url && (
            <div className="bg-bg-deep rounded-xl p-4">
              <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Signature</div>
              <img src={controle.signature_url} alt="Signature" className="max-h-[80px] rounded-lg bg-white/5 p-2" />
            </div>
          )}

          {controle.motif_correction && (
            <div className="bg-amber/10 border border-amber/20 rounded-xl p-4">
              <div className="text-[11px] text-amber uppercase tracking-wider mb-1">Correction</div>
              <div className="text-[13px] text-text">Motif : {controle.motif_correction}</div>
              {controle.remplace_id && onNavigateCorrection && (
                <button
                  onClick={() => onNavigateCorrection(controle.remplace_id!)}
                  className="text-nikito-cyan text-[12px] mt-1 hover:underline"
                >
                  Voir le controle original
                </button>
              )}
            </div>
          )}

          <div>
            <div className="text-[11px] text-dim uppercase tracking-wider mb-3">
              Points de controle ({data?.items.length ?? '...'})
            </div>
            {isLoading ? (
              <div className="text-dim text-sm py-4">Chargement...</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {data?.items.map((item) => {
                  const style = etatStyle[item.etat] ?? { bg: 'bg-dim/15 text-dim', label: item.etat };
                  const libelle = item.point_libelle_snapshot ?? item.point_libelle ?? 'Point inconnu';
                  const categorie = item.point_categorie_snapshot ?? item.point_categorie;
                  return (
                    <div key={item.id} className={cn('bg-bg-deep rounded-lg p-3 flex items-start gap-3', item.etat !== 'ok' && 'border border-white/[0.06]')}>
                      <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold mt-0.5 flex-shrink-0', style.bg)}>
                        {style.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px]">{libelle}</div>
                        {categorie && <div className="text-[11px] text-dim mt-0.5">{categorie}</div>}
                        {item.commentaire && <div className="text-[12px] text-amber mt-1">{item.commentaire}</div>}
                      </div>
                      {item.photo_url && (
                        <img src={item.photo_url} alt="Photo" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {data?.auditLog && data.auditLog.length > 0 && (
            <div>
              <div className="text-[11px] text-dim uppercase tracking-wider mb-3">Audit trail</div>
              <div className="bg-bg-deep rounded-xl overflow-hidden">
                {data.auditLog.map((log, i) => (
                  <div key={log.id} className={cn('px-4 py-2.5 flex items-start gap-3 text-[12px]', i > 0 && 'border-t border-white/[0.04]')}>
                    <div className="text-dim whitespace-nowrap">{formatDatetime(log.created_at)}</div>
                    <div className="flex-1">
                      <span className="text-text font-medium">{log.action}</span>
                      {log.utilisateur_nom && (
                        <span className="text-dim"> par {log.utilisateur_nom}</span>
                      )}
                      {log.ip && (
                        <span className="text-faint ml-2">({log.ip})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-2">
            <button
              onClick={onClose}
              className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
            >
              Fermer
            </button>
            <button
              onClick={() => onExportPDF(controle)}
              className="bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
            >
              Exporter PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, accent, children }: { label: string; value?: string; accent?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-wider mb-1">{label}</div>
      {children ?? <div className={cn('text-[13px] font-medium', accent)}>{value}</div>}
    </div>
  );
}
