import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCategoriesEquipement } from '@/hooks/queries/useReferentiel';
import { useCreerPoint } from '@/hooks/queries/useBibliotheque';
import type { TypeControle, AssigneA } from '@/types/database';

interface ModaleCreerPointProps {
  onClose: () => void;
}

export function ModaleCreerPoint({ onClose }: ModaleCreerPointProps) {
  const { data: categories } = useCategoriesEquipement();
  const creer = useCreerPoint();

  const [categorieId, setCategorieId] = useState('');
  const [libelle, setLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [typeControle, setTypeControle] = useState<TypeControle>('hebdo');
  const [assigneA, setAssigneA] = useState<AssigneA>('tech');
  const [bloquantSiKo, setBloquantSiKo] = useState(false);
  const [photoObligatoire, setPhotoObligatoire] = useState(false);
  const [normeAssociee, setNormeAssociee] = useState('');
  const [ordre, setOrdre] = useState(99);

  const peutCreer = libelle.length > 0 && categorieId.length > 0;

  const enregistrer = async () => {
    if (!peutCreer) return;
    await creer.mutateAsync({
      categorie_id: categorieId,
      libelle,
      description: description || null,
      type_controle: typeControle,
      assigne_a: assigneA,
      bloquant_si_ko: bloquantSiKo,
      photo_obligatoire: photoObligatoire,
      norme_associee: normeAssociee || null,
      ordre,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[580px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Bibliotheque</div>
            <div className="text-[19px] font-semibold mt-0.5">Nouveau point de controle</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            x
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">
          <Field label="Categorie *">
            <select
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              <option value="">Selectionner</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Type de controle *">
            <select
              value={typeControle}
              onChange={(e) => setTypeControle(e.target.value as TypeControle)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              <option value="quotidien">Quotidien</option>
              <option value="hebdo">Hebdo</option>
              <option value="mensuel">Mensuel</option>
            </select>
          </Field>
          <Field label="Libelle *" wide>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              autoFocus
              placeholder="Ex: Verifier etat des fixations"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Description" wide>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Instructions detaillees (optionnel)"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] text-text p-3 px-3.5 text-[13px] resize-y min-h-[70px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Assigne a">
            <select
              value={assigneA}
              onChange={(e) => setAssigneA(e.target.value as AssigneA)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              <option value="staff">Staff</option>
              <option value="tech">Technicien</option>
            </select>
          </Field>
          <Field label="Ordre">
            <input
              type="number"
              value={ordre}
              onChange={(e) => setOrdre(Number(e.target.value))}
              min={1}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Norme associee">
            <input
              type="text"
              value={normeAssociee}
              onChange={(e) => setNormeAssociee(e.target.value)}
              placeholder="Ex: EN 1176"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <div className="flex gap-6">
            <Field label="Bloquant si KO">
              <Toggle value={bloquantSiKo} onChange={setBloquantSiKo} color="red" />
            </Field>
            <Field label="Photo oblig.">
              <Toggle value={photoObligatoire} onChange={setPhotoObligatoire} />
            </Field>
          </div>
        </div>

        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(creer.error as Error).message}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-5">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={enregistrer}
            disabled={!peutCreer || creer.isPending}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!peutCreer || creer.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {creer.isPending ? 'Creation...' : 'Creer le point'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange, color }: { value: boolean; onChange: (v: boolean) => void; color?: 'red' }) {
  const activeColor = color === 'red' ? 'bg-red' : 'bg-nikito-cyan';
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'w-12 h-7 rounded-full transition-colors relative',
        value ? activeColor : 'bg-bg-deep border border-white/[0.08]'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
