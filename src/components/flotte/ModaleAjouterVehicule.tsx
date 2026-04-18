import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAjouterVehicule } from '@/hooks/queries/useFlotte';

interface Props {
  onClose: () => void;
}

export function ModaleAjouterVehicule({ onClose }: Props) {
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const [immatriculation, setImmatriculation] = useState('');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [trackerId, setTrackerId] = useState('');
  const { mutate: ajouter, isPending } = useAjouterVehicule();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !libelle.trim()) return;

    ajouter(
      {
        code: code.trim(),
        libelle: libelle.trim(),
        immatriculation: immatriculation.trim() || undefined,
        marque: marque.trim() || undefined,
        modele: modele.trim() || undefined,
        tracker_id: trackerId.trim() || undefined,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-bg-card rounded-2xl p-5 md:p-6 max-w-[480px] w-full border border-white/[0.08] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[16px] font-semibold">Ajouter un vehicule</div>
            <div className="text-[11px] text-dim mt-0.5">Remplir les informations du vehicule</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex-shrink-0"
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
          <Field label="Tracker ID" value={trackerId} onChange={setTrackerId} placeholder="Pour future connexion API" />

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
              disabled={!code.trim() || !libelle.trim() || isPending}
              className={cn(
                'bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
                (!code.trim() || !libelle.trim() || isPending) && 'opacity-40 cursor-not-allowed'
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
