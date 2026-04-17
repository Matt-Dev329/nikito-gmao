import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParcs, useEquipements } from '@/hooks/queries/useReferentiel';
import { useCreerFiche5P } from '@/hooks/queries/useFiches5P';

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function ModaleCreerFiche5P({ onClose, onCreated }: Props) {
  const { data: parcs } = useParcs();
  const [parcId, setParcId] = useState('');
  const { data: equipements } = useEquipements(parcId || undefined);
  const creer = useCreerFiche5P();

  const [titre, setTitre] = useState('');
  const [equipementId, setEquipementId] = useState('');
  const [description, setDescription] = useState('');

  const peutCreer = titre.trim().length > 0 && parcId.length > 0;

  const submit = async () => {
    if (!peutCreer) return;
    const result = await creer.mutateAsync({
      parc_id: parcId,
      equipement_id: equipementId || null,
      titre: titre.trim(),
      description: description.trim() || null,
    });
    onCreated(result.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div
        className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Analyse</div>
            <div className="text-[19px] font-semibold mt-0.5">Nouvelle fiche 5 Pourquoi</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3.5 mb-5">
          <Field label="Titre *">
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Arret repete toboggan G2"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
            />
          </Field>

          <Field label="Parc *">
            <select
              value={parcId}
              onChange={(e) => { setParcId(e.target.value); setEquipementId(''); }}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
            >
              <option value="">Selectionner un parc</option>
              {parcs?.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </Field>

          <Field label="Equipement">
            <select
              value={equipementId}
              onChange={(e) => setEquipementId(e.target.value)}
              disabled={!parcId}
              className={cn(
                'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]',
                !parcId && 'opacity-40'
              )}
            >
              <option value="">Aucun (optionnel)</option>
              {(equipements ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.code} &mdash; {e.libelle}</option>
              ))}
            </select>
          </Field>

          <Field label="Description du probleme">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Decrivez le probleme observe..."
              rows={3}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[80px]"
            />
          </Field>
        </div>

        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(creer.error as Error).message}
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
            onClick={submit}
            disabled={!peutCreer || creer.isPending}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!peutCreer || creer.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {creer.isPending ? 'Creation...' : 'Creer la fiche'}
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
