import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stockage Supabase simulé : on pilote les échecs réseau
const upload = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ upload }) } },
}));

const {
  abonner,
  declarerExecuteur,
  envoyerPhotoOuMettreEnFile,
  estErreurReseau,
  mettreActionEnFile,
  rejouer,
  abandonnerAction,
} = await import('./file');

function etatCourant() {
  let e: Parameters<Parameters<typeof abonner>[0]>[0] | null = null;
  abonner((x) => (e = x))();
  return e!;
}

function enLigne(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
}

describe('file hors-ligne', () => {
  beforeEach(async () => {
    upload.mockReset();
    enLigne(true);
    // vide la file entre les tests
    for (const a of etatCourant().actions) await abandonnerAction(a.id);
  });

  it('reconnaît les erreurs réseau', () => {
    expect(estErreurReseau(new TypeError('Failed to fetch'))).toBe(true);
    expect(estErreurReseau(new Error('Contrôle déjà validé'))).toBe(false);
  });

  it('garde une photo hors connexion puis l’envoie avant les actions au retour du réseau', async () => {
    enLigne(false);
    const r = await envoyerPhotoOuMettreEnFile('alba-controles', 'FRA/draft/p1.jpg', new Blob(['x']), 'image/jpeg');
    expect(r).toEqual({ path: 'FRA/draft/p1.jpg', enAttente: true });
    expect(upload).not.toHaveBeenCalled();

    const ordre: string[] = [];
    upload.mockImplementation(async () => {
      ordre.push('photo');
      return { error: null };
    });
    declarerExecuteur('controle_staff', async () => {
      ordre.push('action');
    });
    await mettreActionEnFile('controle_staff', 'Ouverture FRA', { p: 1 });

    enLigne(true);
    await rejouer();
    expect(ordre).toEqual(['photo', 'action']);
    expect(etatCourant().photos).toBe(0);
    expect(etatCourant().actions).toHaveLength(0);
  });

  it('garde l’action si le réseau retombe, la marque refusée si le serveur la rejette', async () => {
    let mode: 'reseau' | 'refus' = 'reseau';
    declarerExecuteur('signalement', async () => {
      throw mode === 'reseau' ? new TypeError('Failed to fetch') : new Error('Équipement inconnu');
    });
    await mettreActionEnFile('signalement', 'Fuite', {});

    await rejouer();
    expect(etatCourant().actions).toHaveLength(1);
    expect(etatCourant().actions[0].erreur).toBeNull();

    mode = 'refus';
    await rejouer();
    expect(etatCourant().actions[0].erreur).toBe('Équipement inconnu');
  });
});
