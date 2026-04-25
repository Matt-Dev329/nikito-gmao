import { useSignaler } from '@/lib/signaler';
import { useIsMobile } from '@/hooks/useIsMobile';

export function SignalerInlineButton() {
  const { openSignaler, variant, visible } = useSignaler();
  const isMobile = useIsMobile();

  if (isMobile || !visible) return null;

  if (variant === 'icon-only') {
    return (
      <button
        onClick={openSignaler}
        title="Signaler un incident (Ctrl+I)"
        className="w-11 h-11 rounded-xl border border-white/[0.08] bg-[#131836] text-dim hover:text-white hover:border-white/20 transition-all flex items-center justify-center flex-shrink-0"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L2 17h16L10 2z" />
          <path d="M10 7v4" />
          <circle cx="10" cy="13.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={openSignaler}
      className="h-11 px-5 rounded-xl text-white text-[13px] font-semibold flex items-center gap-2 active:scale-[0.97] transition-transform flex-shrink-0"
      style={{
        background: 'linear-gradient(135deg, #ec4899 0%, #06b6d4 100%)',
        boxShadow: '0 4px 16px rgba(236, 72, 153, 0.2)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      Signaler
    </button>
  );
}
