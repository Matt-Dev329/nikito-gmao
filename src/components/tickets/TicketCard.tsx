import { CritTag } from '@/components/ui/CritTag';
import { cn } from '@/lib/utils';
import type { Criticite } from '@/types/database';

export interface TicketSummary {
  id: string;
  numeroBT: string;
  criticite: Criticite;
  titre: string;
  zone?: string;
  /** Activité (Trampoline, Bowling, Casiers…) déduite de la catégorie d'équipement */
  activite?: string;
  description?: string;
  badges?: Array<{ label: string; tone?: 'default' | 'pink' | 'amber' }>;
  meta?: string;
  slaAlert?: string;
  enAttente?: boolean;
  enPause?: boolean;
  /** Photo du problème (chemin dans alba-incidents) et son URL signée */
  photoPath?: string;
  photoUrl?: string;
  /** Le média du signalement est une vidéo */
  photoVideo?: boolean;
  /** Parc du ticket (droits de validation / suppression) */
  parcId?: string;
}

interface TicketCardProps {
  ticket: TicketSummary;
  variant: 'expanded' | 'compact';
  onDemarrer?: () => void;
  onReassigner?: () => void;
  onReprendre?: () => void;
  reprenant?: boolean;
  onClick?: () => void;
  /** Suppression avec motif (directeur, manager principal, chef d'équipe…) */
  onSupprimer?: () => void;
  /** Clôture rapide avec justification (chef d'équipe, directeurs de parc) */
  onCloturer?: () => void;
}

const borderByCrit: Record<Criticite, string> = {
  bloquant: 'border-l-4 border-l-red',
  majeur: 'border-l-4 border-l-amber',
  mineur: 'border-l-4 border-l-nikito-cyan',
};

const badgeToneClass = {
  default: 'text-dim',
  pink: 'text-nikito-pink',
  amber: 'text-amber',
};

export function TicketCard({ ticket, variant, onDemarrer, onReassigner, onReprendre, reprenant, onClick, onSupprimer, onCloturer }: TicketCardProps) {
  if (variant === 'compact') {
    const carte = (
      <button
        onClick={onClick}
        className={cn(
          'bg-bg-card rounded-xl p-[13px] px-4 flex items-center gap-3 cursor-pointer w-full text-left',
          borderByCrit[ticket.criticite],
          ticket.enAttente && 'opacity-75'
        )}
      >
        <CritTag niveau={ticket.criticite} minWidth />
        {ticket.photoVideo ? (
          <span className="w-11 h-11 rounded-lg bg-bg-deep flex-shrink-0 flex items-center justify-center text-lg">🎥</span>
        ) : ticket.photoUrl ? (
          <img
            src={ticket.photoUrl}
            alt=""
            loading="lazy"
            className="w-11 h-11 rounded-lg object-cover bg-bg-deep flex-shrink-0"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium flex items-center gap-1.5">
            {ticket.titre}
            {ticket.badges?.map((b) => (
              <span
                key={b.label}
                className={cn(
                  'bg-bg-deep px-[7px] py-px rounded text-[10px]',
                  badgeToneClass[b.tone ?? 'default']
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
          {ticket.meta && <div className="text-[11px] text-dim">{ticket.meta}</div>}
        </div>
        <span className="text-nikito-cyan text-lg">›</span>
      </button>
    );
    if (!onSupprimer && !onCloturer) return carte;
    return (
      <div className="flex items-stretch gap-1.5">
        <div className="flex-1 min-w-0">{carte}</div>
        {onCloturer && (
          <button
            onClick={onCloturer}
            title="Clôturer le ticket (justification obligatoire)"
            aria-label="Clôturer le ticket"
            className="bg-bg-card rounded-xl px-3 text-green border border-green/30 flex-shrink-0 min-w-[44px] text-[16px] font-bold"
          >
            ✓
          </button>
        )}
        {onSupprimer && (
          <button
            onClick={onSupprimer}
            title="Supprimer le ticket"
            aria-label="Supprimer le ticket"
            className="bg-bg-card rounded-xl px-3 text-red border border-red/30 flex-shrink-0 min-w-[44px]"
          >
            🗑
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn('bg-bg-card rounded-2xl p-4 flex flex-col gap-3', onClick && 'cursor-pointer', borderByCrit[ticket.criticite])}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <CritTag niveau={ticket.criticite} />
        <span className="bt-num">{ticket.numeroBT}</span>
        {ticket.zone && <span className="bt-num">Zone {ticket.zone}</span>}
        {ticket.slaAlert && (
          <span className="ml-auto text-amber text-[11px] font-medium">⚠ {ticket.slaAlert}</span>
        )}
      </div>
      <div>
        <div className="text-[17px] font-semibold mb-1">{ticket.titre}</div>
        {ticket.description && <div className="text-[13px] text-dim leading-relaxed">{ticket.description}</div>}
      </div>
      {ticket.photoUrl && ticket.photoVideo ? (
        <video
          src={ticket.photoUrl}
          controls
          playsInline
          preload="metadata"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-h-[220px] rounded-xl bg-black"
        />
      ) : ticket.photoUrl ? (
        <img
          src={ticket.photoUrl}
          alt="Photo du problème"
          loading="lazy"
          className="w-full max-h-[200px] rounded-xl object-cover bg-bg-deep"
        />
      ) : null}
      {ticket.badges && ticket.badges.length > 0 && (
        <div className="flex gap-2 flex-wrap text-[11px]">
          {ticket.badges.map((b) => (
            <span key={b.label} className={cn('bg-bg-deep px-2.5 py-1 rounded', badgeToneClass[b.tone ?? 'default'])}>
              {b.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2.5">
        {ticket.enPause && onReprendre ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReprendre();
            }}
            disabled={reprenant}
            className="flex-1 bg-gradient-action text-bg-app py-3.5 rounded-[10px] text-sm font-bold disabled:opacity-50"
          >
            ▶ Reprendre
          </button>
        ) : onDemarrer ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDemarrer();
            }}
            className="flex-1 bg-gradient-action text-bg-app py-3.5 rounded-[10px] text-sm font-bold"
          >
            📷 Photo AVANT puis démarrer
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="flex-1 bg-bg-deep border border-white/10 text-text py-3.5 rounded-[10px] text-sm"
          >
            Voir le suivi
          </button>
        )}
        {onReassigner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReassigner();
            }}
            className="bg-bg-deep border border-white/10 text-text py-3.5 px-4 rounded-[10px] text-[13px] min-w-[90px]"
          >
            Réassigner
          </button>
        )}
        {onCloturer && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloturer();
            }}
            className="bg-bg-deep border border-green/40 text-green py-3.5 px-4 rounded-[10px] text-[13px] min-w-[90px]"
          >
            ✓ Clôturer
          </button>
        )}
        {onSupprimer && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSupprimer();
            }}
            className="bg-bg-deep border border-red/40 text-red py-3.5 px-4 rounded-[10px] text-[13px] min-w-[90px]"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
