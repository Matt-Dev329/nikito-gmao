import { useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useParcs, useCategoriesEquipement, useImporterEquipements } from '@/hooks/queries/useReferentiel';

interface ModaleImportCSVProps {
  onClose: () => void;
}

interface LigneCSV {
  code: string;
  libelle: string;
  categorie: string;
  parc: string;
  numero_serie: string;
  date_mise_service: string;
}

interface LigneValidee {
  parc_id: string;
  categorie_id: string;
  code: string;
  libelle: string;
  numero_serie: string | null;
  date_mise_service: string | null;
}

interface LigneErreur {
  ligne: number;
  raison: string;
  raw: LigneCSV;
}

type Etape = 'upload' | 'preview' | 'resultat';

function parseCSV(text: string): LigneCSV[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const separator = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const idxCode = headers.findIndex((h) => h === 'code');
  const idxLibelle = headers.findIndex((h) => h === 'libelle' || h === 'libellé');
  const idxCategorie = headers.findIndex((h) => h === 'categorie' || h === 'catégorie');
  const idxParc = headers.findIndex((h) => h === 'parc');
  const idxSerie = headers.findIndex((h) => h.includes('serie') || h.includes('série') || h === 'numero_serie');
  const idxDate = headers.findIndex((h) => h.includes('mise_service') || h.includes('mise en service') || h === 'date_mise_service');

  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      code: cols[idxCode] ?? '',
      libelle: cols[idxLibelle] ?? '',
      categorie: cols[idxCategorie] ?? '',
      parc: cols[idxParc] ?? '',
      numero_serie: idxSerie >= 0 ? (cols[idxSerie] ?? '') : '',
      date_mise_service: idxDate >= 0 ? (cols[idxDate] ?? '') : '',
    };
  });
}

export function ModaleImportCSV({ onClose }: ModaleImportCSVProps) {
  const { data: parcs } = useParcs();
  const { data: categories } = useCategoriesEquipement();
  const importer = useImporterEquipements();
  const fileRef = useRef<HTMLInputElement>(null);

  const [etape, setEtape] = useState<Etape>('upload');
  const [lignesBrutes, setLignesBrutes] = useState<LigneCSV[]>([]);
  const [nbImportees, setNbImportees] = useState(0);

  const parcMap = useMemo(() => {
    const m = new Map<string, string>();
    parcs?.forEach((p) => { m.set(p.code.toUpperCase(), p.id); m.set(p.nom.toLowerCase(), p.id); });
    return m;
  }, [parcs]);

  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    categories?.forEach((c) => m.set(c.nom.toLowerCase(), c.id));
    return m;
  }, [categories]);

  const { valides, erreurs } = useMemo(() => {
    const valides: LigneValidee[] = [];
    const erreurs: LigneErreur[] = [];

    lignesBrutes.forEach((raw, i) => {
      const parcId = parcMap.get(raw.parc.toUpperCase()) ?? parcMap.get(raw.parc.toLowerCase());
      const catId = catMap.get(raw.categorie.toLowerCase());

      if (!raw.code || !raw.libelle) {
        erreurs.push({ ligne: i + 2, raison: 'Code ou libelle manquant', raw });
        return;
      }
      if (!parcId) {
        erreurs.push({ ligne: i + 2, raison: `Parc inconnu : "${raw.parc}"`, raw });
        return;
      }
      if (!catId) {
        erreurs.push({ ligne: i + 2, raison: `Categorie inconnue : "${raw.categorie}"`, raw });
        return;
      }

      valides.push({
        parc_id: parcId,
        categorie_id: catId,
        code: raw.code,
        libelle: raw.libelle,
        numero_serie: raw.numero_serie || null,
        date_mise_service: raw.date_mise_service || null,
      });
    });

    return { valides, erreurs };
  }, [lignesBrutes, parcMap, catMap]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setLignesBrutes(parseCSV(text));
      setEtape('preview');
    };
    reader.readAsText(file, 'utf-8');
  };

  const lancer = async () => {
    if (valides.length === 0) return;
    const result = await importer.mutateAsync(valides);
    setNbImportees(result?.length ?? valides.length);
    setEtape('resultat');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[640px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Import</div>
            <div className="text-[19px] font-semibold mt-0.5">Importer des equipements</div>
          </div>
          <button onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base">
            x
          </button>
        </div>

        {etape === 'upload' && (
          <EtapeUpload fileRef={fileRef} onFile={handleFile} />
        )}

        {etape === 'preview' && (
          <EtapePreview
            lignesBrutes={lignesBrutes}
            valides={valides}
            erreurs={erreurs}
            onLancer={lancer}
            isPending={importer.isPending}
            onRetour={() => { setEtape('upload'); setLignesBrutes([]); }}
          />
        )}

        {etape === 'resultat' && (
          <EtapeResultat
            nbImportees={nbImportees}
            nbErreurs={erreurs.length}
            erreurs={erreurs}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function EtapeUpload({
  fileRef,
  onFile,
}: {
  fileRef: React.RefObject<HTMLInputElement>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <div className="bg-bg-deep rounded-[10px] p-4 mb-4 border border-white/[0.04]">
        <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Format attendu (CSV)</div>
        <div className="font-mono text-[11px] text-nikito-cyan">
          code;libelle;categorie;parc;numero_serie;date_mise_service
        </div>
        <div className="text-[11px] text-faint mt-1.5">
          Separateur : point-virgule ou virgule. Parc = code (ALF, DOM, FRA, SGB). Categorie = nom exact.
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full bg-bg-deep border-2 border-dashed border-white/[0.12] rounded-xl py-10 text-center hover:border-nikito-cyan/40 transition-colors cursor-pointer"
      >
        <div className="text-dim text-sm mb-1">Cliquez pour selectionner un fichier CSV</div>
        <div className="text-faint text-[11px]">.csv ou .txt</div>
      </button>
    </div>
  );
}

function EtapePreview({
  lignesBrutes,
  valides,
  erreurs,
  onLancer,
  isPending,
  onRetour,
}: {
  lignesBrutes: LigneCSV[];
  valides: LigneValidee[];
  erreurs: LigneErreur[];
  onLancer: () => void;
  isPending: boolean;
  onRetour: () => void;
}) {
  const preview = lignesBrutes.slice(0, 5);

  return (
    <div>
      <div className="text-[13px] text-dim mb-3">
        {lignesBrutes.length} lignes lues — <span className="text-green font-medium">{valides.length} valides</span>
        {erreurs.length > 0 && <>, <span className="text-red font-medium">{erreurs.length} erreurs</span></>}
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-dim text-left py-2 px-2 uppercase tracking-wider">Code</th>
              <th className="text-dim text-left py-2 px-2 uppercase tracking-wider">Libelle</th>
              <th className="text-dim text-left py-2 px-2 uppercase tracking-wider">Categorie</th>
              <th className="text-dim text-left py-2 px-2 uppercase tracking-wider">Parc</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((l, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="py-2 px-2 font-mono text-nikito-cyan">{l.code}</td>
                <td className="py-2 px-2">{l.libelle}</td>
                <td className="py-2 px-2 text-dim">{l.categorie}</td>
                <td className="py-2 px-2 text-dim">{l.parc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lignesBrutes.length > 5 && (
          <div className="text-[11px] text-faint text-center py-2">
            ... et {lignesBrutes.length - 5} autres lignes
          </div>
        )}
      </div>

      {erreurs.length > 0 && (
        <div className="bg-red/5 border border-red/15 rounded-[10px] p-3 mb-4 max-h-[150px] overflow-y-auto">
          <div className="text-[11px] text-red font-semibold mb-1.5">{erreurs.length} erreur(s)</div>
          {erreurs.map((e, i) => (
            <div key={i} className="text-[11px] text-dim py-0.5">
              Ligne {e.ligne} : {e.raison}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
        <button onClick={onRetour}
          className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">
          Retour
        </button>
        <button onClick={onLancer} disabled={valides.length === 0 || isPending}
          className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
            (valides.length === 0 || isPending) && 'opacity-40 cursor-not-allowed')}>
          {isPending ? 'Import en cours...' : `Importer ${valides.length} equipement${valides.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

function EtapeResultat({
  nbImportees,
  nbErreurs,
  erreurs,
  onClose,
}: {
  nbImportees: number;
  nbErreurs: number;
  erreurs: LigneErreur[];
  onClose: () => void;
}) {
  return (
    <div className="text-center py-4">
      <div className="text-green text-4xl mb-3">&#10003;</div>
      <div className="text-lg font-semibold mb-1">{nbImportees} equipement{nbImportees > 1 ? 's' : ''} importe{nbImportees > 1 ? 's' : ''}</div>
      {nbErreurs > 0 && (
        <div className="text-red text-[13px] mb-3">{nbErreurs} ligne{nbErreurs > 1 ? 's' : ''} en erreur (ignoree{nbErreurs > 1 ? 's' : ''})</div>
      )}
      {erreurs.length > 0 && (
        <div className="text-left bg-red/5 border border-red/15 rounded-[10px] p-3 mb-4 max-h-[120px] overflow-y-auto">
          {erreurs.map((e, i) => (
            <div key={i} className="text-[11px] text-dim py-0.5">
              Ligne {e.ligne} : {e.raison}
            </div>
          ))}
        </div>
      )}
      <button onClick={onClose}
        className="bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]">
        Fermer
      </button>
    </div>
  );
}
