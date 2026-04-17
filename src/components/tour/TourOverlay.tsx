import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTour } from './useTour';
import { tourSteps } from './tourSteps';
import type { TourStep } from './tourSteps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function resolvePosition(
  elRect: Rect,
  preferred: TourStep['position'],
  tooltipH: number
): TourStep['position'] {
  if (preferred !== 'right') return preferred;
  const spaceBelow = window.innerHeight - (elRect.top + elRect.height / 2 + tooltipH / 2);
  const spaceAbove = elRect.top + elRect.height / 2 - tooltipH / 2;
  if (spaceBelow < 12 && spaceAbove < 12) return 'right';
  if (spaceBelow < 12) return 'right';
  return 'right';
}

function getTooltipStyle(
  elRect: Rect,
  position: TourStep['position'],
  tooltipW: number,
  tooltipH: number
) {
  const gap = 14;
  const style: React.CSSProperties = { position: 'fixed' };

  switch (position) {
    case 'right':
      style.top = elRect.top + elRect.height / 2 - tooltipH / 2;
      style.left = elRect.left + elRect.width + gap;
      break;
    case 'left':
      style.top = elRect.top + elRect.height / 2 - tooltipH / 2;
      style.left = elRect.left - tooltipW - gap;
      break;
    case 'bottom':
      style.top = elRect.top + elRect.height + gap;
      style.left = elRect.left + elRect.width / 2 - tooltipW / 2;
      break;
    case 'top':
      style.top = elRect.top - tooltipH - gap;
      style.left = elRect.left + elRect.width / 2 - tooltipW / 2;
      break;
  }

  const numTop = style.top as number;
  const numLeft = style.left as number;
  if (numTop < 8) style.top = 8;
  if (numTop + tooltipH > window.innerHeight - 8) style.top = window.innerHeight - tooltipH - 8;
  if (numLeft < 8) style.left = 8;
  if (numLeft + tooltipW > window.innerWidth - 8) style.left = window.innerWidth - tooltipW - 8;

  return style;
}

function getArrowPosition(position: TourStep['position']) {
  switch (position) {
    case 'right':
      return 'left' as const;
    case 'left':
      return 'right' as const;
    case 'bottom':
      return 'top' as const;
    case 'top':
      return 'bottom' as const;
  }
}

function ArrowSvg({ direction }: { direction: 'left' | 'right' | 'top' | 'bottom' }) {
  const cls = 'absolute w-3 h-3 text-[#1a1a4e]';
  switch (direction) {
    case 'left':
      return (
        <svg className={`${cls} -left-[11px] top-1/2 -translate-y-1/2`} viewBox="0 0 8 12" fill="currentColor">
          <path d="M8 0L0 6l8 6V0z" />
        </svg>
      );
    case 'right':
      return (
        <svg className={`${cls} -right-[11px] top-1/2 -translate-y-1/2`} viewBox="0 0 8 12" fill="currentColor">
          <path d="M0 0l8 6-8 6V0z" />
        </svg>
      );
    case 'top':
      return (
        <svg className={`${cls} left-1/2 -translate-x-1/2 -top-[11px]`} viewBox="0 0 8 6" fill="currentColor">
          <path d="M0 6L4 0l4 6H0z" />
        </svg>
      );
    case 'bottom':
      return (
        <svg className={`${cls} left-1/2 -translate-x-1/2 -bottom-[11px]`} viewBox="0 0 8 6" fill="currentColor">
          <path d="M0 0l4 6 4-6H0z" />
        </svg>
      );
  }
}

export function TourOverlay() {
  const { active, stepIndex, next, skip, setStepCount } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 320, h: 200 });

  const visibleSteps = useMemo(() => {
    if (!active) return [];
    return tourSteps.filter((s) => document.querySelector(s.selector));
  }, [active]);

  useEffect(() => {
    if (visibleSteps.length > 0) {
      setStepCount(visibleSteps.length);
    }
  }, [visibleSteps.length, setStepCount]);

  const currentStep = visibleSteps[stepIndex] as TourStep | undefined;

  const measure = useCallback(() => {
    if (!active || !currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    });
  }, [active, currentStep]);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setVisible(false);
    measure();
    const id = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(id);
  }, [active, stepIndex, measure]);

  useEffect(() => {
    if (!active) return;
    const handler = () => measure();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [active, measure]);

  useEffect(() => {
    if (!tooltipRef.current) return;
    const r = tooltipRef.current.getBoundingClientRect();
    setTooltipSize({ w: r.width, h: r.height });
  }, [active, stepIndex, visible]);

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, next, skip]);

  if (!active || !currentStep) return null;

  const pad = 6;
  const effectivePosition = rect
    ? resolvePosition(rect, currentStep.position, tooltipSize.h)
    : currentStep.position;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: 'auto' }}>
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
        />
      </svg>

      {rect && (
        <div
          className="fixed rounded-[10px] border-2 border-nikito-cyan/60 pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 4px rgba(93,229,255,0.12)',
          }}
        />
      )}

      <div
        className="fixed inset-0"
        onClick={skip}
        style={{ pointerEvents: 'auto', zIndex: 0 }}
      />

      {rect && (
        <div
          ref={tooltipRef}
          className="transition-all duration-300"
          style={{
            ...getTooltipStyle(rect, effectivePosition, tooltipSize.w, tooltipSize.h),
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            zIndex: 1,
            pointerEvents: 'auto',
          }}
        >
          <div className="relative bg-[#1a1a4e] border border-nikito-cyan/20 rounded-2xl p-5 shadow-2xl w-[320px] max-w-[calc(100vw-32px)]">
            <ArrowSvg direction={getArrowPosition(effectivePosition)} />

            <div className="flex items-center gap-2 mb-2">
              <span className="text-nikito-cyan text-[10px] font-semibold uppercase tracking-wider">
                Etape {stepIndex + 1}/{visibleSteps.length}
              </span>
            </div>

            <h3 className="text-[15px] font-semibold text-white mb-1.5">{currentStep.titre}</h3>
            <p className="text-[13px] text-dim leading-relaxed mb-5">{currentStep.description}</p>

            <div className="flex items-center justify-between">
              <button
                onClick={skip}
                className="text-[12px] text-faint hover:text-dim transition-colors px-2 py-1.5"
              >
                Passer
              </button>
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 bg-nikito-cyan text-[#0B0B2E] text-[13px] font-semibold px-4 py-2 rounded-[10px] hover:bg-nikito-cyan/90 transition-colors min-h-[36px]"
              >
                {stepIndex + 1 === visibleSteps.length ? 'Terminer' : 'Suivant'}
                {stepIndex + 1 < visibleSteps.length && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex gap-1 mt-4 justify-center">
              {visibleSteps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-200 ${
                    i === stepIndex ? 'w-5 bg-nikito-cyan' : i < stepIndex ? 'w-2 bg-nikito-cyan/40' : 'w-2 bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
