import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useParc } from '@/hooks/queries/useReferentiel';
import { supabase } from '@/lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================
// Page Notes chantier d'un parc · accessible :
//   - Pendant le wizard création (étape dédiée)
//   - Après activation, depuis la fiche parc (onglet permanent)
//
// Catégories : chantier_initial, travaux, audit, reunion_fournisseur,
//              reglementaire, autre
// ============================================================

type Categorie =
  | 'chantier_initial'
  | 'travaux'
  | 'audit'
  | 'reunion_fournisseur'
  | 'reglementaire'
  | 'autre';

const categorieLabels: Record<Categorie, string> = {
  chantier_initial: 'Chantier initial',
  travaux: 'Travaux',
  audit: 'Audit',
  reunion_fournisseur: 'Réunion fournisseur',
  reglementaire: 'Réglementaire',
  autre: 'Autre',
};

const categorieColors: Record<Categorie, string> = {
  chantier_initial: 'text-nikito-pink bg-nikito-pink/15 border-nikito-pink/30',
  travaux: 'text-amber bg-amber/15 border-amber/30',
  audit: 'text-nikito-violet bg-nikito-violet/15 border-nikito-violet/30',
  reunion_fournisseur: 'text-nikito-cyan bg-nikito-cyan/15 border-nikito-cyan/30',
  reglementaire: 'text-red bg-red/15 border-red/30',
  autre: 'text-dim bg-bg-deep border-white/10',
};

export function NotesChantierParc() {
  const { id: parcId } = useParams<{ id: string }>();
  const { data: parc } = useParc(parcId);
  const [filtreCategorie, setFiltreCategorie] = useState<Categorie | null>(null);
  const [editeurOuvert, setEditeurOuvert] = useState(false);

  const { data: notes } = useQuery({
    queryKey: ['notes_chantier', parcId, filtreCategorie],
    queryFn: async () => {
      if (!parcId) return [];
      let q = supabase
        .from('notes_chantier')
        .select('*, utilisateurs!cree_par_id(prenom, nom)')
        .eq('parc_id', parcId)
        .order('date_reunion', { ascending: false });
      if (filtreCategorie) q = q.eq('categorie', filtreCategorie);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!parcId,
  });

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <div className="text-[11px] text-dim mb-1">{parc?.code} · {parc?.nom}</div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Notes de chantier</h1>
          <div className="text-[13px] text-dim mt-1">
            Décisions, comptes-rendus, audits · historique permanent
          </div>
        </div>
        <button
          onClick={() => setEditeurOuvert(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center sm:justify-start"
        >
          <span className="text-base">+</span> Nouvelle note
        </button>
      </div>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        <button
          onClick={() => setFiltreCategorie(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-[11px] font-semibold border min-h-[44px] md:min-h-0',
            filtreCategorie === null
              ? 'bg-text text-bg-app border-text'
              : 'bg-bg-card text-dim border-white/[0.08]'
          )}
        >
          Toutes ({notes?.length ?? 0})
        </button>
        {(Object.keys(categorieLabels) as Categorie[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltreCategorie(cat)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-semibold border min-h-[44px] md:min-h-0',
              filtreCategorie === cat ? categorieColors[cat] : 'bg-bg-card text-dim border-white/[0.08]'
            )}
          >
            {categorieLabels[cat]}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-3">
        {notes?.length === 0 && (
          <div className="bg-bg-card rounded-2xl p-12 text-center text-dim text-sm">
            Aucune note pour ce parc.
            <br />
            <span className="text-xs">
              Crée la première note pour démarrer l'historique.
            </span>
          </div>
        )}

        {notes?.map((n) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const note = n as any;
          const cat = note.categorie as Categorie;
          return (
            <div key={note.id} className="bg-bg-card rounded-2xl p-4 md:p-5 md:px-6">
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-semibold border',
                        categorieColors[cat]
                      )}
                    >
                      {categorieLabels[cat]}
                    </span>
                    <span className="text-[11px] text-dim">
                      {new Date(note.date_reunion).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="text-base font-semibold">{note.titre}</div>
                </div>
                <button className="text-dim hover:text-nikito-cyan text-base min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0">✎</button>
              </div>

              {note.participants?.length > 0 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {note.participants.map((p: string, i: number) => (
                    <span
                      key={i}
                      className="bg-bg-deep text-dim px-2 py-0.5 rounded-md text-[10px]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}

              {/* Aperçu contenu (3 lignes max) */}
              <div className="text-[13px] text-text leading-relaxed line-clamp-3 mb-3 whitespace-pre-wrap">
                {note.contenu_md}
              </div>

              {note.decisions?.length > 0 && (
                <div className="bg-bg-deep rounded-lg p-3 mb-3">
                  <div className="text-[10px] text-dim uppercase tracking-wider mb-1.5">
                    Décisions ({note.decisions.length})
                  </div>
                  <ul className="text-xs space-y-1">
                    {note.decisions.slice(0, 3).map((d: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green flex-shrink-0">✓</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {note.pieces_jointes?.length > 0 && (
                <div className="text-[11px] text-dim">
                  📎 {note.pieces_jointes.length} pièce(s) jointe(s)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editeurOuvert && parcId && (
        <EditeurNoteChantier
          parcId={parcId}
          onClose={() => setEditeurOuvert(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Éditeur de note (modale)
// ============================================================
function EditeurNoteChantier({ parcId, onClose }: { parcId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categorie, setCategorie] = useState<Categorie>('autre');
  const [participants, setParticipants] = useState('');
  const [contenu, setContenu] = useState('');
  const [decisionsTxt, setDecisionsTxt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const enregistrer = async () => {
    setSubmitting(true);
    const { error } = await supabase.from('notes_chantier').insert({
      parc_id: parcId,
      titre,
      date_reunion: date,
      categorie,
      participants: participants
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      contenu_md: contenu,
      decisions: decisionsTxt
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['notes_chantier', parcId] });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[720px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-violet/20 p-5 md:p-6 md:px-[26px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Nouvelle note</div>
            <div className="text-[19px] font-semibold mt-0.5">Compte-rendu de réunion</div>
          </div>
          <button
            onClick={onClose}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3.5 mb-3.5">
          <div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
              Titre de la réunion
            </label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Validation lot trampolines avec CHROMATIK"
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </div>
          <div>
            <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
            />
          </div>
        </div>

        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Catégorie
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {(Object.keys(categorieLabels) as Categorie[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategorie(cat)}
                className={cn(
                  'py-2 px-2 rounded-lg text-[11px] font-semibold border',
                  categorie === cat ? categorieColors[cat] : 'bg-bg-deep text-dim border-white/[0.08]'
                )}
              >
                {categorieLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Participants <span className="text-dim normal-case font-normal">(séparés par virgule)</span>
          </label>
          <input
            type="text"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="Matthieu, Ryad, Eric (CHROMATIK), Sophie"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan"
          />
        </div>

        <div className="mb-3.5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Contenu <span className="text-dim normal-case font-normal">(markdown supporté)</span>
          </label>
          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            rows={8}
            placeholder="Compte-rendu détaillé de la réunion..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y font-mono"
          />
        </div>

        <div className="mb-5">
          <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">
            Décisions prises <span className="text-dim normal-case font-normal">(une par ligne)</span>
          </label>
          <textarea
            value={decisionsTxt}
            onChange={(e) => setDecisionsTxt(e.target.value)}
            rows={4}
            placeholder="Validation modèle X42&#10;Livraison fixée au 15/05&#10;Garantie étendue à 24 mois"
            className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y"
          />
        </div>

        {/* TODO Bolt · ajout pièces jointes (PDF, photos) via Supabase Storage */}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            onClick={onClose}
            className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]"
          >
            Annuler
          </button>
          <button
            onClick={enregistrer}
            disabled={!titre || !contenu || submitting}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!titre || !contenu || submitting) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer la note'}
          </button>
        </div>
      </div>
    </div>
  );
}
