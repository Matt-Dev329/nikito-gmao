import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftPersistence } from './useDraftPersistence';

describe('useDraftPersistence', () => {
  beforeEach(() => localStorage.clear());

  it('sauvegarde puis restaure un brouillon', () => {
    const { result } = renderHook(() => useDraftPersistence<{ a: string }>('test:1'));
    act(() => result.current.save({ a: 'coucou' }));
    expect(result.current.restore()).toMatchObject({ a: 'coucou' });
    expect(result.current.hasDraft).toBe(true);
  });

  it('efface le brouillon', () => {
    const { result } = renderHook(() => useDraftPersistence<{ a: string }>('test:2'));
    act(() => result.current.save({ a: 'x' }));
    act(() => result.current.clear());
    expect(result.current.restore()).toBeNull();
    expect(result.current.hasDraft).toBe(false);
  });

  it('renvoie null quand la clé est nulle (pas de persistance)', () => {
    const { result } = renderHook(() => useDraftPersistence<{ a: string }>(null));
    act(() => result.current.save({ a: 'x' }));
    expect(result.current.restore()).toBeNull();
  });
});
