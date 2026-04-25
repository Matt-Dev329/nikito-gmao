import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { uploadPhotoControle } from '@/lib/uploadPhotoControle';

// ─── Types ──────────────────────────────────────────────────────

type Etape = 'categorie' | 'equipement' | 'symptome' | 'photo' | 'recap' | 'succes';

interface Categorie {
  id: string;
  nom: string;
  criticite_defaut: string;
  nb: number;
}

interface Equipement {
  id: string;
  code: string;
  libelle: string;
  photo_url: string | null;
  zone_nom: string | null;
}

interface Symptome {
  id: string;
  libelle: string;
  icone: string | null;
}

interface SignalementState {
  categorie: Categorie | null;
  equipement: Equipement | null;
  equipementManquantLabel: string | null;
  symptome: Symptome | null;
  symptomeLibre: string | null;
  photoUrl: string | null;
  photoPreview: string | null;
  prioriteEscaladee: boolean;
}

const INITIAL_STATE: SignalementState = {
  categorie: null,
  equipement: null,
  equipementManquantLabel: null,
  symptome: null,
  symptomeLibre: null,
  photoUrl: null,
  photoPreview: null,
  prioriteEscaladee: false,
};

const CATEGORIE_ICONS: Record<string, string> = {
  'Arcade': '🕹️', 'Ascenseur': '🛗', 'Bowling': '🎳', 'Casier': '🔐',
  'Château': '🏰', 'Éclairage': '💡', 'Escalator': '🪜', 'Fléchettes': '🎯',
  'I-Quiz': '❓', 'Immersive': '🥽', 'Karaoké': '🎤', 'Karting': '🏎️',
  'Lancer': '🪓', 'Laser': '🔫', 'Mini-golf': '⛳', 'Monte-charge': '📦',
  'Ninja': '🧗', 'Octogone': '🥊', 'Palomano': '⚽', 'Prison': '🔒',
  'Projecteur': '🎬', 'Sanitaire': '🚻', 'Sécurité': '🚨', 'SoftPlay': '🧸',
  'TGBT': '⚡', 'Trampoline': '🤸',
};

function getCategorieIcon(nom: string): string {
  for (const [key, icon] of Object.entries(CATEGORIE_ICONS)) {
    if (nom.startsWith(key)) return icon;
  }
  return '📦';
}

const SLA_MAP: Record<string, string> = {
  bloquant: '1h', majeur: '4h', mineur: '48h',
};

// ─── Hook to get current user context (auth or staff session) ───

function useUserContext() {
  const { utilisateur } = useAuth();
  const [staffSession, setStaffSession] = useState<{
    utilisateur: { utilisateur_id: string; prenom: string; nom: string; role_code: string };
    parc: { id: string; code: string; nom: string };
  } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('staff_session');
    if (raw) {
      try { setStaffSession(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  if (utilisateur) {
    return {
      userId: utilisateur.id,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      roleCode: utilisateur.role_code,
      parcIds: utilisateur.parc_ids,
      isStaff: utilisateur.role_code === 'staff_operationnel',
    };
  }

  if (staffSession) {
    return {
      userId: staffSession.utilisateur.utilisateur_id,
      prenom: staffSession.utilisateur.prenom,
      nom: staffSession.utilisateur.nom,
      roleCode: staffSession.utilisateur.role_code,
      parcIds: [staffSession.parc.id],
      isStaff: true,
    };
  }

  return null;
}

// ─── Main Component ─────────────────────────────────────────────

export function PageSignaler() {
  const navigate = useNavigate();
  const userCtx = useUserContext();
  const [etape, setEtape] = useState<Etape>('categorie');
  const [state, setState] = useState<SignalementState>(INITIAL_STATE);
  const [parcId, setParcId] = useState<string | null>(null);
  const [parcCode, setParcCode] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultBt, setResultBt] = useState<string | null>(null);
  const [resultPriorite, setResultPriorite] = useState<string | null>(null);
  const [resultValidation, setResultValidation] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    if (!userCtx) return;
    if (userCtx.parcIds.length === 1) {
      setParcId(userCtx.parcIds[0]);
      supabase.from('parcs').select('code').eq('id', userCtx.parcIds[0]).maybeSingle()
        .then(({ data }) => { if (data) setParcCode(data.code); });
    }
  }, [userCtx]);

  const update = useCallback((patch: Partial<SignalementState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFlow = useCallback(() => {
    setState(INITIAL_STATE);
    setEtape('categorie');
    setRecherche('');
    setSubmitError(null);
    setResultBt(null);
  }, []);

  const goBack = useCallback(() => {
    const order: Etape[] = ['categorie', 'equipement', 'symptome', 'photo', 'recap'];
    const idx = order.indexOf(etape);
    if (idx > 0) {
      setEtape(order[idx - 1]);
      setRecherche('');
    }
  }, [etape]);

  const handleSubmit = useCallback(async () => {
    if (!parcId || !state.categorie || !state.photoUrl || !userCtx) return;
    setSubmitting(true);
    setSubmitError(null);

    const apiUrl = `${supabaseUrl}/functions/v1/creer-incident-signalement`;
    const headers = {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      parc_id: parcId,
      equipement_id: state.equipement?.id ?? null,
      categorie_id: state.categorie.id,
      symptome_id: state.symptome?.id ?? null,
      symptome_libre: state.symptomeLibre,
      photo_url: state.photoUrl,
      priorite_escaladee: state.prioriteEscaladee,
      equipement_manquant_label: state.equipementManquantLabel,
      declare_par_id: userCtx.userId,
    };

    try {
      const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) {
        setSubmitError(data.error ?? 'Erreur inconnue');
        setSubmitting(false);
        return;
      }
      setResultBt(data.numero_bt);
      setResultPriorite(data.priorite_code);
      setResultValidation(data.validation_manager);
      setEtape('succes');
    } catch {
      setSubmitError('Erreur reseau -- verifiez votre connexion');
    }
    setSubmitting(false);
  }, [parcId, state, userCtx]);

  if (!userCtx) {
    return (
      <div className="min-h-screen bg-[#0a0e27] text-text flex items-center justify-center">
        <div className="text-dim text-sm">Chargement...</div>
      </div>
    );
  }

  const prioriteCode = state.prioriteEscaladee
    ? 'bloquant'
    : (state.categorie?.criticite_defaut ?? 'mineur');

  return (
    <div className="min-h-screen bg-[#0a0e27] text-text flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom, 80px)' }}>
      {/* Header */}
      {etape !== 'succes' && (
        <header className="sticky top-0 z-30 bg-[#0a0e27]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
          {etape !== 'categorie' && (
            <button onClick={goBack} className="bg-[#131836] border border-white/[0.08] text-dim w-10 h-10 rounded-xl text-lg active:scale-95 transition-transform flex items-center justify-center">
              ‹
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-dim uppercase tracking-[1.4px]">Signaler un incident</div>
            <div className="text-[15px] font-semibold text-white truncate">
              {etape === 'categorie' && "Qu'est-ce qui pose probleme ?"}
              {etape === 'equipement' && 'Lequel exactement ?'}
              {etape === 'symptome' && "Qu'observez-vous ?"}
              {etape === 'photo' && 'Prenez une photo'}
              {etape === 'recap' && "Verifiez avant d'envoyer"}
            </div>
          </div>
          <StepIndicator current={['categorie', 'equipement', 'symptome', 'photo', 'recap'].indexOf(etape) + 1} total={5} />
        </header>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {etape === 'categorie' && (
          <EtapeCategorie
            parcId={parcId}
            recherche={recherche}
            onRecherche={setRecherche}
            onSelect={(cat) => { update({ categorie: cat }); setEtape('equipement'); setRecherche(''); }}
          />
        )}
        {etape === 'equipement' && state.categorie && (
          <EtapeEquipement
            parcId={parcId}
            categorie={state.categorie}
            recherche={recherche}
            onRecherche={setRecherche}
            onSelect={(eq) => { update({ equipement: eq, equipementManquantLabel: null }); setEtape('symptome'); setRecherche(''); }}
            onManquant={(label) => { update({ equipement: null, equipementManquantLabel: label }); setEtape('symptome'); setRecherche(''); }}
          />
        )}
        {etape === 'symptome' && state.categorie && (
          <EtapeSymptome
            categorieId={state.categorie.id}
            onSelect={(s, libre) => { update({ symptome: s, symptomeLibre: libre }); setEtape('photo'); }}
          />
        )}
        {etape === 'photo' && (
          <EtapePhoto
            parcCode={parcCode}
            userName={`${userCtx.prenom} ${userCtx.nom}`}
            onDone={(url, preview) => { update({ photoUrl: url, photoPreview: preview }); setEtape('recap'); }}
          />
        )}
        {etape === 'recap' && (
          <EtapeRecap
            state={state}
            prioriteCode={prioriteCode}
            isStaff={userCtx.isStaff}
            onEscalade={() => update({ prioriteEscaladee: true })}
            onModifier={goBack}
            onEnvoyer={handleSubmit}
            submitting={submitting}
            error={submitError}
          />
        )}
        {etape === 'succes' && (
          <EtapeSucces
            numeroBt={resultBt}
            prioriteCode={resultPriorite}
            validationManager={resultValidation}
            onNouveau={resetFlow}
            onRetour={() => navigate(-1)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all',
            i < current ? 'bg-[#5DE5FF] w-5' : 'bg-white/10 w-3',
          )}
        />
      ))}
      <span className="text-[10px] text-dim ml-1">{current}/{total}</span>
    </div>
  );
}

// ─── Step 1: Categorie ──────────────────────────────────────────

function EtapeCategorie({
  parcId,
  recherche,
  onRecherche,
  onSelect,
}: {
  parcId: string | null;
  recherche: string;
  onRecherche: (v: string) => void;
  onSelect: (cat: Categorie) => void;
}) {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parcId) return;
    setLoading(true);
    supabase
      .from('equipements')
      .select('categorie_id, categories_equipement!inner(id, nom, criticite_defaut)')
      .eq('parc_id', parcId)
      .eq('statut', 'actif')
      .then(({ data }) => {
        if (!data) { setLoading(false); return; }
        const map = new Map<string, Categorie>();
        for (const row of data) {
          const cat = row.categories_equipement as any;
          const existing = map.get(cat.id);
          if (existing) { existing.nb++; } else {
            map.set(cat.id, { id: cat.id, nom: cat.nom, criticite_defaut: cat.criticite_defaut, nb: 1 });
          }
        }
        setCategories(Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom)));
        setLoading(false);
      });
  }, [parcId]);

  const filtered = recherche
    ? categories.filter((c) => c.nom.toLowerCase().includes(recherche.toLowerCase()))
    : categories;

  if (loading) return <Loading />;

  return (
    <div className="p-4 pb-24">
      {categories.length > 12 && (
        <input
          type="text"
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
          placeholder="Rechercher une categorie..."
          className="w-full bg-[#131836] border border-white/[0.08] rounded-xl p-3.5 text-text text-sm outline-none mb-4 min-h-[48px]"
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            className="bg-[#131836] border border-white/[0.08] rounded-2xl p-4 text-left active:scale-[0.97] active:border-[#E85A9B] transition-all min-h-[90px] relative"
          >
            {cat.criticite_defaut === 'bloquant' && (
              <span className="absolute top-2.5 right-2.5 bg-[#FF4D6D]/20 text-[#FF4D6D] text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                Critique
              </span>
            )}
            <div className="text-2xl mb-2">{getCategorieIcon(cat.nom)}</div>
            <div className="text-[13px] font-semibold text-white leading-tight mb-1">{cat.nom}</div>
            <div className="text-[11px] text-dim">{cat.nb} equipement{cat.nb > 1 ? 's' : ''}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Equipement ─────────────────────────────────────────

function EtapeEquipement({
  parcId,
  categorie,
  recherche,
  onRecherche,
  onSelect,
  onManquant,
}: {
  parcId: string | null;
  categorie: Categorie;
  recherche: string;
  onRecherche: (v: string) => void;
  onSelect: (eq: Equipement) => void;
  onManquant: (label: string) => void;
}) {
  const [equipements, setEquipements] = useState<Equipement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManquant, setShowManquant] = useState(false);
  const [manquantLabel, setManquantLabel] = useState('');

  useEffect(() => {
    if (!parcId) return;
    setLoading(true);
    supabase
      .from('equipements')
      .select('id, code, libelle, photo_url, zones!left(nom, ordre)')
      .eq('parc_id', parcId)
      .eq('categorie_id', categorie.id)
      .eq('statut', 'actif')
      .order('code')
      .then(({ data }) => {
        if (data) {
          setEquipements(data.map((e: any) => ({
            id: e.id, code: e.code, libelle: e.libelle, photo_url: e.photo_url,
            zone_nom: e.zones?.nom ?? null,
          })));
        }
        setLoading(false);
      });
  }, [parcId, categorie.id]);

  const filtered = recherche
    ? equipements.filter((e) =>
        e.code.toLowerCase().includes(recherche.toLowerCase()) ||
        e.libelle.toLowerCase().includes(recherche.toLowerCase())
      )
    : equipements;

  const grouped = useMemo(() => {
    const map = new Map<string, Equipement[]>();
    for (const eq of filtered) {
      const zone = eq.zone_nom ?? 'Sans zone';
      if (!map.has(zone)) map.set(zone, []);
      map.get(zone)!.push(eq);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (loading) return <Loading />;

  return (
    <div className="p-4 pb-24">
      {equipements.length > 10 && (
        <input
          type="text"
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
          placeholder="Rechercher par code ou libelle..."
          className="w-full bg-[#131836] border border-white/[0.08] rounded-xl p-3.5 text-text text-sm outline-none mb-4 min-h-[48px]"
        />
      )}

      {grouped.map(([zone, eqs]) => (
        <div key={zone} className="mb-4">
          <div className="text-[10px] text-dim uppercase tracking-wider px-1 mb-2">{zone}</div>
          <div className="flex flex-col gap-2">
            {eqs.map((eq) => (
              <button
                key={eq.id}
                onClick={() => onSelect(eq)}
                className="bg-[#131836] border border-white/[0.08] rounded-xl p-3.5 flex items-center gap-3 text-left active:scale-[0.98] active:border-[#E85A9B] transition-all min-h-[72px]"
              >
                <div className="w-16 h-16 bg-[#0a0e27] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {eq.photo_url ? (
                    <img src={eq.photo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-2xl">{getCategorieIcon(categorie.nom)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{eq.code}</div>
                  <div className="text-[12px] text-dim truncate">{eq.libelle}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {!showManquant ? (
        <button
          onClick={() => setShowManquant(true)}
          className="w-full mt-4 py-3 text-[12px] text-amber border border-dashed border-amber/30 rounded-xl active:bg-amber/5 min-h-[48px]"
        >
          Equipement absent de la liste
        </button>
      ) : (
        <div className="mt-4 bg-[#131836] border border-amber/30 rounded-xl p-4">
          <div className="text-xs text-amber mb-2 font-semibold">Decrivez l'equipement</div>
          <input
            type="text"
            value={manquantLabel}
            onChange={(e) => setManquantLabel(e.target.value)}
            placeholder="Ex: Borne d'accueil zone B"
            className="w-full bg-[#0a0e27] border border-white/[0.08] rounded-lg p-3 text-text text-sm outline-none mb-3 min-h-[48px]"
          />
          <button
            onClick={() => { if (manquantLabel.trim()) onManquant(manquantLabel.trim()); }}
            disabled={!manquantLabel.trim()}
            className={cn(
              'w-full py-3 rounded-xl text-sm font-semibold min-h-[48px]',
              manquantLabel.trim() ? 'bg-amber/20 text-amber' : 'bg-white/5 text-dim opacity-50'
            )}
          >
            Continuer sans equipement
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Symptome ───────────────────────────────────────────

function EtapeSymptome({
  categorieId,
  onSelect,
}: {
  categorieId: string;
  onSelect: (symptome: Symptome | null, libre: string | null) => void;
}) {
  const [symptomes, setSymptomes] = useState<Symptome[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Symptome | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [isAutre, setIsAutre] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    supabase
      .from('symptomes')
      .select('id, libelle, icone')
      .eq('categorie_id', categorieId)
      .eq('actif', true)
      .order('ordre')
      .order('libelle')
      .then(({ data }) => {
        if (data) setSymptomes(data);
        setLoading(false);
      });
  }, [categorieId]);

  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setCommentaire((prev) => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  if (loading) return <Loading />;

  const autreSymptome = symptomes.find((s) => s.libelle === 'Autre (décrire)');
  const normalSymptomes = symptomes.filter((s) => s.libelle !== 'Autre (décrire)');

  if (selected || isAutre) {
    return (
      <div className="p-4 pb-24">
        <div className="bg-[#131836] rounded-2xl p-4 mb-4 border border-[#5DE5FF]/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{isAutre ? '✏️' : selected?.icone}</span>
            <span className="text-sm font-semibold text-white">{isAutre ? 'Autre (decrivez)' : selected?.libelle}</span>
          </div>
          <div className="relative">
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder={isAutre ? 'Decrivez le probleme observe...' : 'Detail supplementaire si besoin...'}
              rows={isAutre ? 3 : 2}
              className="w-full bg-[#0a0e27] border border-white/[0.08] rounded-xl p-3 pr-12 text-text text-sm outline-none resize-none min-h-[72px]"
            />
            <button
              onClick={toggleVoice}
              className={cn(
                'absolute right-2 top-2 w-10 h-10 rounded-lg flex items-center justify-center text-lg',
                listening ? 'bg-[#FF4D6D]/20 text-[#FF4D6D] animate-pulse' : 'bg-white/5 text-dim'
              )}
              title="Dictee vocale"
            >
              🎤
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setSelected(null); setIsAutre(false); setCommentaire(''); }}
            className="flex-1 bg-[#131836] border border-white/[0.08] rounded-xl py-3.5 text-dim text-sm min-h-[56px]"
          >
            Changer
          </button>
          <button
            onClick={() => {
              if (isAutre && !commentaire.trim()) return;
              onSelect(
                isAutre ? null : selected,
                commentaire.trim() || null,
              );
            }}
            disabled={isAutre && !commentaire.trim()}
            className={cn(
              'flex-1 rounded-xl py-3.5 text-sm font-bold min-h-[56px]',
              (isAutre && !commentaire.trim()) ? 'bg-white/5 text-dim' : 'bg-gradient-to-r from-[#E85A9B] to-[#5DE5FF] text-white'
            )}
          >
            Continuer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <div className="grid grid-cols-2 gap-3 mb-3">
        {normalSymptomes.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="bg-[#131836] border border-white/[0.08] rounded-2xl p-4 text-center active:scale-[0.97] active:border-[#E85A9B] transition-all min-h-[90px] flex flex-col items-center justify-center gap-2"
          >
            <span className="text-3xl">{s.icone ?? '🔧'}</span>
            <span className="text-[12px] text-white leading-tight">{s.libelle}</span>
          </button>
        ))}
      </div>
      {autreSymptome && (
        <button
          onClick={() => setIsAutre(true)}
          className="w-full bg-[#131836] border border-dashed border-white/[0.12] rounded-2xl p-4 text-center active:scale-[0.98] transition-all min-h-[72px] flex items-center justify-center gap-2"
        >
          <span className="text-xl">✏️</span>
          <span className="text-[13px] text-dim">Autre (decrire)</span>
        </button>
      )}
    </div>
  );
}

// ─── Step 4: Photo ──────────────────────────────────────────────

function EtapePhoto({
  parcCode,
  userName,
  onDone,
}: {
  parcCode: string;
  userName: string;
  onDone: (url: string, preview: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const fakeProgress = setInterval(() => {
        setProgress((p) => Math.min(p + 15, 85));
      }, 300);

      const result = await uploadPhotoControle(file, {
        bucket: 'alba-incidents',
        parcCode: parcCode || 'UNKN',
        contexte: new Date().toISOString().slice(0, 10),
        utilisateurNom: userName,
        maxDimension: 1920,
        maxSizeMB: 1,
      });

      clearInterval(fakeProgress);
      setProgress(100);

      onDone(result.path, preview ?? '');
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de l\'upload');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setUploading(false);
    setProgress(0);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-4 pb-24 flex flex-col items-center">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {!preview ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-32 h-32 bg-[#131836] rounded-3xl flex items-center justify-center mb-6 border-2 border-dashed border-white/10">
            <span className="text-5xl">📷</span>
          </div>
          <div className="text-sm text-dim text-center mb-6 max-w-[280px]">
            Prenez une photo de la zone concernee pour documenter l'incident
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-gradient-to-r from-[#E85A9B] to-[#5DE5FF] text-white px-8 py-4 rounded-2xl text-base font-bold active:scale-95 transition-transform min-h-[72px] min-w-[220px]"
          >
            Prendre la photo
          </button>
        </div>
      ) : (
        <div className="w-full">
          <div className="relative rounded-2xl overflow-hidden mb-4 bg-black">
            <img src={preview} alt="Preview" className="w-full max-h-[50vh] object-contain" />
          </div>

          {uploading && (
            <div className="mb-4">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E85A9B] to-[#5DE5FF] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[11px] text-dim text-center mt-1.5">
                {progress < 100 ? `Upload en cours... ${progress}%` : 'Upload termine'}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#FF4D6D]/10 border border-[#FF4D6D]/25 rounded-xl p-3 mb-4 text-center">
              <div className="text-[#FF4D6D] text-xs font-semibold mb-1">Erreur</div>
              <div className="text-dim text-[11px]">{error}</div>
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-[#5DE5FF] text-xs underline"
              >
                Reessayer
              </button>
            </div>
          )}

          {!uploading && !error && (
            <button
              onClick={handleRetake}
              className="w-full bg-[#131836] border border-white/[0.08] rounded-xl py-3 text-dim text-sm min-h-[48px]"
            >
              Refaire la photo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 5: Recap ──────────────────────────────────────────────

function EtapeRecap({
  state,
  prioriteCode,
  isStaff,
  onEscalade,
  onModifier,
  onEnvoyer,
  submitting,
  error,
}: {
  state: SignalementState;
  prioriteCode: string;
  isStaff: boolean;
  onEscalade: () => void;
  onModifier: () => void;
  onEnvoyer: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const prioriteColors: Record<string, string> = {
    bloquant: 'bg-[#FF4D6D]/20 text-[#FF4D6D] border-[#FF4D6D]/30',
    majeur: 'bg-[#FFB547]/20 text-[#FFB547] border-[#FFB547]/30',
    mineur: 'bg-[#D4F542]/20 text-[#D4F542] border-[#D4F542]/30',
  };

  return (
    <div className="p-4 pb-32">
      {/* Photo */}
      {state.photoPreview && (
        <div className="rounded-2xl overflow-hidden mb-4 bg-black">
          <img src={state.photoPreview} alt="" className="w-full max-h-[200px] object-cover" />
        </div>
      )}

      {/* Equipement */}
      <div className="bg-[#131836] rounded-xl p-4 mb-3 border border-white/[0.06]">
        <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">Equipement</div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{state.categorie ? getCategorieIcon(state.categorie.nom) : '📦'}</span>
          <div>
            <div className="text-sm font-semibold text-white">
              {state.equipement?.code ?? state.equipementManquantLabel ?? 'Non specifie'}
            </div>
            <div className="text-[11px] text-dim">
              {state.equipement?.libelle ?? state.categorie?.nom ?? ''} {state.equipement?.zone_nom ? `· ${state.equipement.zone_nom}` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Symptome */}
      <div className="bg-[#131836] rounded-xl p-4 mb-3 border border-white/[0.06]">
        <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">Symptome</div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{state.symptome?.icone ?? '✏️'}</span>
          <div>
            <div className="text-sm font-semibold text-white">{state.symptome?.libelle ?? 'Autre'}</div>
            {state.symptomeLibre && <div className="text-[11px] text-dim">{state.symptomeLibre}</div>}
          </div>
        </div>
      </div>

      {/* Priorite */}
      <div className="bg-[#131836] rounded-xl p-4 mb-3 border border-white/[0.06]">
        <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">Priorite deduite</div>
        <div className="flex items-center gap-2.5">
          <span className={cn('text-xs font-bold px-3 py-1.5 rounded-lg border', prioriteColors[prioriteCode] ?? prioriteColors.mineur)}>
            {prioriteCode.toUpperCase()}
          </span>
          <span className="text-dim text-[11px]">SLA {SLA_MAP[prioriteCode] ?? '?'}</span>
        </div>
        {!state.prioriteEscaladee && prioriteCode !== 'bloquant' && (
          <button
            onClick={onEscalade}
            className="mt-3 w-full bg-[#FF4D6D]/10 border border-[#FF4D6D]/25 rounded-xl py-3 text-[#FF4D6D] text-[12px] font-semibold active:bg-[#FF4D6D]/20 min-h-[48px]"
          >
            C'est plus grave qu'il n'y parait
          </button>
        )}
        {state.prioriteEscaladee && (
          <div className="mt-2 text-[10px] text-[#FF4D6D]">Priorite escaladee manuellement</div>
        )}
      </div>

      {/* Staff approval notice */}
      {isStaff && (
        <div className="bg-[#FFB547]/10 border border-[#FFB547]/25 rounded-xl p-3 mb-3 text-center">
          <div className="text-[#FFB547] text-[11px] font-semibold">
            Ce signalement sera soumis a l'approbation du manager de votre parc
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#FF4D6D]/10 border border-[#FF4D6D]/25 rounded-xl p-3 mb-3 text-center">
          <div className="text-[#FF4D6D] text-xs">{error}</div>
        </div>
      )}

      {/* CTAs */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0e27]/95 backdrop-blur-xl border-t border-white/[0.06] p-4 flex gap-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <button
          onClick={onModifier}
          className="flex-1 bg-[#131836] border border-white/[0.08] rounded-xl py-3.5 text-dim text-sm min-h-[56px]"
        >
          Modifier
        </button>
        <button
          onClick={onEnvoyer}
          disabled={submitting}
          className={cn(
            'flex-[2] rounded-xl py-3.5 text-sm font-bold min-h-[56px]',
            submitting ? 'bg-white/10 text-dim' : 'bg-gradient-to-r from-[#E85A9B] to-[#5DE5FF] text-white active:scale-[0.98]'
          )}
        >
          {submitting ? 'Envoi en cours...' : 'Envoyer le signalement'}
        </button>
      </div>
    </div>
  );
}

// ─── Step 6: Succes ─────────────────────────────────────────────

function EtapeSucces({
  numeroBt,
  prioriteCode,
  validationManager,
  onNouveau,
  onRetour,
}: {
  numeroBt: string | null;
  prioriteCode: string | null;
  validationManager: string | null;
  onNouveau: () => void;
  onRetour: () => void;
}) {
  const [showCheck, setShowCheck] = useState(false);
  useEffect(() => { setTimeout(() => setShowCheck(true), 100); }, []);

  const isBloquant = prioriteCode === 'bloquant';
  const isMajeur = prioriteCode === 'majeur';
  const needsApproval = validationManager === 'en_attente';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div
        className={cn(
          'w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all duration-500',
          showCheck ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          needsApproval ? 'bg-[#FFB547]/20' : 'bg-[#4DD09E]/20'
        )}
      >
        <svg
          className={cn('w-12 h-12 transition-all duration-500', showCheck ? 'scale-100' : 'scale-0')}
          viewBox="0 0 24 24"
          fill="none"
          stroke={needsApproval ? '#FFB547' : '#4DD09E'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      {numeroBt && (
        <div className="text-2xl font-bold text-white mb-2">
          Signalement #{numeroBt}
        </div>
      )}

      {needsApproval ? (
        <div className="text-sm text-[#FFB547] mb-6 max-w-[300px]">
          Votre signalement a ete enregistre et est en attente de validation par le manager de votre parc.
        </div>
      ) : (
        <div className="text-sm text-dim mb-6 max-w-[300px]">
          {isBloquant || isMajeur
            ? 'Un technicien a ete notifie et va intervenir rapidement.'
            : `Sera traite dans les ${SLA_MAP[prioriteCode ?? 'mineur'] ?? '48h'}.`}
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        <button
          onClick={onNouveau}
          className="bg-gradient-to-r from-[#E85A9B] to-[#5DE5FF] text-white py-4 rounded-2xl text-sm font-bold active:scale-95 min-h-[56px]"
        >
          Nouveau signalement
        </button>
        <button
          onClick={onRetour}
          className="bg-[#131836] border border-white/[0.08] text-dim py-3.5 rounded-xl text-sm min-h-[48px]"
        >
          Retour a l'accueil
        </button>
      </div>
    </div>
  );
}

// ─── Loading ────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#5DE5FF]/30 border-t-[#5DE5FF] rounded-full animate-spin" />
    </div>
  );
}
