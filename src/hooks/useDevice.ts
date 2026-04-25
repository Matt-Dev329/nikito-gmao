import { useState, useEffect } from 'react';

export type DeviceKind = 'tablet-fixed' | 'mobile' | 'desktop';

export function useDevice(): DeviceKind {
  const [device, setDevice] = useState<DeviceKind>(() => resolve());
  useEffect(() => {
    const handler = () => setDevice(resolve());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return device;
}

function resolve(): DeviceKind {
  if (localStorage.getItem('alba:device_kind') === 'tablet-fixed') return 'tablet-fixed';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}
