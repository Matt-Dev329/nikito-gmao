import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParcs, useCategoriesEquipement, useZonesParc, useCreerEquipement } from '@/hooks/queries/useReferentiel';
import type { StatutEquipement } from '@/types/database';

interface ModaleCreerEquipementProps {
  onClose: () => void;
}

export function ModaleCreerEquipement({ onClose }: ModaleCreerEquipementProps) {
  const { data: parcs } = useParcs();
  const { data: categories } = useCategoriesEquipement();
  const creer = useCreerEquipement();

  const [parcId, setParcId] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [code, setCode] = useState('');
  const [libelle, setLibelle] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [dateMiseService, setDateMiseService] = useState('');
  const [dateFinGarantie, setDateFinGarantie] = useState('');
  const [statut, setStatut] = useState<StatutEquipement>('actif');
  const [aSurveiller, setASurveiller] = useState(false);

  const { data: zones } = useZonesParc(parcId || undefined);

  const peutCreer = code.length > 0 && libelle.length > 0 && parcId.length > 0 && categorieId.length > 0;

  const enregistrer = async () => {
    if (!peutCreer) return;
    await creer.mutateAsync({
      parc_id: parcId,
      categorie_id: categorieId,
      zone_id: zoneId || null,
      code,
      libelle,
      numero_serie: numeroSerie || null,
      date_mise_service: dateMiseService || null,
      date_fin_garantie: dateFinGarantie || null,
      statut,
      a_surveiller: aSurveiller,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[600px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Equipements</div>
            <div className="text-[19px] font-semibold mt-0.5">Nouvel equipement</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            x
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">
          <Field label="Parc *">
            <select
              value={parcId}
              onChange={(e) => { setParcId(e.target.value); setZoneId(''); }}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              <option value="">Selectionner un parc</option>
              {parcs?.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Categorie *">
            <select
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              <option value="">Selectionner une categorie</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Zone">
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              disabled={!parcId || (zones ?? []).length === 0}
              className={cn(
                'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan',
                (!parcId || (zones ?? []).length === 0) && 'opacity-40'
              )}
            >
              <option value="">{(zones ?? []).length === 0 ? 'Aucune zone' : 'Pas de zone'}</option>
              {zones?.map((z) => (
                <option key={z.id} value={z.id}>{z.nom}</option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutEquipement)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            >
              <option value="actif">Actif</option>
              <option value="maintenance">Maintenance</option>
              <option value="hors_service">Hors service</option>
            </select>
          </Field>
          <Field label="Code *" wide>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              placeholder="Ex: TRAMP-ALF-001"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Libelle *" wide>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex: Trampoline principal zone A"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Numero de serie">
            <input
              type="text"
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Date de mise en service">
            <input
              type="date"
              value={dateMiseService}
              onChange={(e) => setDateMiseService(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="Date fin de garantie">
            <input
              type="date"
              value={dateFinGarantie}
              onChange={(e) => setDateFinGarantie(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </Field>
          <Field label="A surveiller">
            <button
              type="button"
              onClick={() => setASurveiller(!aSurveiller)}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative',
                aSurveiller ? 'bg-amber' : 'bg-bg-deep border border-white/[0.08]'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
                  aSurveiller ? 'translate-x-5' : 'translate-x-0.5'
                )}
              />
            </button>
          </Field>
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
            {creer.isPending ? 'Creation...' : 'Creer l\'equipement'}
          </button>
        </div>
      </div>
    </div>
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
