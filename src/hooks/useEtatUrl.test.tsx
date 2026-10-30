import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEtatUrl } from './useEtatUrl';

const enveloppe = ({ children }: { children: ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;

describe('useEtatUrl', () => {
  beforeEach(() => window.history.replaceState(null, '', '/tech/operations'));

  it('garde les filtres dans l’adresse, même changés d’un coup', () => {
    const { result } = renderHook(
      () => ({ onglet: useEtatUrl<string>('onglet', 'a_faire'), parc: useEtatUrl<string>('parc', '') }),
      { wrapper: enveloppe }
    );
    expect(result.current.onglet[0]).toBe('a_faire');
    act(() => {
      result.current.onglet[1]('resolus');
      result.current.parc[1]('sgb');
    });
    expect(result.current.onglet[0]).toBe('resolus');
    expect(result.current.parc[0]).toBe('sgb');
    expect(window.location.search).toBe('?onglet=resolus&parc=sgb');
  });

  it('relit les filtres de l’adresse au retour sur la page', () => {
    window.history.replaceState(null, '', '/tech/operations?onglet=en_cours');
    const { result } = renderHook(() => useEtatUrl<string>('onglet', 'a_faire'), { wrapper: enveloppe });
    expect(result.current[0]).toBe('en_cours');
    act(() => result.current[1]('a_faire'));
    expect(window.location.search).toBe('');
  });
});
