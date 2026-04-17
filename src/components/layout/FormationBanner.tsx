import { useFormation } from '@/hooks/useFormation';

export function FormationBanner() {
  const { active, disable } = useFormation();
  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[70] h-10 bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] flex items-center justify-center gap-3 px-4 text-[13px] font-semibold text-white select-none">
      <span className="flex items-center gap-1.5">
        <GraduationIcon />
        MODE FORMATION
        <span className="font-normal opacity-80">
          — Les donnees sont fictives. Vos actions n'affectent pas la production.
        </span>
      </span>
      <button
        onClick={disable}
        className="ml-2 flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-colors"
      >
        Quitter la formation <span>&#10005;</span>
      </button>
    </div>
  );
}

function GraduationIcon() {
  return (
    <svg className="w-4 h-4 inline" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L1 7l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M15 9.5v5c0 1.5-2.5 3-5 3s-5-1.5-5-3v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
