import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { PhotoCapture } from '@/components/shared/PhotoCapture';

const PRIORITE_MAP: Record<string, string> = {
  bloquant: 'c685b344-7ef2-4869-9130-1fc994985d73',
  majeur: 'cd2da6e9-17ad-4ec0-9319-37b910a8f8c0',
  mineur: '43cf65ba-a899-4796-82db-eedf91785128',
};

type Criticite = 'bloquant' | 'majeur' | 'mineur';

interface Equipement {
  id: string;
  code: string;
  libelle: string;
}

interface ModaleSignalerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  parcId: string;
  parcCode: string;
  parcNom: string;
  userId?: string;
  userPrenom?: string;
}

export function ModaleSignaler({
  open,
  onClose,
  onSuccess,
  parcId,
  parcCode,
  parcNom,
  userId,
  userPrenom,
}: ModaleSignalerProps) {
  const [recherche, setRecherche] = useState('');
  const [equipements, setEquipements] = useState<Equipement[]>([]);
  const [selectedEquip, setSelectedEquip] = useState<Equipement | null>(null);
  const [criticite, setCriticite] = useState<Criticite | null>(null);
  const [description, setDescription] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incidentId = useState(() => `sig_${Date.now()}`)[0];

  useEffect(() => {
    if (!open) return;
    setRecherche('');
    setSelectedEquip(null);
    setCriticite(null);
    setDescription('');
    setPhotoUrls([]);
    setSubmitting(false);
    setSuccess(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!parcId || recherche.length < 1) {
      setEquipements([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('equipements')
        .select('id, code, libelle')
        .eq('parc_id', parcId)
        .neq('statut', 'archive')
        .or(`code.ilike.%${recherche}%,libelle.ilike.%${recherche}%`)
        .order('code')
        .limit(10);
      setEquipements(data ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [parcId, recherche]);

  const handleSubmit = useCallback(async () => {
    if (!selectedEquip || !criticite || description.length < 5) return;
    setSubmitting(true);
    setError(null);

    const { error: insertErr } = await supabase.from('incidents').insert({
      numero_bt: 'AUTO',
      equipement_id: selectedEquip.id,
      priorite_id: PRIORITE_MAP[criticite],
      type_maintenance: 'correctif_curatif',
      titre: `[Staff] ${selectedEquip.code} — ${criticite === 'bloquant' ? 'HS' : criticite === 'majeur' ? 'Degrade' : 'Mineur'}`,
      description,
      source: 'signalement_staff',
      declare_par_id: userId ?? null,
      photos_urls: photoUrls.length > 0 ? photoUrls : [],
      est_formation: false,
    });

    setSubmitting(false);

    if (insertErr) {
      setError(insertErr.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      onSuccess?.();
      onClose();
    }, 1800);
  }, [selectedEquip, criticite, description, photoUrls, userId, onSuccess, onClose]);

  if (!open) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-bg-card rounded-xl p-6 text-center border border-green/30">
          <div className="text-3xl mb-3">OK</div>
          <div className="text-lg font-semibold text-green mb-1">Signalement envoye</div>
          <div className="text-[12px] text-dim">
            Un ticket a ete cree pour l'equipe maintenance.
          </div>
        </div>
      </div>
    );
  }

  const peutEnvoyer = selectedEquip && criticite && description.length >= 5 && !submitting;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="w-full md:max-w-[600px] bg-bg-card rounded-t-[18px] md:rounded-xl p-4 md:p-5 md:px-6 border border-white/[0.08] max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">
              Signaler un probleme
            </div>
            <div className="text-lg font-semibold mt-0.5">
              Equipement en panne
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            &#215;
          </button>
        </div>

        <div className="bg-bg-deep rounded-[10px] p-2.5 px-3.5 flex items-center gap-2.5 mb-4 text-[11px] flex-wrap">
          <span className="text-nikito-cyan">&#9679;</span>
          <span className="font-medium">{parcCode} - {parcNom}</span>
          {userPrenom && (
            <>
              <span className="text-dim">-</span>
              <span className="font-medium">{userPrenom}</span>
            </>
          )}
          <span className="text-dim">-</span>
          <span className="font-medium">
            {new Date().toLocaleString('fr-FR', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Equipement concerne
          </label>
          {selectedEquip ? (
            <div className="bg-nikito-cyan/[0.06] border border-nikito-cyan/30 rounded-[10px] p-3 px-3.5 flex items-center gap-2.5">
              <span className="text-nikito-cyan text-sm font-bold">{selectedEquip.code}</span>
              <span className="text-[13px] flex-1">{selectedEquip.libelle}</span>
              <button
                onClick={() => { setSelectedEquip(null); setRecherche(''); }}
                className="text-dim text-[11px] hover:text-red"
              >
                Changer
              </button>
            </div>
          ) : (
            <div>
              <div className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 flex items-center gap-2.5">
                <SearchIcon className="w-4 h-4 text-dim flex-shrink-0" />
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Tapez le nom ou code de l'equipement..."
                  className="flex-1 bg-transparent border-none text-text text-[13px] outline-none placeholder:text-faint"
                  autoFocus
                />
              </div>
              {equipements.length > 0 && (
                <div className="mt-1 bg-bg-deep border border-white/[0.08] rounded-[10px] max-h-[200px] overflow-y-auto">
                  {equipements.map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => { setSelectedEquip(eq); setRecherche(''); setEquipements([]); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <span className="text-nikito-cyan text-[12px] font-bold">{eq.code}</span>
                      <span className="text-[12px] text-text truncate">{eq.libelle}</span>
                    </button>
                  ))}
                </div>
              )}
              {recherche.length >= 2 && equipements.length === 0 && (
                <div className="mt-1 text-[11px] text-dim px-1">Aucun equipement trouve</div>
              )}
            </div>
          )}
        </div>

        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Gravite du probleme
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['bloquant', 'majeur', 'mineur'] as Criticite[]).map((c) => (
              <button
                key={c}
                onClick={() => setCriticite(c)}
                className={cn(
                  'py-3.5 rounded-[10px] text-[13px] font-bold flex flex-col items-center gap-1 transition-colors min-h-[44px]',
                  criticite === c
                    ? c === 'bloquant'
                      ? 'bg-red text-white'
                      : c === 'majeur'
                      ? 'bg-amber text-bg-app'
                      : 'bg-nikito-cyan text-bg-app'
                    : 'bg-bg-deep border text-dim ' +
                      (c === 'bloquant'
                        ? 'border-red/30 hover:border-red/60'
                        : c === 'majeur'
                        ? 'border-amber/30 hover:border-amber/60'
                        : 'border-nikito-cyan/30 hover:border-nikito-cyan/60')
                )}
              >
                <span className="text-[10px] uppercase tracking-wider">
                  {c === 'bloquant' ? 'HS / Arrete' : c === 'majeur' ? 'Degrade' : 'Mineur'}
                </span>
                <span className="text-[11px] font-normal opacity-80">
                  {c === 'bloquant'
                    ? 'Machine a l\'arret'
                    : c === 'majeur'
                    ? 'Fonctionne partiellement'
                    : 'Petit defaut'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Description du probleme
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Que se passe-t-il ? Decrivez ce que vous observez..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] text-text p-3 px-3.5 text-[13px] resize-y min-h-[80px] outline-none focus:border-nikito-cyan/50 transition-colors"
          />
        </div>

        <div className="mb-4">
          <PhotoCapture
            bucketName="alba-incidents"
            storagePath={`${parcCode}/${incidentId}`}
            onPhotoUploaded={(url) => setPhotoUrls((prev) => [...prev, url])}
            label="Photo du probleme (recommande)"
          />
          {photoUrls.length > 0 && (
            <div className="mt-1.5 text-[11px] text-green">{photoUrls.length} photo(s) ajoutee(s)</div>
          )}
        </div>

        {criticite === 'bloquant' && (
          <div className="bg-red/[0.08] border border-red/20 rounded-[10px] p-2.5 px-3.5 mb-4 flex items-start gap-2.5 text-[11px]">
            <span className="text-red font-bold mt-px">!</span>
            <span className="text-dim">
              <strong className="text-red">Equipement HS</strong> — L'equipe maintenance sera notifiee immediatement.
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red/[0.08] border border-red/20 rounded-[10px] p-2.5 px-3.5 mb-4 text-[11px] text-red">
            Erreur : {error}
          </div>
        )}

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-5 py-3.5 rounded-xl text-[13px] min-h-[48px]"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!peutEnvoyer}
            className={cn(
              'flex-1 py-3.5 rounded-xl text-[14px] font-bold min-h-[48px] transition-all',
              peutEnvoyer
                ? 'bg-gradient-cta text-text hover:brightness-110'
                : 'bg-bg-deep text-faint cursor-not-allowed'
            )}
          >
            {submitting ? 'Envoi en cours...' : 'Creer le ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="5" />
      <path d="M14 14l-3.5-3.5" />
    </svg>
  );
}
