import { useViewAs } from '@/hooks/useViewAs';
import { roleLabels } from '@/lib/tokens';

const roleLabelsUpper: Record<string, string> = {
  direction: 'DIRECTION',
  chef_maintenance: "CHEF D'EQUIPE",
  manager_parc: 'MANAGER PARC',
  technicien: 'TECHNICIEN',
  staff_operationnel: 'STAFF OPERATIONNEL',
};

export function ViewAsBanner() {
  const { role, parcLabel, userLabel, reset } = useViewAs();
  if (!role) return null;

  const label = roleLabelsUpper[role] ?? roleLabels[role] ?? role;
  const details = [userLabel, parcLabel].filter(Boolean).join(' - ');

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-9 bg-gradient-to-r from-amber/90 to-amber/70 flex items-center justify-center gap-3 px-4 text-[13px] font-semibold text-bg-app select-none">
      <span className="flex items-center gap-1.5">
        <EyeIcon />
        Vue simulee : {label}
        {details && <span className="font-normal opacity-80"> — {details}</span>}
      </span>
      <button
        onClick={reset}
        className="ml-2 flex items-center gap-1 bg-black/15 hover:bg-black/25 rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-colors"
      >
        <span>&#10005;</span> Revenir a ma vue
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4 inline" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 4.5C5.5 4.5 2 10 2 10s3.5 5.5 8 5.5 8-5.5 8-5.5-3.5-5.5-8-5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
