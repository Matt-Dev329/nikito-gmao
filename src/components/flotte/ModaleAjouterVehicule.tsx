import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  useAjouterVehicule,
  useParcs,
  useUtilisateursAssignables,
} from '@/hooks/queries/useFlotte';

type TrackerType = 'gemstone' | 'autre' | 'aucun';
type StatutInitial = 'actif' | 'maintenance';

interface Props {
  onClose: () => void;
}

const IMEI_REGEX = /^\d{15}$/;

export function ModaleAjouterVehicule({ onClose }: Props) {
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const [immatriculation, setImmatriculation] = useState('');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [parcId, setParcId] = useState('');
  const [assigneId, setAssigneId] = useState('');
  const [trackerType, setTrackerType] = useState<TrackerType>('aucun');
  const [trackerId, setTrackerId] = useState('');
  const [statut, setStatut] = useState<StatutInitial>('actif');

  const { mutate: ajouter, isPending } = useAjouterVehicule();
  const { data: parcs } = useParcs();
  const { data: assignables } = useUtilisateursAssignables();

  const imeiInvalid = useMemo(() => {
    if (trackerType !== 'gemstone') return false;
    return !IMEI_REGEX.test(trackerId.trim());
  }, [trackerType, trackerId]);

  const canSubmit = code.trim() && libelle.trim() && !imeiInvalid && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    ajouter(
      {
        code: code.trim(),
        libelle: libelle.trim(),
        immatriculation: immatriculation.trim() || undefined,
        marque: marque.trim() || undefined,
        modele: modele.trim() || undefined,
        parc_id: parcId || undefined,
        assigne_a_id: assigneId || undefined,
        tracker_type: trackerType,
        tracker_id: trackerType !== 'aucun' && trackerId.trim() ? trackerId.trim() : undefined,
        statut,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl p-5 md:p-6 max-w-[520px] w-full border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[16px] font-semibold">Ajouter un vehicule</div>
            <div className="text-[11px] text-dim mt-0.5">Remplir les informations du vehicule</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex-shrink-0"
            type="button"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code *" value={code} onChange={setCode} placeholder="VEH-04" />
            <Field label="Immatriculation" value={immatriculation} onChange={setImmatriculation} placeholder="AB-123-CD" />
          </div>

          <Field label="Libelle *" value={libelle} onChange={setLibelle} placeholder="Utilitaire Maintenance 3" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Marque" value={marque} onChange={setMarque} placeholder="Renault" />
            <Field label="Modele" value={modele} onChange={setModele} placeholder="Kangoo" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-dim uppercase tracking-wider mb-1">Parc de rattachement</label>
              <select
                value={parcId}
                onChange={(e) => setParcId(e.target.value)}
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
              >
                <option value="">Non assigne</option>
                {parcs?.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-dim uppercase tracking-wider mb-1">Assignation</label>
              <select
                value={assigneId}
                onChange={(e) => setAssigneId(e.target.value)}
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
              >
                <option value="">Non assigne</option>
                {assignables?.map((u) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Type de tracker</label>
            <div className="flex gap-2 flex-wrap">
              <RadioChip
                label="Gemstone"
                checked={trackerType === 'gemstone'}
                onChange={() => setTrackerType('gemstone')}
              />
              <RadioChip
                label="Autre"
                checked={trackerType === 'autre'}
                onChange={() => setTrackerType('autre')}
              />
              <RadioChip
                label="Aucun"
                checked={trackerType === 'aucun'}
                onChange={() => { setTrackerType('aucun'); setTrackerId(''); }}
              />
            </div>
          </div>

          {trackerType !== 'aucun' && (
            <div>
              <label className="block text-[10px] text-dim uppercase tracking-wider mb-1">
                {trackerType === 'gemstone' ? 'IMEI Gemstone * (15 chiffres)' : 'Identifiant tracker'}
              </label>
              <input
                value={trackerId}
                onChange={(e) => setTrackerId(e.target.value)}
                placeholder={trackerType === 'gemstone' ? '123456789012345' : 'ID tracker'}
                className={cn(
                  'w-full bg-bg-deep border rounded-[10px] px-3 py-2.5 text-text text-[13px] outline-none',
                  imeiInvalid
                    ? 'border-red/60 focus:border-red'
                    : 'border-white/[0.08] focus:border-nikito-cyan',
                )}
              />
              {imeiInvalid && trackerId.length > 0 && (
                <div className="text-[10px] text-red mt-1">L'IMEI Gemstone doit contenir exactement 15 chiffres.</div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] text-dim uppercase tracking-wider mb-1.5">Statut initial</label>
            <div className="flex gap-2 flex-wrap">
              <RadioChip
                label="Actif"
                checked={statut === 'actif'}
                onChange={() => setStatut('actif')}
              />
              <RadioChip
                label="Maintenance"
                checked={statut === 'maintenance'}
                onChange={() => setStatut('maintenance')}
              />
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                'bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
                !canSubmit && 'opacity-40 cursor-not-allowed',
              )}
            >
              {isPending ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] text-dim uppercase tracking-wider mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 py-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
      />
    </div>
  );
}

function RadioChip({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'px-3 py-2 rounded-[10px] text-[12px] font-medium border transition-all min-h-[38px]',
        checked
          ? 'bg-gradient-cta text-text border-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.15)]'
          : 'bg-bg-deep border-white/[0.08] text-dim hover:border-white/[0.2] hover:text-text',
      )}
    >
      {label}
    </button>
  );
}
