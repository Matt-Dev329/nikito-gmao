import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParcs, useEquipements } from '@/hooks/queries/useReferentiel';
import { useCreerPlainte } from './usePlaintesQueries';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'service', label: 'Service' },
  { value: 'proprete', label: 'Proprete' },
  { value: 'autre', label: 'Autre' },
];

interface Props {
  onClose: () => void;
}

export function ModaleCreerPlainte({ onClose }: Props) {
  const creer = useCreerPlainte();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const [parcId, setParcId] = useState('');
  const { data: equipements } = useEquipements(parcId || undefined);

  const [clientNom, setClientNom] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [dateVisite, setDateVisite] = useState('');
  const [noteGlobale, setNoteGlobale] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [categorie, setCategorie] = useState('maintenance');
  const [priorite, setPriorite] = useState('normale');
  const [equipementId, setEquipementId] = useState('');

  const submit = async () => {
    if (!parcId) return;
    await creer.mutateAsync({
      parc_id: parcId,
      equipement_id: equipementId || null,
      commentaire: commentaire.trim() || null,
      saisi_par_id: utilisateur?.id ?? null,
      client_nom: clientNom.trim() || null,
      client_email: clientEmail.trim() || null,
      client_telephone: clientTel.trim() || null,
      date_visite: dateVisite || null,
      note_globale: noteGlobale || null,
      categorie,
      priorite,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Clients</div>
            <div className="text-[19px] font-semibold mt-0.5">Enregistrer une plainte</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">&times;</button>
        </div>

        <div className="grid gap-3.5 mb-5">
          <Field label="Parc *">
            <select
              value={parcId}
              onChange={(e) => { setParcId(e.target.value); setEquipementId(''); }}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
            >
              <option value="">Selectionner un parc</option>
              {parcs?.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Nom du client">
              <input
                type="text"
                value={clientNom}
                onChange={(e) => setClientNom(e.target.value)}
                placeholder="Nom du client"
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
              />
            </Field>
            <Field label="Date de visite">
              <input
                type="date"
                value={dateVisite}
                onChange={(e) => setDateVisite(e.target.value)}
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Email (optionnel)">
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
              />
            </Field>
            <Field label="Telephone (optionnel)">
              <input
                type="tel"
                value={clientTel}
                onChange={(e) => setClientTel(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
              />
            </Field>
          </div>

          <Field label="Note globale">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNoteGlobale(n)}
                  className={cn(
                    'w-10 h-10 rounded-lg text-lg transition-colors',
                    n <= noteGlobale
                      ? 'bg-amber/20 text-amber'
                      : 'bg-bg-deep text-faint hover:text-dim'
                  )}
                >
                  {n <= noteGlobale ? '\u2605' : '\u2606'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Commentaire">
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              placeholder="Description de la plainte..."
              className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[80px]"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Categorie">
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Priorite">
              <select
                value={priorite}
                onChange={(e) => setPriorite(e.target.value)}
                className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]"
              >
                <option value="critique">Critique</option>
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
              </select>
            </Field>
          </div>

          <Field label="Equipement concerne (optionnel)">
            <select
              value={equipementId}
              onChange={(e) => setEquipementId(e.target.value)}
              disabled={!parcId}
              className={cn(
                'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]',
                !parcId && 'opacity-40'
              )}
            >
              <option value="">Aucun</option>
              {(equipements ?? []).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
            </select>
          </Field>
        </div>

        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">
            Erreur : {(creer.error as Error).message}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button
            onClick={submit}
            disabled={!parcId || creer.isPending}
            className={cn(
              'bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
              (!parcId || creer.isPending) && 'opacity-40 cursor-not-allowed'
            )}
          >
            {creer.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-dim uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}
