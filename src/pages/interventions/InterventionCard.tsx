import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatHeure } from '@/lib/utils';
import { useChrono } from '@/hooks/useChrono';
import { PhotoThumb, PhotoLightbox } from '@/components/shared/PhotoLightbox';
import type { InterventionSuivi } from '@/hooks/queries/useInterventionsSuivi';
import { sourceLabel } from '@/hooks/queries/useInterventionsSuivi';

const statutConfig: Record<string, { label: string; bg: string; text: string }> = {
  en_cours: { label: 'EN COURS', bg: 'bg-red/15', text: 'text-red' },
  ouvert: { label: 'EN ATTENTE', bg: 'bg-amber/15', text: 'text-amber' },
  assigne: { label: 'EN ATTENTE', bg: 'bg-amber/15', text: 'text-amber' },
  resolu: { label: 'TERMINE', bg: 'bg-green/15', text: 'text-green' },
  ferme: { label: 'TERMINE', bg: 'bg-green/15', text: 'text-green' },
  annule: { label: 'ANNULE', bg: 'bg-dim/15', text: 'text-dim' },
};

const critConfig: Record<string, { bg: string; label: string }> = {
  p1: { bg: 'bg-red', label: 'BLOQUANT' },
  p2: { bg: 'bg-amber', label: 'HAUTE' },
  p3: { bg: 'bg-nikito-cyan', label: 'NORMALE' },
};

function getCritFromPrioCode(code: string): { bg: string; label: string } {
  if (code === 'p1') return critConfig.p1;
  if (code === 'p2') return critConfig.p2;
  return critConfig.p3;
}

function ChronoLive({ debutISO }: { debutISO: string }) {
  const secs = useChrono(debutISO);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const display = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return (
    <span className="font-mono text-red text-[13px] font-semibold tabular-nums">
      {display}
    </span>
  );
}

function dureeResolue(declare: string, resolu: string): string {
  const diffMin = Math.round((new Date(resolu).getTime() - new Date(declare).getTime()) / 60_000);
  if (diffMin < 60) return `Resolu en ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return `Resolu en ${h}h${m > 0 ? ` ${m}min` : ''}`;
}

interface Props {
  intervention: InterventionSuivi;
}

export function InterventionCard({ intervention: i }: Props) {
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const sc = statutConfig[i.statut] ?? statutConfig.annule;
  const crit = getCritFromPrioCode(i.priorite_code);

  const allPhotos: string[] = [
    ...(i.photos_urls ?? []),
    ...(i.photos_avant ?? []),
    ...(i.photos_apres ?? []),
  ].filter(Boolean);

  const techInitiales = i.technicien_prenom && i.technicien_nom
    ? `${i.technicien_prenom[0]}${i.technicien_nom[0]}`.toUpperCase()
    : null;

  const techFullName = i.technicien_prenom && i.technicien_nom
    ? `${i.technicien_prenom} ${i.technicien_nom}`
    : null;

  return (
    <>
      <div className="bg-bg-card rounded-2xl p-4 border-l-4 transition-colors"
        style={{ borderLeftColor: i.priorite_couleur }}>
        <div className="flex items-center gap-2 flex-wrap mb-2.5">
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold tracking-wide', sc.bg, sc.text)}>
            {sc.label}
          </span>
          <span className="text-[11px] text-dim font-mono">{i.numero_bt}</span>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold text-bg-app', crit.bg)}>
            {crit.label}
          </span>
          {i.zone_nom && (
            <span className="text-[10px] text-dim bg-bg-deep px-2 py-0.5 rounded">
              {i.zone_nom}
            </span>
          )}
          {i.statut === 'en_cours' && i.intervention_debut && (
            <div className="ml-auto flex items-center gap-1">
              <ChronoLive debutISO={i.intervention_debut} />
            </div>
          )}
          {(i.statut === 'resolu' || i.statut === 'ferme') && i.resolu_le && (
            <span className="ml-auto text-[11px] text-green font-medium">
              {dureeResolue(i.declare_le, i.resolu_le)}
            </span>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold mb-0.5">
              {i.equipement_libelle}
              <span className="text-dim font-normal text-[12px] ml-1.5">{i.equipement_code}</span>
            </div>
            <div className="text-[12px] text-dim leading-relaxed line-clamp-2">
              {i.titre}{i.description ? ` — ${i.description}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap text-[11px] text-dim">
          {techFullName && (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-nikito-cyan/20 text-nikito-cyan flex items-center justify-center text-[8px] font-bold">
                {techInitiales}
              </div>
              <span>{techFullName}</span>
            </div>
          )}
          <span>{formatHeure(i.declare_le)}</span>
          {i.intervention_fin && (
            <span>→ {formatHeure(i.intervention_fin)}</span>
          )}
          <span className="bg-bg-deep px-1.5 py-0.5 rounded">{sourceLabel(i.source)}</span>
        </div>

        {allPhotos.length > 0 && (
          <div className="flex gap-2 mt-3">
            {allPhotos.slice(0, 4).map((url, idx) => (
              <PhotoThumb
                key={url}
                url={url}
                size="sm"
                onClick={() => setLightbox({ photos: allPhotos, idx })}
              />
            ))}
            {allPhotos.length > 4 && (
              <button
                onClick={() => setLightbox({ photos: allPhotos, idx: 4 })}
                className="w-12 h-12 rounded-lg bg-bg-deep flex items-center justify-center text-dim text-[11px] font-medium"
              >
                +{allPhotos.length - 4}
              </button>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
