import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useParcs, useCategoriesEquipement, useZonesParc, useModifierEquipement } from '@/hooks/queries/useReferentiel';
import type { EquipementAvecJoins, StatutEquipement } from '@/types/database';

interface ModaleDetailEquipementProps {
  equipement: EquipementAvecJoins;
  onClose: () => void;
}

const STATUT_CONFIG: Record<StatutEquipement, { label: string; classes: string }> = {
  actif: { label: 'Actif', classes: 'bg-green/15 text-green' },
  maintenance: { label: 'Maintenance', classes: 'bg-amber/15 text-amber' },
  hors_service: { label: 'Hors service', classes: 'bg-red/15 text-red' },
  archive: { label: 'Archive', classes: 'bg-faint/20 text-dim' },
};

function formatDate(d: string | null): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isGarantieExpiree(d: string | null): boolean {
  if (!d) return false;
  return new Date(d) < new Date();
}

export function ModaleDetailEquipement({ equipement, onClose }: ModaleDetailEquipementProps) {
  const [edition, setEdition] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[640px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        {edition ? (
          <FormulaireEdition
            equipement={equipement}
            onClose={onClose}
            onAnnuler={() => setEdition(false)}
          />
        ) : (
          <VueDetail
            equipement={equipement}
            onClose={onClose}
            onModifier={() => setEdition(true)}
          />
        )}
      </div>
    </div>
  );
}

function VueDetail({
  equipement: eq,
  onClose,
  onModifier,
}: {
  equipement: EquipementAvecJoins;
  onClose: () => void;
  onModifier: () => void;
}) {
  const modifier = useModifierEquipement();
  const cfg = STATUT_CONFIG[eq.statut] ?? STATUT_CONFIG.actif;

  const archiver = async () => {
    await modifier.mutateAsync({ id: eq.id, statut: 'archive' });
    onClose();
  };

  return (
    <>
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Equipement</div>
          <div className="text-[19px] font-semibold mt-0.5">{eq.libelle}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-[12px] text-nikito-cyan">{eq.code}</span>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', cfg.classes)}>
              {cfg.label}
            </span>
            {eq.a_surveiller && (
              <span className="bg-amber/15 text-amber text-[10px] font-bold px-1.5 py-0.5 rounded-md">A surveiller</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
        >
          x
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <InfoCell label="Parc" value={eq.parcs ? `${eq.parcs.code} — ${eq.parcs.nom}` : '--'} />
        <InfoCell label="Categorie" value={eq.categories_equipement?.nom ?? '--'} />
        <InfoCell label="Zone" value={eq.zones?.nom ?? '--'} />
        <InfoCell label="N° serie" value={eq.numero_serie ?? '--'} />
        <InfoCell label="Mise en service" value={formatDate(eq.date_mise_service)} />
        <InfoCell
          label="Fin de garantie"
          value={formatDate(eq.date_fin_garantie)}
          danger={isGarantieExpiree(eq.date_fin_garantie)}
        />
      </div>

      <div className="bg-bg-deep rounded-[10px] p-3.5 mb-5 border border-white/[0.04]">
        <div className="text-[11px] text-dim tracking-[1.2px] uppercase mb-2">Historique</div>
        <div className="text-[12px] text-faint">
          Incidents, interventions et controles lies a cet equipement — a venir
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-between">
        {eq.statut !== 'archive' && (
          <button
            onClick={archiver}
            disabled={modifier.isPending}
            className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-red/10 border border-red/20 text-red hover:border-red/40 transition-colors min-h-[44px] disabled:opacity-40"
          >
            {modifier.isPending ? 'Archivage...' : 'Archiver cet equipement'}
          </button>
        )}
        <div className="flex gap-2.5 sm:ml-auto">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Fermer
          </button>
          <button
            onClick={onModifier}
            className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]"
          >
            Modifier
          </button>
        </div>
      </div>
    </>
  );
}

function InfoCell({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="bg-bg-deep rounded-[10px] p-2.5 px-3.5">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={cn('text-[13px] mt-0.5', danger ? 'text-red font-semibold' : 'text-text')}>{value}</div>
    </div>
  );
}

function FormulaireEdition({
  equipement: eq,
  onClose,
  onAnnuler,
}: {
  equipement: EquipementAvecJoins;
  onClose: () => void;
  onAnnuler: () => void;
}) {
  const { data: parcs } = useParcs();
  const { data: categories } = useCategoriesEquipement();
  const modifier = useModifierEquipement();

  const [parcId, setParcId] = useState(eq.parc_id);
  const [categorieId, setCategorieId] = useState(eq.categorie_id);
  const [zoneId, setZoneId] = useState(eq.zone_id ?? '');
  const [code, setCode] = useState(eq.code);
  const [libelle, setLibelle] = useState(eq.libelle);
  const [numeroSerie, setNumeroSerie] = useState(eq.numero_serie ?? '');
  const [dateMiseService, setDateMiseService] = useState(eq.date_mise_service ?? '');
  const [dateFinGarantie, setDateFinGarantie] = useState(eq.date_fin_garantie ?? '');
  const [statut, setStatut] = useState<StatutEquipement>(eq.statut);
  const [aSurveiller, setASurveiller] = useState(eq.a_surveiller);

  const { data: zones } = useZonesParc(parcId || undefined);

  const peutSauver = code.length > 0 && libelle.length > 0 && parcId.length > 0 && categorieId.length > 0;

  const sauver = async () => {
    if (!peutSauver) return;
    await modifier.mutateAsync({
      id: eq.id,
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
    <>
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Modification</div>
          <div className="text-[19px] font-semibold mt-0.5">{eq.code}</div>
        </div>
        <button
          onClick={onAnnuler}
          className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
        >
          x
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">
        <Field label="Parc *">
          <select value={parcId} onChange={(e) => { setParcId(e.target.value); setZoneId(''); }}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan">
            <option value="">Selectionner</option>
            {parcs?.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
          </select>
        </Field>
        <Field label="Categorie *">
          <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan">
            <option value="">Selectionner</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Zone">
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}
            disabled={!parcId || (zones ?? []).length === 0}
            className={cn('w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan',
              (!parcId || (zones ?? []).length === 0) && 'opacity-40')}>
            <option value="">{(zones ?? []).length === 0 ? 'Aucune zone' : 'Pas de zone'}</option>
            {zones?.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
          </select>
        </Field>
        <Field label="Statut">
          <select value={statut} onChange={(e) => setStatut(e.target.value as StatutEquipement)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan">
            <option value="actif">Actif</option>
            <option value="maintenance">Maintenance</option>
            <option value="hors_service">Hors service</option>
            <option value="archive">Archive</option>
          </select>
        </Field>
        <Field label="Code *" wide>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan" />
        </Field>
        <Field label="Libelle *" wide>
          <input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan" />
        </Field>
        <Field label="Numero de serie">
          <input type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan" />
        </Field>
        <Field label="Mise en service">
          <input type="date" value={dateMiseService} onChange={(e) => setDateMiseService(e.target.value)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan" />
        </Field>
        <Field label="Fin de garantie">
          <input type="date" value={dateFinGarantie} onChange={(e) => setDateFinGarantie(e.target.value)}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan" />
        </Field>
        <Field label="A surveiller">
          <button type="button" onClick={() => setASurveiller(!aSurveiller)}
            className={cn('w-12 h-7 rounded-full transition-colors relative',
              aSurveiller ? 'bg-amber' : 'bg-bg-deep border border-white/[0.08]')}>
            <span className={cn('absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform',
              aSurveiller ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
        </Field>
      </div>

      {modifier.isError && (
        <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
          Erreur : {(modifier.error as Error).message}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end mt-5">
        <button onClick={onAnnuler}
          className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">
          Annuler
        </button>
        <button onClick={sauver} disabled={!peutSauver || modifier.isPending}
          className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
            (!peutSauver || modifier.isPending) && 'opacity-40 cursor-not-allowed')}>
          {modifier.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </>
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
