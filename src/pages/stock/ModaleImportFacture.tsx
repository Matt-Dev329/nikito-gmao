import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCatalogueCommandes } from '@/hooks/queries/useCommandes';
import { useToast } from '@/components/ui/ToastProvider';

interface LigneFacture {
  reference: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number | null;
  activite_id: string;
  categorie: string;
  ajouter_catalogue: boolean;
  ajouter_stock: boolean;
}

interface EnteteFacture {
  fournisseur: string | null;
  fournisseur_connu: boolean;
  numero: string | null;
  date_facture: string | null;
  total_ht: number | null;
  total_ttc: number | null;
}

const BUCKET = 'alba-factures';
const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-lg px-2.5 py-2 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[40px]';

const euros = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);

/**
 * Import d'une facture fournisseur : lecture automatique, relecture des
 * lignes, ajout au catalogue et — au choix — entrée en stock.
 */
export function ModaleImportFacture({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const { data: catalogue } = useCatalogueCommandes();
  const activites = catalogue?.activites ?? [];

  const [etape, setEtape] = useState<'fichier' | 'lecture' | 'relecture'>('fichier');
  const [factureId, setFactureId] = useState<string | null>(null);
  const [entete, setEntete] = useState<EnteteFacture | null>(null);
  const [lignes, setLignes] = useState<LigneFacture[]>([]);
  const [choixStock, setChoixStock] = useState<boolean | null>(null);
  const [enCours, setEnCours] = useState(false);

  const lire = async (fichier: File) => {
    if (fichier.size > 22 * 1024 * 1024) {
      toast.error('Facture trop lourde (22 Mo maximum)');
      return;
    }
    setEtape('lecture');
    try {
      const nom = fichier.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-60);
      const chemin = `${new Date().getFullYear()}/${crypto.randomUUID()}_${nom}`;
      const { error: errUp } = await supabase.storage.from(BUCKET).upload(chemin, fichier, { contentType: fichier.type || 'application/pdf' });
      if (errUp) throw errUp;
      const { data: facture, error: errIns } = await supabase
        .from('factures_stock')
        .insert({ fichier: chemin, mime: fichier.type || null, taille: fichier.size, cree_par_id: utilisateur?.id ?? null })
        .select('id')
        .single();
      if (errIns) throw errIns;
      setFactureId(facture.id);

      const { data, error } = await supabase.functions.invoke('extraire-facture', { body: { facture_id: facture.id } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? 'Lecture impossible');
      setEntete(data.facture as EnteteFacture);
      setLignes(
        (data.lignes as Array<Record<string, unknown>>).map((l) => ({
          reference: (l.reference as string) ?? '',
          designation: (l.designation as string) ?? '',
          quantite: Math.max(1, Math.round(Number(l.quantite ?? 1))),
          prix_unitaire_ht: l.prix_unitaire_ht == null ? null : Number(l.prix_unitaire_ht),
          activite_id: (l.activite_id as string) ?? '',
          categorie: (l.categorie as string) ?? '',
          ajouter_catalogue: true,
          ajouter_stock: false,
        }))
      );
      setEtape('relecture');
    } catch (e) {
      toast.error(`Facture non lue : ${(e as Error).message}`);
      setEtape('fichier');
    }
  };

  const modifier = (i: number, champs: Partial<LigneFacture>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...champs } : l)));

  const repondreStock = (oui: boolean) => {
    setChoixStock(oui);
    setLignes((ls) => ls.map((l) => ({ ...l, ajouter_stock: oui })));
  };

  const sansActivite = lignes.filter((l) => l.ajouter_catalogue && !l.activite_id).length;

  const integrer = async () => {
    if (!factureId) return;
    if (sansActivite > 0) {
      toast.error(`Choisis l’activité de ${sansActivite} ligne(s) à mettre au catalogue (ou décoche « Catalogue »)`);
      return;
    }
    setEnCours(true);
    const { data, error } = await supabase.rpc('integrer_facture', {
      p_facture_id: factureId,
      p_lignes: lignes.map((l) => ({ ...l, prix_unitaire_ht: l.prix_unitaire_ht ?? '' })),
    });
    setEnCours(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = data as { catalogue: number; stock: number };
    toast.success(`Facture intégrée : ${r.catalogue} pièce(s) au catalogue, ${r.stock} entrée(s) en stock`);
    qc.invalidateQueries({ queryKey: ['pieces_detachees'] });
    qc.invalidateQueries({ queryKey: ['commandes', 'catalogue'] });
    qc.invalidateQueries({ queryKey: ['factures-stock'] });
    onClose();
  };

  const abandonner = async () => {
    if (factureId && etape === 'relecture') await supabase.from('factures_stock').update({ statut: 'abandonnee' }).eq('id', factureId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[880px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 max-h-[94vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Stock · catalogue</div>
            <div className="text-[17px] font-semibold mt-0.5">Importer une facture</div>
          </div>
          <button
            onClick={abandonner}
            className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        {etape === 'fichier' && (
          <div className="grid gap-3">
            <p className="text-[13px] text-dim">
              Prends en photo ou choisis la facture (PDF ou image). Les pièces, références et prix sont lus automatiquement ; tu
              vérifies tout avant l’ajout.
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] flex items-center cursor-pointer">
                📷 Photo de la facture
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && lire(e.target.files[0])} />
              </label>
              <label className="bg-bg-deep border border-nikito-cyan/40 text-nikito-cyan px-5 rounded-[10px] text-[13px] font-semibold min-h-[44px] flex items-center cursor-pointer">
                📄 Fichier PDF / image
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && lire(e.target.files[0])} />
              </label>
            </div>
          </div>
        )}

        {etape === 'lecture' && (
          <div className="py-12 text-center text-dim text-[13px] animate-pulse">Lecture de la facture… (jusqu’à une minute)</div>
        )}

        {etape === 'relecture' && entete && (
          <>
            <div className="bg-bg-deep rounded-xl p-3 mb-3 text-[13px] grid sm:grid-cols-4 gap-2">
              <div>
                <div className="text-[11px] text-dim">Fournisseur</div>
                {entete.fournisseur ?? '—'}
                {entete.fournisseur && !entete.fournisseur_connu && <span className="text-[11px] text-amber"> (nouveau)</span>}
              </div>
              <div>
                <div className="text-[11px] text-dim">Facture</div>
                {entete.numero ?? '—'}
              </div>
              <div>
                <div className="text-[11px] text-dim">Date</div>
                {entete.date_facture ? new Date(entete.date_facture).toLocaleDateString('fr-FR') : '—'}
              </div>
              <div>
                <div className="text-[11px] text-dim">Total HT</div>
                {euros(entete.total_ht)}
              </div>
            </div>

            {/* La question : stock ou pas */}
            <div className={cn('rounded-xl p-3 mb-3 border', choixStock === null ? 'border-amber/40 bg-amber/[0.06]' : 'border-white/[0.06]')}>
              <div className="text-[13px] font-semibold mb-2">Veux-tu ajouter ces pièces au stock ?</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => repondreStock(true)}
                  className={cn(
                    'px-4 rounded-[10px] text-[13px] font-semibold min-h-[40px] border',
                    choixStock === true ? 'bg-green/15 border-green/50 text-green' : 'bg-bg-deep border-white/[0.08]'
                  )}
                >
                  Oui, ajouter au stock
                </button>
                <button
                  onClick={() => repondreStock(false)}
                  className={cn(
                    'px-4 rounded-[10px] text-[13px] font-semibold min-h-[40px] border',
                    choixStock === false ? 'bg-nikito-cyan/15 border-nikito-cyan/50 text-nikito-cyan' : 'bg-bg-deep border-white/[0.08]'
                  )}
                >
                  Non, catalogue seulement
                </button>
              </div>
              <div className="text-[11px] text-faint mt-1.5">Tu peux aussi choisir ligne par ligne ci-dessous.</div>
            </div>

            <div className="flex-1 overflow-y-auto grid gap-2 mb-3 pr-1">
              {lignes.length === 0 && <div className="text-[13px] text-dim text-center py-6">Aucune pièce trouvée sur cette facture.</div>}
              {lignes.map((l, i) => (
                <div key={i} className="bg-bg-deep/60 border border-white/[0.06] rounded-xl p-3 grid gap-2">
                  <div className="grid sm:grid-cols-[1fr_140px] gap-2">
                    <input value={l.designation} onChange={(e) => modifier(i, { designation: e.target.value })} className={champ} aria-label="Désignation" />
                    <input value={l.reference} onChange={(e) => modifier(i, { reference: e.target.value })} placeholder="Référence" className={cn(champ, 'font-mono')} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-[90px_120px_1fr_1fr] gap-2">
                    <label className="grid gap-0.5">
                      <span className="text-[10px] text-dim">Quantité</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={l.quantite}
                        onChange={(e) => modifier(i, { quantite: Math.max(1, Number(e.target.value) || 1) })}
                        className={champ}
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] text-dim">Prix unitaire HT</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={l.prix_unitaire_ht ?? ''}
                        onChange={(e) => modifier(i, { prix_unitaire_ht: e.target.value === '' ? null : Number(e.target.value) })}
                        className={champ}
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] text-dim">Activité (catalogue)</span>
                      <select
                        value={l.activite_id}
                        onChange={(e) => modifier(i, { activite_id: e.target.value })}
                        className={cn(champ, l.ajouter_catalogue && !l.activite_id && 'border-amber/60')}
                      >
                        <option value="">Choisir…</option>
                        {activites.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nom}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[10px] text-dim">Catégorie</span>
                      <input value={l.categorie} onChange={(e) => modifier(i, { categorie: e.target.value })} placeholder="ex. Requilleuse" className={champ} />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[12px]">
                    <label className="flex items-center gap-1.5 min-h-[32px]">
                      <input type="checkbox" checked={l.ajouter_catalogue} onChange={(e) => modifier(i, { ajouter_catalogue: e.target.checked })} />
                      Catalogue
                    </label>
                    <label className="flex items-center gap-1.5 min-h-[32px]">
                      <input type="checkbox" checked={l.ajouter_stock} onChange={(e) => modifier(i, { ajouter_stock: e.target.checked })} />
                      Stock (+{l.quantite})
                    </label>
                    <button onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} className="text-red ml-auto min-h-[32px]">
                      Retirer la ligne
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={abandonner} className="text-dim text-[13px] px-3 min-h-[44px]">
                Abandonner
              </button>
              <button
                onClick={integrer}
                disabled={enCours || lignes.length === 0 || choixStock === null}
                className={cn(
                  'bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px]',
                  (enCours || lignes.length === 0 || choixStock === null) && 'opacity-40'
                )}
              >
                {enCours ? 'Intégration…' : choixStock === null ? 'Réponds à la question stock' : 'Valider la facture'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
