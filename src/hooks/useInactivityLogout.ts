import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 min before
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'pointermove'] as const;
const THROTTLE_MS = 15_000;

export function useInactivityLogout(onLogout: () => void, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    const warningEl = document.getElementById('inactivity-warning');
    if (warningEl) warningEl.remove();

    warningTimerRef.current = setTimeout(() => {
      warningShownRef.current = true;
      showWarningBanner();
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    timerRef.current = setTimeout(() => {
      onLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [onLogout]);

  useEffect(() => {
    if (!enabled) return;

    let lastThrottle = 0;
    const handler = () => {
      const now = Date.now();
      if (now - lastThrottle < THROTTLE_MS) return;
      lastThrottle = now;
      resetTimers();
    };

    for (const evt of ACTIVITY_EVENTS) {
      document.addEventListener(evt, handler, { passive: true });
    }

    resetTimers();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, handler);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      const warningEl = document.getElementById('inactivity-warning');
      if (warningEl) warningEl.remove();
    };
  }, [enabled, resetTimers]);
}

function showWarningBanner() {
  if (document.getElementById('inactivity-warning')) return;
  const div = document.createElement('div');
  div.id = 'inactivity-warning';
  div.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:9999;background:#FFB547;color:#0B0B2E;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;font-family:system-ui,sans-serif;';
  div.textContent = 'Session inactive — deconnexion automatique dans 2 minutes. Bougez la souris pour rester connecte.';
  document.body.appendChild(div);
}
