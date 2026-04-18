import { cn } from '@/lib/utils';
import type { HypotheseIA } from '@/hooks/queries/useNotificationsIA';

interface Props {
  hypothese: HypotheseIA;
  onValider: (h: HypotheseIA) => void;
  onEvaluer: (h: HypotheseIA) => void;
}

const typeConfig: Record<string, { icon: (p: { className?: string }) => JSX.Element; label: string; border: string }> = {
  equipement_risque: {
    icon: GearIcon,
    label: 'Equipement a risque',
    border: 'border-l-red',
  },
  alerte: {
    icon: AlertIcon,
    label: 'Alerte',
    border: 'border-l-amber',
  },
  recommandation: {
    icon: LightIcon,
    label: 'Recommandation',
    border: 'border-l-nikito-cyan',
  },
};

const prioriteConfig: Record<string, { label: string; color: string; bg: string }> = {
  haute: { label: 'HAUTE', color: 'text-red', bg: 'bg-red/10' },
  moyenne: { label: 'MOYENNE', color: 'text-amber', bg: 'bg-amber/10' },
  basse: { label: 'BASSE', color: 'text-nikito-cyan', bg: 'bg-nikito-cyan/10' },
};

const statutConfig: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: 'text-amber', bg: 'bg-amber/10' },
  validee: { label: 'Validee', color: 'text-green', bg: 'bg-green/10' },
  rejetee: { label: 'Rejetee', color: 'text-red', bg: 'bg-red/10' },
};

const resultatConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  bon_choix: { label: 'Bonne decision', color: 'text-green', bg: 'bg-green/10', icon: 'V' },
  mauvais_choix: { label: 'Mauvaise decision', color: 'text-red', bg: 'bg-red/10', icon: 'X' },
  non_evalue: { label: 'A evaluer', color: 'text-faint', bg: 'bg-white/[0.03]', icon: '?' },
};

export function CarteHypothese({ hypothese, onValider, onEvaluer }: Props) {
  const tc = typeConfig[hypothese.type] ?? typeConfig.alerte;
  const p = prioriteConfig[hypothese.priorite] ?? prioriteConfig.moyenne;
  const s = statutConfig[hypothese.statut] ?? statutConfig.en_attente;
  const Icon = tc.icon;
  const donnees = hypothese.donnees as Record<string, unknown>;
  const isTraitee = hypothese.statut !== 'en_attente';
  const resultat = resultatConfig[hypothese.resultat_reel] ?? resultatConfig.non_evalue;

  const handleClick = () => {
    if (hypothese.statut === 'en_attente') {
      onValider(hypothese);
    } else if (hypothese.resultat_reel === 'non_evalue') {
      onEvaluer(hypothese);
    }
  };

  const isClickable = hypothese.statut === 'en_attente' || (isTraitee && hypothese.resultat_reel === 'non_evalue');

  return (
    <div
      className={cn(
        'bg-bg-card border border-white/[0.06] rounded-xl p-4 border-l-[3px] transition-all hover:border-white/[0.12]',
        tc.border,
        isClickable && 'hover:shadow-lg cursor-pointer'
      )}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-dim" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate">{hypothese.titre}</div>
            <div className="text-[10px] text-dim uppercase tracking-wider">{tc.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', p.color, p.bg)}>
            {p.label}
          </span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', s.color, s.bg)}>
            {s.label}
          </span>
          {isTraitee && (
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1', resultat.color, resultat.bg)}>
              <span className="text-[9px]">{resultat.icon}</span>
              {resultat.label}
            </span>
          )}
        </div>
      </div>

      {hypothese.description && (
        <div className="text-[12px] text-dim leading-relaxed line-clamp-2 mb-2 ml-[42px]">
          {hypothese.description}
        </div>
      )}

      <div className="flex items-center gap-3 ml-[42px] flex-wrap">
        {hypothese.type === 'equipement_risque' && !!donnees.parc && (
          <span className="text-[11px] text-dim">
            {String(donnees.parc)}
          </span>
        )}
        {hypothese.type === 'equipement_risque' && donnees.score_risque != null && (
          <span className={cn(
            'text-[11px] font-medium',
            Number(donnees.score_risque) >= 70 ? 'text-red' :
            Number(donnees.score_risque) >= 50 ? 'text-amber' : 'text-dim'
          )}>
            Risque {String(donnees.score_risque)}%
          </span>
        )}
        {hypothese.rapport && (
          <span className="text-[11px] text-faint">
            Semaine {hypothese.rapport.semaine_iso}
          </span>
        )}
        {isTraitee && hypothese.validee_le && (
          <span className="text-[11px] text-faint">
            {new Date(hypothese.validee_le).toLocaleDateString('fr-FR')}
          </span>
        )}
        {hypothese.valideur && (
          <span className="text-[11px] text-faint">
            par {hypothese.valideur.prenom} {hypothese.valideur.nom}
          </span>
        )}
        {hypothese.statut === 'en_attente' && (
          <span className="text-[11px] text-nikito-cyan ml-auto">
            Cliquer pour valider
          </span>
        )}
        {isTraitee && hypothese.resultat_reel === 'non_evalue' && (
          <span className="text-[11px] text-amber ml-auto">
            Evaluer le resultat
          </span>
        )}
      </div>

      {(hypothese.commentaire_validation || hypothese.resultat_commentaire) && (
        <div className="mt-2.5 ml-[42px] space-y-2">
          {hypothese.commentaire_validation && (
            <div className="bg-bg-deep rounded-lg p-2.5">
              <div className="text-[10px] text-dim uppercase tracking-wider mb-0.5">Commentaire decision</div>
              <div className="text-[12px] text-text/80">{hypothese.commentaire_validation}</div>
            </div>
          )}
          {hypothese.resultat_commentaire && (
            <div className={cn('rounded-lg p-2.5', hypothese.resultat_reel === 'bon_choix' ? 'bg-green/5' : 'bg-red/5')}>
              <div className="text-[10px] text-dim uppercase tracking-wider mb-0.5">
                Retour d'experience
                {hypothese.evaluateur && (
                  <span className="normal-case ml-1">
                    - {hypothese.evaluateur.prenom} {hypothese.evaluateur.nom}
                    {hypothese.resultat_evalue_le && ` le ${new Date(hypothese.resultat_evalue_le).toLocaleDateString('fr-FR')}`}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-text/80">{hypothese.resultat_commentaire}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.1 3.1l1 1M11.9 11.9l1 1M3.1 12.9l1-1M11.9 4.1l1-1" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L1 14h14L8 1.5z" />
      <path d="M8 6v3.5M8 12h.01" />
    </svg>
  );
}

function LightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14h4M6.5 11.5c-1.5-1-2.5-2.5-2.5-4.5a4 4 0 1 1 8 0c0 2-1 3.5-2.5 4.5" />
      <path d="M6.5 11.5h3" />
    </svg>
  );
}
