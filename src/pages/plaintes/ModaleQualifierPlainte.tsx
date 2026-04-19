import { useState } from 'react';
import { useEquipements } from '@/hooks/queries/useReferentiel';
import { useQualifierPlainte, type PlainteRow } from './usePlaintesQueries';
import { cn } from '@/lib/utils';

const PRIORITE_MAP: Record<string, string> = {
  critique: 'bloquant',
  haute: 'majeur',
  normale: 'mineur',
};

interface Props {
  plainte: PlainteRow;
  prioriteIds: Record<string, string>;
  userId: string;
  onClose: () => void;
}

export function ModaleQualifierMaintenance({ plainte, prioriteIds, userId, onClose }: Props) {
  const qualifier = useQualifierPlainte();
  const { data: equipements } = useEquipements(plainte.parc_id || undefined);
  const [motif, setMotif] = useState('');
  const [equipementId, setEquipementId] = useState(plainte.equipement_id ?? '');
  const [priorite, setPriorite] = useState(plainte.priorite ?? 'normale');
  const [creerIncident, setCreerIncident] = useState(true);

  const submit = async () => {
    const prioriteCode = PRIORITE_MAP[priorite] ?? 'mineur';
    const prioriteId = prioriteIds[prioriteCode];

    await qualifier.mutateAsync({
      plainteId: plainte.id,
      statut: 'maintenance_confirmee',
      qualifieParId: userId,
      motif: motif.trim() || null,
      creerIncident: creerIncident && !!equipementId && !!prioriteId,
      incidentPayload: creerIncident && equipementId && prioriteId
        ? {
            equipement_id: equipementId,
            priorite_id: prioriteId,
            titre: `Plainte client — ${plainte.client_nom ?? 'Anonyme'}`,
            description: plainte.commentaire ?? 'Plainte client sans commentaire',
            parc_id: plainte.parc_id,
          }
        : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-green/20 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Qualification</div>
            <div className="text-[17px] font-semibold mt-0.5">Confirmer comme maintenance</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">&times;</button>
        </div>

        {plainte.commentaire && (
          <div className="bg-bg-deep rounded-xl p-3 mb-4 text-[13px] text-dim italic">
            &laquo; {plainte.commentaire.slice(0, 200)}{plainte.commentaire.length > 200 ? '...' : ''} &raquo;
          </div>
        )}

        <div className="grid gap-3.5 mb-5">
          <Field label="Motif / commentaire (optionnel)">
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={2}
              placeholder="Ex: Laser game blaster HS, deja signale..."
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[60px]"
            />
          </Field>

          <Field label="Equipement concerne (optionnel)">
            <select
              value={equipementId}
              onChange={(e) => setEquipementId(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
            >
              <option value="">Aucun</option>
              {(equipements ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>
              ))}
            </select>
          </Field>

          <Field label="Priorite">
            <select
              value={priorite}
              onChange={(e) => setPriorite(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
            >
              <option value="critique">Critique</option>
              <option value="haute">Haute</option>
              <option value="normale">Normale</option>
            </select>
          </Field>

          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={creerIncident}
              onChange={(e) => setCreerIncident(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 accent-green"
            />
            <span className="text-[13px] text-text">Creer un incident immediatement</span>
          </label>

          {creerIncident && !equipementId && (
            <div className="text-amber text-[11px] bg-amber/10 rounded-lg p-2.5">
              Selectionnez un equipement pour pouvoir creer l'incident.
            </div>
          )}
        </div>

        {qualifier.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(qualifier.error as Error).message}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button
            onClick={submit}
            disabled={qualifier.isPending}
            className={cn(
              'bg-green text-[#0B0B2E] px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              qualifier.isPending && 'opacity-40 cursor-not-allowed'
            )}
          >
            {qualifier.isPending ? 'En cours...' : 'Confirmer maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModaleQualifierHorsMaintenance({ plainte, userId, onClose }: { plainte: PlainteRow; userId: string; onClose: () => void }) {
  const qualifier = useQualifierPlainte();
  const [motif, setMotif] = useState('');

  const submit = async () => {
    if (!motif.trim()) return;
    await qualifier.mutateAsync({
      plainteId: plainte.id,
      statut: 'hors_maintenance',
      qualifieParId: userId,
      motif: motif.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[480px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-white/10 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Qualification</div>
            <div className="text-[17px] font-semibold mt-0.5">Classer hors maintenance</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">&times;</button>
        </div>

        <div className="grid gap-3.5 mb-5">
          <Field label="Motif *">
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Ex: Probleme de service, pas de materiel..."
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[80px]"
            />
          </Field>
        </div>

        {qualifier.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(qualifier.error as Error).message}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button
            onClick={submit}
            disabled={!motif.trim() || qualifier.isPending}
            className={cn(
              'bg-white/10 text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!motif.trim() || qualifier.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {qualifier.isPending ? 'En cours...' : 'Classer hors maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
