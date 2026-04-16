import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCategoriesEquipement } from '@/hooks/queries/useReferentiel';

// ============================================================
// Wizard création/configuration parc · admin
// 6 étapes · sauvegarde auto à chaque étape
//
// Branchement Supabase :
//   1. Identité     → INSERT parcs
//   2. Plan & zones → INSERT zones (coordonnees_plan en JSONB)
//   3. Attractions  → INSERT parc_attractions
//   4. Équipements  → INSERT equipements (en lot via CSV ou unitaire)
//   5. Équipe       → INSERT parcs_utilisateurs
//   6. Mise service → UPDATE parcs SET actif=true + génération contrôles auto
// ============================================================

type EtapeCode = 'identite' | 'plan' | 'attractions' | 'equipements' | 'equipe' | 'mise_service';

const etapes: { code: EtapeCode; label: string }[] = [
  { code: 'identite', label: 'Identité' },
  { code: 'plan', label: 'Plan & zones' },
  { code: 'attractions', label: 'Attractions' },
  { code: 'equipements', label: 'Équipements' },
  { code: 'equipe', label: 'Équipe' },
  { code: 'mise_service', label: 'Mise en service' },
];

interface ParcDraft {
  id?: string; // Set après save étape 1
  code: string;
  nom: string;
  adresse: string;
  ville: string;
  code_postal: string;
  latitude: number | null;
  longitude: number | null;
  surface_m2: number | null;
  ouvert_7j7: boolean;
  zones: Array<{ nom: string; ordre: number; coordonnees_plan: { x: number; y: number; w: number; h: number } }>;
  attractions: Array<{ categorie_id: string; quantite: number; meta: Record<string, unknown> }>;
  // Équipements et équipe gérés en sous-tables séparées
}

export function CreationParcWizard() {
  const navigate = useNavigate();
  const [etapeActive, setEtapeActive] = useState<EtapeCode>('identite');
  const [draft, setDraft] = useState<ParcDraft>({
    code: '',
    nom: '',
    adresse: '',
    ville: '',
    code_postal: '',
    latitude: null,
    longitude: null,
    surface_m2: null,
    ouvert_7j7: false,
    zones: [],
    attractions: [],
  });

  const etapeIndex = etapes.findIndex((e) => e.code === etapeActive);

  return (
    <div className="p-6 px-7 overflow-hidden">
      <div className="flex items-center gap-2 mb-1.5 text-[11px] text-dim">
        <span>Configuration</span>
        <span>›</span>
        <span>Parcs</span>
        <span>›</span>
        <span className="text-nikito-cyan">Nouveau parc</span>
      </div>

      <div className="flex justify-between items-start mb-[22px]">
        <div>
          <h1 className="text-[22px] font-semibold m-0">Créer un nouveau parc</h1>
          <div className="text-[13px] text-dim mt-1">
            Configuration complète · sauvegarde automatique à chaque étape
          </div>
        </div>
        <button
          onClick={() => navigate('/gmao/parcs')}
          className="bg-transparent border border-white/15 text-dim px-3.5 py-2 rounded-lg text-xs"
        >
          Quitter
        </button>
      </div>

      <Stepper etapes={etapes} index={etapeIndex} />

      <div className="mb-[18px]">
        {etapeActive === 'identite' && <EtapeIdentite draft={draft} setDraft={setDraft} />}
        {etapeActive === 'plan' && <EtapePlanZones draft={draft} setDraft={setDraft} />}
        {etapeActive === 'attractions' && <EtapeAttractions draft={draft} setDraft={setDraft} />}
        {etapeActive === 'equipements' && <EtapeEquipements draft={draft} />}
        {etapeActive === 'equipe' && <EtapeEquipe draft={draft} />}
        {etapeActive === 'mise_service' && <EtapeMiseEnService draft={draft} />}
      </div>

      <div className="flex justify-between mt-[18px]">
        <button
          onClick={() => {
            if (etapeIndex > 0) setEtapeActive(etapes[etapeIndex - 1].code);
          }}
          disabled={etapeIndex === 0}
          className={cn(
            'bg-transparent border border-white/15 text-text px-5 py-2.5 rounded-[10px] text-[13px]',
            etapeIndex === 0 && 'opacity-40 cursor-not-allowed'
          )}
        >
          ‹ Étape précédente
        </button>
        <div className="flex gap-2.5 items-center">
          <span className="text-[11px] text-green">✓ Sauvegardé il y a 12s</span>
          <button
            onClick={() => {
              if (etapeIndex < etapes.length - 1) setEtapeActive(etapes[etapeIndex + 1].code);
              else navigate('/gmao/parcs');
            }}
            className="bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold"
          >
            {etapeIndex === etapes.length - 1
              ? 'Activer le parc ›'
              : `Étape suivante · ${etapes[etapeIndex + 1].label} ›`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Stepper
// ============================================================
function Stepper({ etapes, index }: { etapes: { code: string; label: string }[]; index: number }) {
  return (
    <div className="bg-bg-card rounded-2xl py-[18px] px-[22px] mb-[18px]">
      <div className="flex items-center gap-0">
        {etapes.map((e, i) => {
          const done = i < index;
          const current = i === index;
          return (
            <div key={e.code} className="contents">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px]',
                    done && 'bg-green text-bg-app',
                    current && 'bg-gradient-to-br from-nikito-pink to-nikito-violet text-text',
                    !done && !current && 'bg-[#2A2A5A] text-dim'
                  )}
                >
                  {done ? '✓' : i + 1}
                </div>
                <div
                  className={cn(
                    'text-[10px] text-center w-20',
                    done && 'text-green font-semibold',
                    current && 'text-text font-semibold',
                    !done && !current && 'text-dim'
                  )}
                >
                  {e.label}
                </div>
              </div>
              {i < etapes.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1 mb-[18px]',
                    done ? 'bg-green' : 'bg-[#2A2A5A]'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Étape 1 · Identité
// ============================================================
function EtapeIdentite({ draft, setDraft }: { draft: ParcDraft; setDraft: (d: ParcDraft) => void }) {
  return (
    <div className="bg-bg-card rounded-2xl p-6 max-w-3xl">
      <h2 className="text-base font-semibold mb-4">Identité du parc</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code parc · 3 lettres">
          <input
            type="text"
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().slice(0, 3) })}
            placeholder="ex: TLS"
            maxLength={3}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text font-mono outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Nom complet">
          <input
            type="text"
            value={draft.nom}
            onChange={(e) => setDraft({ ...draft, nom: e.target.value })}
            placeholder="ex: Nikito Toulouse"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Adresse" wide>
          <input
            type="text"
            value={draft.adresse}
            onChange={(e) => setDraft({ ...draft, adresse: e.target.value })}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Ville">
          <input
            type="text"
            value={draft.ville}
            onChange={(e) => setDraft({ ...draft, ville: e.target.value })}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Code postal">
          <input
            type="text"
            value={draft.code_postal}
            onChange={(e) => setDraft({ ...draft, code_postal: e.target.value })}
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Latitude GPS">
          <input
            type="number"
            step="any"
            value={draft.latitude ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, latitude: e.target.value ? parseFloat(e.target.value) : null })
            }
            placeholder="48.8566"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Longitude GPS">
          <input
            type="number"
            step="any"
            value={draft.longitude ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, longitude: e.target.value ? parseFloat(e.target.value) : null })
            }
            placeholder="2.3522"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Surface (m²)">
          <input
            type="number"
            value={draft.surface_m2 ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, surface_m2: e.target.value ? parseInt(e.target.value) : null })
            }
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg p-3 text-text outline-none focus:border-nikito-cyan"
          />
        </Field>
        <Field label="Ouverture 7j/7">
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={draft.ouvert_7j7}
              onChange={(e) => setDraft({ ...draft, ouvert_7j7: e.target.checked })}
              className="w-4 h-4 accent-nikito-pink"
            />
            <span className="text-sm">Le parc est ouvert tous les jours (astreinte)</span>
          </label>
        </Field>
      </div>
    </div>
  );
}

// ============================================================
// Étape 2 · Plan & zones (TODO · éditeur SVG complet)
// ============================================================
function EtapePlanZones({ draft, setDraft: _setDraft }: { draft: ParcDraft; setDraft: (d: ParcDraft) => void }) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-[18px]">
      <div className="bg-bg-card rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div className="text-[13px] font-semibold">Plan du parc</div>
            <div className="text-[11px] text-dim mt-0.5">
              Importe ton plan ou dessine les zones manuellement
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-3 py-1.5 rounded-lg text-[11px]">
              ⬆ Importer SVG/PNG
            </button>
            <button className="bg-bg-deep border border-white/10 text-dim px-3 py-1.5 rounded-lg text-[11px]">
              📐 Mode dessin
            </button>
          </div>
        </div>

        <div className="bg-bg-deep border border-dashed border-nikito-violet/30 rounded-[10px] p-2 min-h-[300px] flex items-center justify-center text-dim text-sm">
          {draft.zones.length === 0
            ? '🖼️ Importer un plan ou dessiner pour commencer'
            : `${draft.zones.length} zone(s) dessinée(s)`}
          {/* TODO · Composant éditeur SVG interactif (drag-resize, drag-create) */}
        </div>
      </div>

      <div className="bg-bg-card rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3.5">
          <div className="text-[13px] font-semibold">Zones du parc</div>
          <span className="bg-bg-deep text-nikito-cyan px-2.5 py-0.5 rounded-lg text-[11px] font-semibold">
            {draft.zones.length} zones
          </span>
        </div>

        <div className="text-dim text-xs">
          Liste des zones synchronisée avec le plan. Cliquer sur une zone pour l'éditer.
        </div>

        <button className="bg-transparent border border-dashed border-nikito-cyan/30 text-nikito-cyan px-3 py-2.5 rounded-[10px] text-xs mt-3 w-full">
          + Ajouter une zone
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Étape 3 · Attractions (sélection catégories + quantités)
// ============================================================
function EtapeAttractions({ draft, setDraft }: { draft: ParcDraft; setDraft: (d: ParcDraft) => void }) {
  const { data: categories } = useCategoriesEquipement();

  return (
    <div className="bg-bg-card rounded-2xl p-6">
      <h2 className="text-base font-semibold mb-2">Attractions du parc</h2>
      <p className="text-dim text-xs mb-4">
        Coche les types d'attractions présents et indique les quantités. Les équipements détaillés
        seront créés à l'étape suivante.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {categories?.map((c) => {
          const existing = draft.attractions.find((a) => a.categorie_id === c.id);
          return (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                existing
                  ? 'bg-bg-deep border-nikito-cyan/40'
                  : 'bg-bg-deep border-white/[0.06]'
              )}
            >
              <input
                type="checkbox"
                checked={!!existing}
                onChange={(e) => {
                  if (e.target.checked) {
                    setDraft({
                      ...draft,
                      attractions: [
                        ...draft.attractions,
                        { categorie_id: c.id, quantite: 1, meta: {} },
                      ],
                    });
                  } else {
                    setDraft({
                      ...draft,
                      attractions: draft.attractions.filter((a) => a.categorie_id !== c.id),
                    });
                  }
                }}
                className="w-4 h-4 accent-nikito-pink"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{c.nom}</div>
                {c.norme_associee && (
                  <div className="text-[10px] text-dim truncate">{c.norme_associee}</div>
                )}
              </div>
              {existing && (
                <input
                  type="number"
                  min="1"
                  value={existing.quantite}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      attractions: draft.attractions.map((a) =>
                        a.categorie_id === c.id
                          ? { ...a, quantite: parseInt(e.target.value) || 1 }
                          : a
                      ),
                    })
                  }
                  className="w-16 bg-bg-app border border-white/10 rounded p-1.5 text-text text-xs text-center"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Étape 4 · Équipements (CRUD ou import CSV)
// ============================================================
function EtapeEquipements({ draft }: { draft: ParcDraft }) {
  return (
    <div className="bg-bg-card rounded-2xl p-6">
      <h2 className="text-base font-semibold mb-2">Équipements détaillés</h2>
      <p className="text-dim text-xs mb-4">
        D'après tes attractions, on attend{' '}
        <span className="text-nikito-cyan font-semibold">
          {draft.attractions.reduce((sum, a) => sum + a.quantite, 0)} équipements
        </span>
        . Tu peux les créer un par un ou importer un fichier CSV.
      </p>

      <div className="flex gap-3">
        <button className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-4 py-3 rounded-lg text-sm">
          ⬆ Importer CSV
        </button>
        <button className="bg-gradient-cta text-text px-4 py-3 rounded-lg text-sm font-semibold">
          + Ajouter un équipement
        </button>
      </div>

      {/* TODO · liste équipements créés + form modal */}
    </div>
  );
}

// ============================================================
// Étape 5 · Équipe
// ============================================================
function EtapeEquipe({ draft: _draft }: { draft: ParcDraft }) {
  return (
    <div className="bg-bg-card rounded-2xl p-6">
      <h2 className="text-base font-semibold mb-2">Équipe du parc</h2>
      <p className="text-dim text-xs mb-4">
        Assigne les utilisateurs qui auront accès à ce parc (manager + staff opérationnel +
        techniciens).
      </p>
      {/* TODO · sélecteur multi-utilisateurs avec rôles */}
    </div>
  );
}

// ============================================================
// Étape 6 · Mise en service (récap + activation)
// ============================================================
function EtapeMiseEnService({ draft }: { draft: ParcDraft }) {
  return (
    <div className="bg-bg-card rounded-2xl p-6">
      <h2 className="text-base font-semibold mb-4">Mise en service du parc</h2>
      <div className="bg-bg-deep rounded-lg p-4 mb-4">
        <div className="text-xs text-dim uppercase tracking-wider mb-3">Récapitulatif</div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-dim">Code · Nom</dt>
          <dd className="font-mono">
            {draft.code} · {draft.nom}
          </dd>
          <dt className="text-dim">Localisation</dt>
          <dd>
            {draft.ville} ({draft.code_postal})
          </dd>
          <dt className="text-dim">Surface</dt>
          <dd>{draft.surface_m2} m²</dd>
          <dt className="text-dim">Zones</dt>
          <dd>{draft.zones.length}</dd>
          <dt className="text-dim">Attractions</dt>
          <dd>{draft.attractions.reduce((s, a) => s + a.quantite, 0)} équipements prévus</dd>
        </dl>
      </div>
      <div className="text-xs text-dim border-l-2 border-nikito-violet pl-3 py-1">
        À l'activation, le parc sera visible dans le tableau de bord et les premiers contrôles
        quotidiens seront générés automatiquement pour demain matin.
      </div>
    </div>
  );
}

// ============================================================
// Helper Field
// ============================================================
function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
