import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Criticite } from '@/types/database';

// ============================================================
// Modale Signaler un incident · bottom-sheet style
// Accessible via le bouton "+" de la bottom-bar (tous profils)
//
// Branchement Supabase :
//   - INSERT dans incidents (source='staff_caisse' ou 'tech_terrain')
//   - Trigger SQL check_recurrence se déclenche
//   - Si BLOQUANT → Edge Function notify-escalade-sms (OVH)
// ============================================================

interface ModaleSignalerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SignalementData) => void;
  parc: { code: string; nom: string };
  user: { initiales: string; prenom: string };
}

export interface SignalementData {
  equipementId: string;
  equipementCode: string;
  equipementLibelle: string;
  criticite: Criticite;
  description: string;
  photos: File[];
}

export function ModaleSignaler({ open, onClose, onSubmit, parc, user }: ModaleSignalerProps) {
  const [recherche, setRecherche] = useState('');
  const [criticite, setCriticite] = useState<Criticite | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  if (!open) return null;

  const peutEnvoyer = recherche.length > 0 && criticite !== null && description.length >= 10;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-end justify-center p-6">
      <div className="w-full max-w-[680px] bg-bg-card rounded-t-[18px] rounded-b-xl p-5 px-6 border border-nikito-violet/20">
        <div className="flex justify-between items-center mb-[18px]">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Signalement rapide</div>
            <div className="text-lg font-semibold mt-0.5">Nouvel incident</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            ×
          </button>
        </div>

        {/* Détection auto */}
        <div className="bg-bg-deep rounded-[10px] p-2.5 px-3.5 flex items-center gap-2.5 mb-4 text-[11px]">
          <span className="text-nikito-cyan">📍</span>
          <span className="text-dim">Détecté auto :</span>
          <span className="font-medium">
            {parc.code} · {parc.nom}
          </span>
          <span className="text-dim">·</span>
          <span className="font-medium">{user.prenom}</span>
          <span className="text-dim">·</span>
          <span className="font-medium">
            {new Date().toLocaleString('fr-FR', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* Équipement */}
        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Équipement concerné
          </label>
          <div className="bg-bg-deep border border-nikito-violet/30 rounded-[10px] p-3 px-3.5 flex items-center gap-2.5">
            <span className="text-nikito-cyan text-sm">🔍</span>
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher ou scanner QR code..."
              className="flex-1 bg-transparent border-none text-text outline-none"
            />
          </div>
        </div>

        {/* Criticité */}
        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Criticité
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['bloquant', 'majeur', 'mineur'] as Criticite[]).map((c) => (
              <button
                key={c}
                onClick={() => setCriticite(c)}
                className={cn(
                  'py-3.5 rounded-[10px] text-[13px] font-bold flex flex-col items-center gap-1',
                  criticite === c
                    ? c === 'bloquant'
                      ? 'bg-gradient-to-br from-red to-nikito-pink text-text'
                      : c === 'majeur'
                      ? 'bg-amber text-bg-app'
                      : 'bg-nikito-cyan text-bg-app'
                    : 'bg-bg-deep border text-dim ' +
                      (c === 'bloquant'
                        ? 'border-red/30'
                        : c === 'majeur'
                        ? 'border-amber/30'
                        : 'border-nikito-cyan/30')
                )}
              >
                <span className="text-lg">{c === 'bloquant' ? '⚠' : c === 'majeur' ? '●' : '○'}</span>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Description du problème
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Que se passe-t-il ?"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] text-text p-3 px-3.5 text-[13px] resize-y min-h-[70px] outline-none focus:border-nikito-cyan"
          />
        </div>

        {/* Photos */}
        <div className="mb-[18px]">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Photos · max 5
          </label>
          <div className="flex gap-2 flex-wrap">
            {photos.map((_, i) => (
              <div
                key={i}
                className="w-16 h-16 bg-bg-deep rounded-lg border border-nikito-cyan/30 flex items-center justify-center text-green text-xl"
              >
                ✓
              </div>
            ))}
            {photos.length < 5 && (
              <label className="w-16 h-16 bg-transparent border-2 border-dashed border-nikito-cyan/40 rounded-lg text-nikito-cyan flex flex-col items-center justify-center cursor-pointer">
                <span className="text-lg">📷</span>
                <span className="text-[9px]">Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    setPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, 5))
                  }
                />
              </label>
            )}
          </div>
        </div>

        {/* Avertissement SLA si bloquant */}
        {criticite === 'bloquant' && (
          <div className="bg-bg-deep rounded-[10px] p-2.5 px-3.5 mb-[18px] flex items-center gap-2.5 text-[11px] text-dim">
            <span className="text-amber">ⓘ</span>
            <span>
              Bloquant → SMS auto à <strong className="text-text">Direction</strong> et{' '}
              <strong className="text-text">Ryad</strong> · escalade SLA 1h
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-5 py-3.5 rounded-xl text-[13px]"
          >
            Annuler
          </button>
          <button
            onClick={() => {
              if (!peutEnvoyer) return;
              onSubmit({
                equipementId: '', // résolu côté useMutation depuis recherche
                equipementCode: '',
                equipementLibelle: recherche,
                criticite: criticite!,
                description,
                photos,
              });
            }}
            disabled={!peutEnvoyer}
            className={cn(
              'flex-1 bg-gradient-cta text-text py-3.5 rounded-xl text-[14px] font-bold',
              !peutEnvoyer && 'opacity-40 cursor-not-allowed'
            )}
          >
            Créer le ticket
          </button>
        </div>
      </div>
    </div>
  );
}
