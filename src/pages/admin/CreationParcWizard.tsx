import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCategoriesEquipement } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';

// ============================================================
// Création d'un parc (chef d'équipe, direction) :
//   1. Identité    → INSERT parcs (actif, en pré-lancement : en_production = false)
//   2. Attractions → INSERT parc_attractions
// Ensuite la fiche du parc s'ouvre : zones, équipements, équipe, contrôles,
// notes… La mise en production se fait depuis la liste des parcs.
// ============================================================

const ROLES_CREATION = ['direction', 'chef_maintenance'];

type EtapeCode = 'identite' | 'attractions';
const etapes: { code: EtapeCode; label: string }[] = [
  { code: 'identite', label: 'Identité' },
  { code: 'attractions', label: 'Attractions' },
];

interface Identite {
  code: string;
  nom: string;
  adresse: string;
  ville: string;
  code_postal: string;
  latitude: string;
  longitude: string;
  surface_m2: string;
  ouvert_7j7: boolean;
}

const champ = 'w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan min-h-[44px]';
const nombre = (t: string) => {
  const v = parseFloat(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export function CreationParcWizard() {
  const { utilisateur } = useAuth();
  if (utilisateur && !ROLES_CREATION.includes(utilisateur.role_code)) return <Navigate to="/gmao/parcs" replace />;
  return <Assistant />;
}

function Assistant() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [etape, setEtape] = useState<EtapeCode>('identite');
  const [parcId, setParcId] = useState<string | null>(null);
  const [identite, setIdentite] = useState<Identite>({
    code: '',
    nom: '',
    adresse: '',
    ville: '',
    code_postal: '',
    latitude: '',
    longitude: '',
    surface_m2: '',
    ouvert_7j7: false,
  });
  const [attractions, setAttractions] = useState<Map<string, number>>(new Map());
  const [enCours, setEnCours] = useState(false);
  const [geoloc, setGeoloc] = useState<'idle' | 'recherche' | 'ok' | 'introuvable'>('idle');

  // Coordonnées GPS depuis l'adresse (Base Adresse Nationale, service public)
  const localiser = async () => {
    const q = [identite.adresse, identite.code_postal, identite.ville].filter((x) => x.trim()).join(' ');
    if (q.trim().length < 5) return;
    setGeoloc('recherche');
    try {
      const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`);
      const d = (await r.json()) as { features?: { geometry: { coordinates: [number, number] } }[] };
      const c = d.features?.[0]?.geometry.coordinates;
      if (!c) {
        setGeoloc('introuvable');
        return;
      }
      setIdentite((i) => ({ ...i, longitude: String(c[0]), latitude: String(c[1]) }));
      setGeoloc('ok');
    } catch {
      setGeoloc('introuvable');
    }
  };

  const enregistrerIdentite = async () => {
    const code = identite.code.trim().toUpperCase();
    const lat = nombre(identite.latitude);
    const lng = nombre(identite.longitude);
    if (!/^[A-Z]{3}$/.test(code)) return toast.error('Le code parc doit faire 3 lettres (ex. TLS)');
    if (!identite.nom.trim() || !identite.adresse.trim() || !identite.ville.trim() || !identite.code_postal.trim())
      return toast.error('Nom, adresse, ville et code postal sont obligatoires');
    if (lat === null || lng === null) return toast.error('Coordonnées GPS manquantes : clique sur « 📍 Localiser l’adresse »');
    setEnCours(true);
    const valeurs = {
      code,
      nom: identite.nom.trim(),
      adresse: identite.adresse.trim(),
      ville: identite.ville.trim(),
      code_postal: identite.code_postal.trim(),
      latitude: lat,
      longitude: lng,
      surface_m2: nombre(identite.surface_m2),
      ouvert_7j7: identite.ouvert_7j7,
    };
    const { data, error } = parcId
      ? await supabase.from('parcs').update(valeurs).eq('id', parcId).select('id').single()
      : await supabase.from('parcs').insert({ ...valeurs, actif: true, en_production: false }).select('id').single();
    setEnCours(false);
    if (error) {
      toast.error(error.code === '23505' ? `Le code ${code} est déjà utilisé par un autre parc` : error.message);
      return;
    }
    setParcId(data.id as string);
    qc.invalidateQueries({ queryKey: ['parcs'] });
    toast.success(parcId ? 'Identité mise à jour' : `Parc ${code} créé (pré-lancement)`);
    setEtape('attractions');
  };

  const terminer = async () => {
    if (!parcId) return;
    setEnCours(true);
    if (attractions.size) {
      const { error } = await supabase.from('parc_attractions').insert(
        [...attractions.entries()].map(([categorie_id, quantite]) => ({ parc_id: parcId, categorie_id, quantite, meta: {} }))
      );
      if (error) {
        setEnCours(false);
        toast.error(error.message);
        return;
      }
    }
    setEnCours(false);
    qc.invalidateQueries({ queryKey: ['parcs'] });
    toast.success('Parc configuré — complète zones, équipements et équipe depuis sa fiche');
    navigate(`/gmao/parcs/${parcId}`);
  };

  const index = etapes.findIndex((e) => e.code === etape);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex items-center gap-2 mb-1.5 text-[11px] text-dim">
        <span>Configuration</span>
        <span>›</span>
        <span>Parcs</span>
        <span>›</span>
        <span className="text-nikito-cyan">Nouveau parc</span>
      </div>
      <div className="flex justify-between items-start mb-5 gap-3">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Créer un nouveau parc</h1>
          <div className="text-[13px] text-dim mt-1">
            Le parc est créé en pré-lancement ; la mise en production se fait ensuite depuis la liste des parcs.
          </div>
        </div>
        <button onClick={() => navigate('/gmao/parcs')} className="border border-white/15 text-dim px-3.5 py-2 rounded-lg text-xs min-h-[40px]">
          Quitter
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {etapes.map((e, i) => (
          <div
            key={e.code}
            className={cn(
              'flex-1 rounded-xl px-4 py-3 text-[13px] border',
              i === index ? 'border-nikito-cyan/50 bg-nikito-cyan/10 text-nikito-cyan font-semibold' : i < index ? 'border-green/30 text-green' : 'border-white/[0.06] text-dim'
            )}
          >
            {i < index ? '✓ ' : `${i + 1}. `}
            {e.label}
          </div>
        ))}
      </div>

      {etape === 'identite' && (
        <div className="bg-bg-card rounded-2xl p-4 md:p-6 max-w-3xl grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Champ label="Code parc · 3 lettres">
              <input
                value={identite.code}
                onChange={(e) => setIdentite({ ...identite, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })}
                placeholder="ex. TLS"
                className={cn(champ, 'font-mono')}
              />
            </Champ>
            <Champ label="Nom complet">
              <input value={identite.nom} onChange={(e) => setIdentite({ ...identite, nom: e.target.value })} placeholder="ex. Nikito Toulouse" className={champ} />
            </Champ>
          </div>
          <Champ label="Adresse">
            <input value={identite.adresse} onChange={(e) => setIdentite({ ...identite, adresse: e.target.value })} className={champ} />
          </Champ>
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
            <Champ label="Code postal">
              <input value={identite.code_postal} onChange={(e) => setIdentite({ ...identite, code_postal: e.target.value })} inputMode="numeric" className={champ} />
            </Champ>
            <Champ label="Ville">
              <input value={identite.ville} onChange={(e) => setIdentite({ ...identite, ville: e.target.value })} className={champ} />
            </Champ>
          </div>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-end">
            <Champ label="Latitude">
              <input value={identite.latitude} onChange={(e) => setIdentite({ ...identite, latitude: e.target.value })} placeholder="48.8566" inputMode="decimal" className={champ} />
            </Champ>
            <Champ label="Longitude">
              <input value={identite.longitude} onChange={(e) => setIdentite({ ...identite, longitude: e.target.value })} placeholder="2.3522" inputMode="decimal" className={champ} />
            </Champ>
            <button
              onClick={localiser}
              disabled={geoloc === 'recherche'}
              className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-4 rounded-lg text-[13px] font-semibold min-h-[44px] disabled:opacity-50"
            >
              {geoloc === 'recherche' ? 'Recherche…' : '📍 Localiser l’adresse'}
            </button>
          </div>
          {geoloc === 'ok' && <div className="text-[12px] text-green -mt-2">Coordonnées trouvées depuis l’adresse ✓</div>}
          {geoloc === 'introuvable' && <div className="text-[12px] text-amber -mt-2">Adresse introuvable : saisis la latitude et la longitude à la main.</div>}
          <div className="grid sm:grid-cols-2 gap-4 items-end">
            <Champ label="Surface (m², facultatif)">
              <input value={identite.surface_m2} onChange={(e) => setIdentite({ ...identite, surface_m2: e.target.value })} inputMode="numeric" className={champ} />
            </Champ>
            <label className="flex items-center gap-2 text-[13px] min-h-[44px]">
              <input type="checkbox" checked={identite.ouvert_7j7} onChange={(e) => setIdentite({ ...identite, ouvert_7j7: e.target.checked })} className="w-4 h-4 accent-nikito-pink" />
              Ouvert 7 jours sur 7
            </label>
          </div>
          <div className="flex justify-end">
            <button onClick={enregistrerIdentite} disabled={enCours} className="bg-gradient-cta text-text px-6 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-40">
              {enCours ? 'Enregistrement…' : parcId ? 'Mettre à jour et continuer ›' : 'Créer le parc et continuer ›'}
            </button>
          </div>
        </div>
      )}

      {etape === 'attractions' && (
        <EtapeAttractions
          attractions={attractions}
          setAttractions={setAttractions}
          enCours={enCours}
          onRetour={() => setEtape('identite')}
          onTerminer={terminer}
        />
      )}
    </div>
  );
}

function EtapeAttractions({
  attractions,
  setAttractions,
  enCours,
  onRetour,
  onTerminer,
}: {
  attractions: Map<string, number>;
  setAttractions: (m: Map<string, number>) => void;
  enCours: boolean;
  onRetour: () => void;
  onTerminer: () => void;
}) {
  const { data: categories } = useCategoriesEquipement();
  const basculer = (id: string, coche: boolean) => {
    const m = new Map(attractions);
    if (coche) m.set(id, 1);
    else m.delete(id);
    setAttractions(m);
  };
  return (
    <div className="bg-bg-card rounded-2xl p-4 md:p-6">
      <h2 className="text-base font-semibold mb-1">Attractions du parc</h2>
      <p className="text-dim text-xs mb-4">
        Coche les types d’attractions présents et indique les quantités (facultatif, modifiable ensuite). Les équipements détaillés se créent
        depuis la fiche du parc.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {categories?.map((c) => {
          const quantite = attractions.get(c.id);
          return (
            <div
              key={c.id}
              className={cn('flex items-center gap-3 p-3 rounded-lg border', quantite !== undefined ? 'bg-bg-deep border-nikito-cyan/40' : 'bg-bg-deep border-white/[0.06]')}
            >
              <input type="checkbox" checked={quantite !== undefined} onChange={(e) => basculer(c.id, e.target.checked)} className="w-4 h-4 accent-nikito-pink" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{c.nom}</div>
                {c.norme_associee && <div className="text-[10px] text-dim truncate">{c.norme_associee}</div>}
              </div>
              {quantite !== undefined && (
                <input
                  type="number"
                  min="1"
                  value={quantite}
                  onChange={(e) => setAttractions(new Map(attractions).set(c.id, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-16 bg-bg-app border border-white/10 rounded p-1.5 text-text text-xs text-center"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-5">
        <button onClick={onRetour} className="border border-white/15 text-text px-5 rounded-[10px] text-[13px] min-h-[44px]">
          ‹ Identité
        </button>
        <button onClick={onTerminer} disabled={enCours} className="bg-gradient-cta text-text px-6 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-40">
          {enCours ? 'Enregistrement…' : 'Terminer et ouvrir la fiche du parc ›'}
        </button>
      </div>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] text-dim uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
