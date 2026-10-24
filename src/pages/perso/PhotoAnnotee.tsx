import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';
import { COULEURS, echelle, formes, type Annotation, type CouleurAnnotation, type PhotoNote, type TypeAnnotation } from './annotations';

/** Tracé SVG des annotations, posé exactement sur la photo */
function Calque({
  photo,
  annotations,
  selection,
  onSelection,
}: {
  photo: PhotoNote;
  annotations: Annotation[];
  selection?: string | null;
  onSelection?: (id: string) => void;
}) {
  const { largeur, hauteur } = photo;
  const { trait, police } = echelle(largeur, hauteur);
  return (
    <>
      {annotations.map((a) => {
        const { segments, etiquette } = formes(a, largeur, hauteur);
        const c = COULEURS[a.couleur];
        const choisie = selection === a.id;
        const largeurEtiquette = etiquette ? etiquette.texte.length * police * 0.6 + police * 0.8 : 0;
        return (
          <g
            key={a.id}
            onPointerDown={onSelection ? (e) => (e.stopPropagation(), onSelection(a.id)) : undefined}
            className={onSelection ? 'cursor-pointer' : undefined}
          >
            {segments.map(([x1, y1, x2, y2], i) => (
              <g key={i}>
                {/* Zone de clic élargie + liseré sombre pour la lisibilité */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={trait * (onSelection ? 8 : 2.2)} strokeLinecap="round" className="stroke-bg-app/70" />
                <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={trait * (choisie ? 1.8 : 1)} strokeLinecap="round" className={c.trait} />
              </g>
            ))}
            {etiquette && (
              <g>
                <rect
                  x={etiquette.x - largeurEtiquette / 2}
                  y={etiquette.y - police * 0.75}
                  width={largeurEtiquette}
                  height={police * 1.5}
                  rx={police * 0.3}
                  className={cn('fill-bg-app/85', choisie && c.trait)}
                  strokeWidth={choisie ? trait : 0}
                />
                <text
                  x={etiquette.x}
                  y={etiquette.y}
                  fontSize={police}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={c.texte}
                >
                  {etiquette.texte}
                </text>
              </g>
            )}
            {a.type === 'texte' && !etiquette && (
              <circle cx={a.x1 * largeur} cy={a.y1 * hauteur} r={trait * 3} className={cn('fill-bg-app/70', c.trait)} strokeWidth={trait} />
            )}
          </g>
        );
      })}
    </>
  );
}

/** Photo avec ses annotations (lecture seule) */
export function PhotoAvecAnnotations({ url, photo, classeImage }: { url?: string; photo: PhotoNote; classeImage?: string }) {
  return (
    <div className="relative inline-block max-w-full">
      {url ? (
        <img src={url} alt={photo.legende ?? ''} className={cn('block max-w-full rounded-lg', classeImage)} draggable={false} />
      ) : (
        <div className="bg-bg-deep rounded-lg animate-pulse" style={{ aspectRatio: `${photo.largeur} / ${photo.hauteur}`, width: 240 }} />
      )}
      {url && (
        <svg viewBox={`0 0 ${photo.largeur} ${photo.hauteur}`} className="absolute inset-0 w-full h-full pointer-events-none" fill="none">
          <Calque photo={photo} annotations={photo.annotations} />
        </svg>
      )}
    </div>
  );
}

const OUTILS: { type: TypeAnnotation; label: string; aide: string }[] = [
  { type: 'cote', label: '↔ Cote', aide: 'Glisse d’un point à l’autre, puis écris la mesure' },
  { type: 'fleche', label: '↗ Flèche', aide: 'Glisse du texte vers ce que tu montres' },
  { type: 'texte', label: 'T Texte', aide: 'Touche l’endroit où écrire' },
];
const PALETTE: CouleurAnnotation[] = ['lime', 'amber', 'red', 'cyan', 'blanc'];
const SUGGESTIONS = ['cm', 'mm', 'm'];

const nouvelId = () => Math.random().toString(36).slice(2, 10);

/** Éditeur plein écran : tracer des cotes, flèches et textes sur la photo */
export function AnnotateurPhoto({
  url,
  photo,
  onEnregistrer,
  onFermer,
}: {
  url: string;
  photo: PhotoNote;
  onEnregistrer: (annotations: Annotation[], legende: string) => void;
  onFermer: () => void;
}) {
  const [annotations, setAnnotations] = useState<Annotation[]>(photo.annotations);
  const [legende, setLegende] = useState(photo.legende ?? '');
  const [outil, setOutil] = useState<TypeAnnotation>('cote');
  const [couleur, setCouleur] = useState<CouleurAnnotation>('lime');
  const [enCours, setEnCours] = useState<Annotation | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const champRef = useRef<HTMLInputElement>(null);

  const choisie = annotations.find((a) => a.id === selection) ?? null;

  const point = (e: ReactPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const selectionner = (id: string | null) => {
    setSelection(id);
    if (id) setTimeout(() => champRef.current?.focus(), 50);
  };

  const debut = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = point(e);
    if (outil === 'texte') {
      const a: Annotation = { id: nouvelId(), type: 'texte', x1: p.x, y1: p.y, texte: '', couleur };
      setAnnotations((l) => [...l, a]);
      selectionner(a.id);
      return;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelection(null);
    setEnCours({ id: nouvelId(), type: outil, x1: p.x, y1: p.y, x2: p.x, y2: p.y, texte: '', couleur });
  };

  const deplacement = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!enCours) return;
    const p = point(e);
    setEnCours({ ...enCours, x2: p.x, y2: p.y });
  };

  const fin = () => {
    if (!enCours) return;
    const longueur = Math.hypot(((enCours.x2 ?? 0) - enCours.x1) * photo.largeur, ((enCours.y2 ?? 0) - enCours.y1) * photo.hauteur);
    setEnCours(null);
    // Trait trop court : simple toucher, on ignore
    if (longueur < Math.max(photo.largeur, photo.hauteur) / 50) return;
    setAnnotations((l) => [...l, enCours]);
    selectionner(enCours.id);
  };

  const majTexte = (texte: string) =>
    setAnnotations((l) => l.map((a) => (a.id === selection ? { ...a, texte } : a)));
  const majCouleur = (c: CouleurAnnotation) => {
    setCouleur(c);
    if (selection) setAnnotations((l) => l.map((a) => (a.id === selection ? { ...a, couleur: c } : a)));
  };
  const retirer = () => {
    setAnnotations((l) => l.filter((a) => a.id !== selection));
    setSelection(null);
  };
  // Texte vide : l'annotation « texte » n'a pas de sens, on la retire en quittant
  const nettoyer = (l: Annotation[]) => l.filter((a) => a.type !== 'texte' || a.texte.trim());

  return (
    <div className="fixed inset-0 z-[200] bg-bg-app flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06]">
        <button onClick={onFermer} className="text-dim text-[13px] px-2 min-h-[44px]">
          Annuler
        </button>
        <div className="text-[14px] font-semibold">Annoter la photo</div>
        <button
          onClick={() => onEnregistrer(nettoyer(annotations), legende.trim())}
          className="bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[40px]"
        >
          Terminer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-white/[0.06]">
        {OUTILS.map((o) => (
          <button
            key={o.type}
            onClick={() => (setOutil(o.type), setSelection(null))}
            className={cn(
              'px-3 rounded-lg text-[13px] font-semibold min-h-[40px] border',
              outil === o.type ? 'bg-nikito-cyan/15 border-nikito-cyan/50 text-nikito-cyan' : 'border-white/10 text-dim'
            )}
          >
            {o.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          {PALETTE.map((c) => (
            <button
              key={c}
              aria-label={`Couleur ${c}`}
              onClick={() => majCouleur(c)}
              className={cn('w-7 h-7 rounded-full border-2', COULEURS[c].pastille, (choisie?.couleur ?? couleur) === c ? 'border-text' : 'border-transparent')}
            />
          ))}
          <button
            onClick={() => (setAnnotations((l) => l.slice(0, -1)), setSelection(null))}
            disabled={annotations.length === 0}
            className="ml-1 text-dim text-[13px] px-2 min-h-[40px] disabled:opacity-30"
            aria-label="Annuler la dernière annotation"
          >
            ↶
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden">
        <div className="relative inline-block max-w-full max-h-full">
          <img src={url} alt="" className="block max-w-full max-h-[calc(100vh-260px)] select-none" draggable={false} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${photo.largeur} ${photo.hauteur}`}
            className="absolute inset-0 w-full h-full touch-none"
            fill="none"
            onPointerDown={debut}
            onPointerMove={deplacement}
            onPointerUp={fin}
            onPointerCancel={() => setEnCours(null)}
          >
            <Calque
              photo={photo}
              annotations={enCours ? [...annotations, enCours] : annotations}
              selection={selection}
              onSelection={selectionner}
            />
          </svg>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-white/[0.06] grid gap-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        {choisie ? (
          <>
            <div className="flex gap-2">
              <input
                ref={champRef}
                value={choisie.texte}
                onChange={(e) => majTexte(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSelection(null)}
                maxLength={40}
                placeholder={choisie.type === 'cote' ? 'Mesure (ex. 1,20 m)' : 'Texte'}
                className="flex-1 bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 text-text text-[15px] outline-none focus:border-nikito-cyan min-h-[44px]"
              />
              <button onClick={() => setSelection(null)} className="bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px]">
                OK
              </button>
              <button onClick={retirer} className="text-red text-[13px] px-2 min-h-[44px]">
                Retirer
              </button>
            </div>
            {choisie.type === 'cote' && /^\s*\d+([.,]\d+)?\s*$/.test(choisie.texte) && (
              <div className="flex gap-1.5">
                {SUGGESTIONS.map((u) => (
                  <button
                    key={u}
                    onClick={() => majTexte(`${choisie.texte.trim()} ${u}`)}
                    className="px-3 rounded-lg text-[12px] border border-white/10 text-dim min-h-[36px]"
                  >
                    {choisie.texte.trim()} {u}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[12px] text-dim">{OUTILS.find((o) => o.type === outil)?.aide} · touche une annotation pour la modifier</div>
            <input
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              maxLength={200}
              placeholder="Légende de la photo (facultatif)"
              className="bg-bg-deep border border-white/[0.08] rounded-[10px] px-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
            />
          </>
        )}
      </div>
    </div>
  );
}
