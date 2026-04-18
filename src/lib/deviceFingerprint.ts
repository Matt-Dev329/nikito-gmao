const STORAGE_KEY = 'alba_device_id';

export function getDeviceHash(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('alba-device-fingerprint', 2, 2);
  }
  const canvasData = canvas.toDataURL().substring(0, 50);

  const components = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    canvasData,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const deviceId = `dev_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
  localStorage.setItem(STORAGE_KEY, deviceId);
  return deviceId;
}

export function getDeviceName(): string {
  return navigator.platform || 'Unknown';
}

export function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return ua.substring(0, 100);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
