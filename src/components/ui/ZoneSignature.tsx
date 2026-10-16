import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Zone de signature au doigt / stylet / souris. Renvoie l'image PNG
 * (fond blanc, trait noir) via `onChange`, ou null si effacée.
 */
export function ZoneSignature({
  libelle,
  onChange,
  className,
}: {
  libelle: string;
  onChange: (png: Blob | null) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(false);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const [signe, setSigne] = useState(false);

  // Taille réelle du canvas = taille affichée × densité de l'écran
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111111';
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const exporter = () => {
    canvasRef.current?.toBlob((b) => onChange(b), 'image/png');
  };

  const effacer = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const { width, height } = c.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    setSigne(false);
    onChange(null);
  };

  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-dim">{libelle}</span>
        {signe && (
          <button type="button" onClick={effacer} className="text-[12px] text-red min-h-[32px] px-1">
            Effacer
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className={cn('w-full h-36 rounded-[10px] bg-white touch-none border-2', signe ? 'border-green' : 'border-white/[0.08]')}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dessin.current = true;
          dernier.current = point(e);
        }}
        onPointerMove={(e) => {
          if (!dessin.current || !dernier.current) return;
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx) return;
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(dernier.current.x, dernier.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          dernier.current = p;
          if (!signe) setSigne(true);
        }}
        onPointerUp={() => {
          if (!dessin.current) return;
          dessin.current = false;
          dernier.current = null;
          exporter();
        }}
        onPointerCancel={() => {
          dessin.current = false;
          dernier.current = null;
        }}
      />
      {!signe && <span className="text-[11px] text-faint">Signer dans le cadre blanc avec le doigt</span>}
    </div>
  );
}
