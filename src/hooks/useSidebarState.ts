import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'nikito-sidebar-expanded';

function getInitialExpanded(): boolean {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored !== null) return stored === '1';
  } catch {}
  return window.innerWidth >= 1280;
}

export function useSidebarState() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(getInitialExpanded);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, expanded ? '1' : '0');
    } catch {}
  }, [expanded]);

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return { mobileOpen, expanded, toggleExpanded, openMobile, closeMobile };
}
