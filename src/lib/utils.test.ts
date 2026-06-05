import { describe, it, expect } from 'vitest';
import { cn, formatChrono, formatDuree } from './utils';

describe('cn', () => {
  it('concatène les classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('ignore les valeurs falsy', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
  it('gère les classes conditionnelles', () => {
    expect(cn('base', { actif: true, inactif: false })).toBe('base actif');
  });
});

describe('formatChrono', () => {
  it('formate mm:ss sous une heure', () => {
    expect(formatChrono(0)).toBe('00:00');
    expect(formatChrono(65)).toBe('01:05');
    expect(formatChrono(599)).toBe('09:59');
  });
  it('formate h:mm:ss au-delà d’une heure', () => {
    expect(formatChrono(3600)).toBe('1:00:00');
    expect(formatChrono(3661)).toBe('1:01:01');
    expect(formatChrono(7384)).toBe('2:03:04');
  });
});

describe('formatDuree', () => {
  const base = '2026-06-05T10:00:00.000Z';
  it('affiche en minutes sous une heure', () => {
    expect(formatDuree(base, '2026-06-05T10:23:00.000Z')).toBe('23 min');
  });
  it('affiche heures + minutes sous un jour', () => {
    expect(formatDuree(base, '2026-06-05T12:30:00.000Z')).toBe('2h 30min');
  });
  it('affiche jours + heures au-delà', () => {
    expect(formatDuree(base, '2026-06-07T14:00:00.000Z')).toBe('2j 4h');
  });
});
