import { cn } from '@/lib/utils';

interface Props {
  score: number;
  tendance: 'stable' | 'amelioration' | 'degradation';
}

function getScoreColor(score: number) {
  if (score >= 80) return { ring: '#4DD09E', text: 'text-green', bg: 'bg-green/10' };
  if (score >= 50) return { ring: '#FFB547', text: 'text-amber', bg: 'bg-amber/10' };
  return { ring: '#FF4D6D', text: 'text-red', bg: 'bg-red/10' };
}

const tendanceInfo = {
  amelioration: { label: 'En amelioration', icon: '\u2197', color: 'text-green' },
  stable: { label: 'Stable', icon: '\u2192', color: 'text-dim' },
  degradation: { label: 'En degradation', icon: '\u2198', color: 'text-red' },
};

export function ScoreSanteGlobal({ score, tendance }: Props) {
  const color = getScoreColor(score);
  const trend = tendanceInfo[tendance];
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-bg-card rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-[140px] h-[140px] flex-shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color.ring}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-[32px] font-bold leading-none', color.text)}>
            {score}
          </span>
          <span className="text-[11px] text-dim mt-1">/100</span>
        </div>
      </div>
      <div className="flex flex-col items-center sm:items-start gap-2">
        <div className="text-[11px] text-faint uppercase tracking-[1.5px]">
          Score de sante global
        </div>
        <div className="text-lg font-semibold">
          Sante de votre parc : <span className={color.text}>{score}/100</span>
        </div>
        <div className={cn('flex items-center gap-1.5 text-sm', trend.color)}>
          <span className="text-lg">{trend.icon}</span>
          <span>{trend.label}</span>
        </div>
      </div>
    </div>
  );
}
