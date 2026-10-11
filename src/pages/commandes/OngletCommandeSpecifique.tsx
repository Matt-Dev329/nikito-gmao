import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useParcCourant } from '@/hooks/useParcCourant';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useToast } from '@/components/ui/ToastProvider';
import { useCatalogueCommandes, usePasserCommandeSpecifique } from '@/hooks/queries/useCommandes';

const ROLES_MULTI_PARCS = ['direction', 'chef_maintenance', 'directeur_parc', 'admin_it'];

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

/**
 * Commande d'un article absent du catalogue. Suit le même circuit que les
 * autres commandes ; à la validation, l'article est ajouté au catalogue de
 * l'activité (catégorie « Commandes spécifiques »).
 */
export function OngletCommandeSpecifique({ onEnvoyee }: { onEnvoyee: () => void }) {
  const { utilisateur } = useAuth();
  const toast = useToast();
  const parcCourant = useParcCourant((s) => s.parc);
  const { data: tousParcs } = useParcs();
  const { data: catalogue } = useCatalogueCommandes();
  const passer = usePasserCommandeSpecifique();

  const parcs = useMemo(() => {
    const raw = (tousParcs ?? []) as Array<{ id: string; code: string; nom: string }>;
    if (utilisateur && ROLES_MULTI_PARCS.includes(utilisateur.role_code)) return raw;
    return raw.filter((p) => utilisateur?.parc_ids.includes(p.id));
  }, [tousParcs, utilisateur]);

  const [parcChoisi, setParcChoisi] = useState('');
  const parcId =
    parcChoisi || (parcCourant && parcs.some((p) => p.id === parcCourant.id) ? parcCourant.id : parcs[0]?.id) || '';
  const [activiteId, setActiviteId] = useState('');
  const [designation, setDesignation] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [unite, setUnite] = useState('unité');
  const [reference, setReference] = useState('');
  const [lien, setLien] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const lienInvalide = lien.trim() !== '' && !/^https?:\/\//i.test(lien.trim());
  const pret = !!parcId && !!activiteId && designation.trim() !== '' && quantite > 0 && !lienInvalide;

  const envoyer = async () => {
    if (!pret) return;
    try {
      const res = await passer.mutateAsync({
        parcId,
        activiteId,
        designation: designation.trim(),
        quantite,
        unite: unite.trim(),
        reference: reference.trim(),
        lien: lien.trim(),
        commentaire: commentaire.trim(),
      });
      toast.success(`Commande spécifique ${res.numero} envoyée`);
      setDesignation('');
      setQuantite(1);
      setReference('');
      setLien('');
      setCommentaire('');
      onEnvoyee();
    } catch (e) {
      toast.error(`Envoi impossible : ${(e as Error).message}`);
    }
  };

  return (
    <div className="max-w-[640px]">
      <p className="text-[13px] text-dim mb-4">
        L'article que tu cherches n'est pas dans le catalogue ? Décris-le ici. Une fois la commande validée, il sera
        ajouté au catalogue pour pouvoir le recommander facilement.
      </p>

      <div className="bg-bg-card rounded-xl border border-white/[0.06] p-4 md:p-5 grid gap-3.5">
        <div className="grid sm:grid-cols-2 gap-2.5">
          <Field label="Parc *">
            <select value={parcId} onChange={(e) => setParcChoisi(e.target.value)} className={champ}>
              {parcs.length === 0 && <option value="">Aucun parc disponible</option>}
              {parcs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Activité *">
            <select value={activiteId} onChange={(e) => setActiviteId(e.target.value)} className={champ}>
              <option value="">Choisir…</option>
              {(catalogue?.activites ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Article *">
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="Ex : Pneu slick avant 10 pouces"
            className={champ}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Quantité *">
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value) || 1))}
              className={champ}
            />
          </Field>
          <Field label="Unité">
            <input value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="unité, lot, carton…" className={champ} />
          </Field>
        </div>

        <Field label="Référence fournisseur">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Facultatif" className={champ} />
        </Field>

        <Field label="Lien vers l'article">
          <input
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            placeholder="https://… (facultatif)"
            inputMode="url"
            className={cn(champ, lienInvalide && 'border-red')}
          />
          {lienInvalide && <p className="text-red text-[11px] mt-1">Le lien doit commencer par http:// ou https://</p>}
        </Field>

        <Field label="Commentaire">
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={3}
            placeholder="Pourquoi, urgence, précision…"
            className={cn(champ, 'resize-none')}
          />
        </Field>

        <button
          onClick={envoyer}
          disabled={!pret || passer.isPending}
          className={cn(
            'bg-gradient-cta text-text px-5 py-3 rounded-[10px] text-[14px] font-bold min-h-[48px]',
            (!pret || passer.isPending) && 'opacity-40 cursor-not-allowed'
          )}
        >
          {passer.isPending ? 'Envoi…' : 'Envoyer la commande spécifique'}
        </button>
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
