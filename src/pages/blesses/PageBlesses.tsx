import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { useFiltreParc } from '@/hooks/useParcCourant';
import { useToast } from '@/components/ui/ToastProvider';
import { FiltreParcPills } from '@/components/ui/FiltreParcPills';
import { FormulaireBlesse } from '@/components/blesses/FormulaireBlesse';
import type { DeclarationBlesse } from '@/lib/blesses';
import { estManagerPrincipal } from '@/lib/acces';

const NIVEAU_CLS: Record<number, string> = {
  1: 'bg-green/15 text-green',
  2: 'bg-amber/15 text-amber',
  3: 'bg-red/15 text-red',
};

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateCourte = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR') : '—');
const ouiNon = (b: boolean | null) => (b === null ? '—' : b ? 'Oui' : 'Non');

/** Export Excel (CSV ; séparateur point-virgule, accents compris) des déclarations affichées */
function exporterRegistre(liste: DeclarationBlesse[]) {
  const entetes = [
    'Numéro', 'Parc', 'Activité', 'Emplacement', 'Date et heure', 'Niveau', 'Blessure', 'Nom', 'Prénom',
    'Date de naissance', 'Mineur', 'Adresse', 'Code postal et ville', 'Téléphone', 'Se déplace seul',
    'Secouristes', 'Heure prise en charge', 'Staff référent', 'Manager au courant', 'Prénom du manager',
    'Détails', 'Déclaré par', 'Déclaré le', 'Client appelé le', 'Client appelé par', "Résultat de l'appel",
  ];
  const lignes = liste.map((d) => [
    d.numero, d.parcs?.nom ?? '', d.activite ?? '', d.emplacement ?? '', dateHeure(d.survenu_le), d.niveau ?? '',
    d.blessure ?? '', d.victime_nom ?? '', d.victime_prenom ?? '', dateCourte(d.victime_date_naissance),
    d.est_mineur ? 'Oui' : 'Non', d.victime_adresse ?? '', d.victime_cp_ville ?? '', d.contact_telephone ?? '',
    ouiNon(d.peut_se_deplacer), ouiNon(d.secouristes), d.secouristes_heure?.slice(0, 5) ?? '', d.staff_referent ?? '',
    ouiNon(d.manager_informe), d.manager_prenom ?? '', d.circonstances ?? '', d.declare_par_nom ?? '', dateHeure(d.declare_le),
    d.client_appele_le ? dateHeure(d.client_appele_le) : d.niveau === 3 ? 'À appeler' : '',
    d.client_appele_par_nom ?? '', d.client_appel_note ?? '',
  ]);
  const csv = [entetes, ...lignes].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const lien = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = lien;
  a.download = `registre_blesses_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(lien), 60_000);
}

function useRegistreBlesses() {
  return useQuery({
    queryKey: ['declarations_blesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('declarations_blesses')
        .select('*, parcs(code, nom)')
        .is('supprime_le', null)
        .order('survenu_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeclarationBlesse[];
    },
  });
}

/** Blessés : formulaire d'accident + registre (direction, chef d'équipe, admin IT, directeurs et managers sur leurs parcs). */
export function PageBlesses() {
  const toast = useToast();
  const qc = useQueryClient();
  const { utilisateur } = useAuth();
  const { data: parcs } = useParcs();
  const { data: registre, isLoading } = useRegistreBlesses();
  const [parc, setParc] = useFiltreParc<string | null>(null, 'code');
  const [niveau, setNiveau] = useState<number | null>(null);
  const [recherche, setRecherche] = useState('');
  const [declarer, setDeclarer] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [aSupprimer, setASupprimer] = useState<DeclarationBlesse | null>(null);
  const [aValiderAppel, setAValiderAppel] = useState<DeclarationBlesse | null>(null);
  const peutSupprimer = utilisateur?.role_code === 'chef_maintenance';
  // Export Excel : directeurs et managers principaux (+ chef d'équipe, direction, admin IT)
  const peutExporter =
    ['direction', 'chef_maintenance', 'admin_it', 'directeur_parc'].includes(utilisateur?.role_code ?? '') ||
    estManagerPrincipal(utilisateur);

  const comptes = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of registre ?? []) if (d.parcs?.code) m.set(d.parcs.code, (m.get(d.parcs.code) ?? 0) + 1);
    return [...m.entries()].sort();
  }, [registre]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (registre ?? []).filter(
      (d) =>
        (!parc || d.parcs?.code === parc) &&
        (!niveau || d.niveau === niveau) &&
        (!q ||
          [d.numero, d.victime_nom, d.victime_prenom, d.blessure, d.activite, d.emplacement, d.staff_referent]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q))
    );
  }, [registre, parc, niveau, recherche]);

  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectionnes = liste.filter((d) => selection.has(d.id));
  const toutCoche = liste.length > 0 && selectionnes.length === liste.length;

  const parcsFormulaire = (parcs ?? []).map((p) => ({ id: p.id as string, code: p.code as string, nom: p.nom as string }));

  if (declarer) {
    return (
      <div className="p-4 md:p-6 md:px-7 max-w-[820px] mx-auto flex flex-col gap-4">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Formulaire d'accident</h1>
          <p className="text-[13px] text-dim mt-1">Déclaration d’un blessé. Les champs marqués * sont obligatoires.</p>
        </div>
        <FormulaireBlesse
          parcs={parcsFormulaire}
          parcInitial={parcsFormulaire.find((p) => p.code === parc)?.id ?? null}
          referentInitial={utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : ''}
          onAnnuler={() => setDeclarer(false)}
          onEnregistre={(numero) => {
            toast.success(`Déclaration ${numero} enregistrée`);
            qc.invalidateQueries({ queryKey: ['declarations_blesses'] });
            setDeclarer(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 md:px-7 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Blessés</h1>
          <p className="text-[13px] text-dim mt-1">Registre des accidents déclarés dans les parcs.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {peutExporter && (
          <button
            onClick={() => exporterRegistre(selectionnes.length ? selectionnes : liste)}
            disabled={liste.length === 0}
            className="bg-bg-card border border-white/[0.08] text-text px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px] flex-1 sm:flex-none disabled:opacity-40"
          >
            ⬇ Export Excel{selectionnes.length ? ` (${selectionnes.length})` : ''}
          </button>
          )}
          <button
            onClick={() => setDeclarer(true)}
            className="bg-gradient-cta text-text px-5 rounded-[10px] text-[13px] font-bold min-h-[44px] flex-1 sm:flex-none"
          >
            🩹 Déclarer un blessé
          </button>
        </div>
      </div>

      <FiltreParcPills parcs={comptes} actif={parc} total={registre?.length} onChange={setParc} />
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (nom, blessure, emplacement…)"
          className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 text-[13px] text-text min-h-[44px] outline-none focus:border-nikito-cyan/50"
        />
        <div className="flex gap-1.5">
          {[null, 1, 2, 3].map((n) => (
            <button
              key={String(n)}
              onClick={() => setNiveau(n)}
              className={cn(
                'px-3 min-h-[44px] rounded-[10px] text-[12px] border',
                niveau === n ? 'bg-nikito-cyan/15 border-nikito-cyan text-nikito-cyan font-semibold' : 'bg-bg-deep border-white/[0.08] text-dim'
              )}
            >
              {n ? `Niveau ${n}` : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-bg-card rounded-xl h-24 animate-pulse" />
      ) : liste.length === 0 ? (
        <div className="text-dim text-sm bg-bg-card rounded-xl p-4 border border-white/[0.06]">Aucune déclaration.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {peutExporter && (
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-dim px-1">
              <label className="flex items-center gap-2 min-h-[36px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={toutCoche}
                  onChange={() => setSelection(toutCoche ? new Set() : new Set(liste.map((d) => d.id)))}
                  className="w-5 h-5 accent-nikito-cyan"
                />
                Tout sélectionner
              </label>
              <span>
                {selectionnes.length
                  ? `${selectionnes.length} sélectionnée${selectionnes.length > 1 ? 's' : ''} pour l’export`
                  : 'Coche des déclarations pour n’exporter qu’elles (sinon : toute la liste affichée)'}
              </span>
              {selectionnes.length > 0 && (
                <button onClick={() => setSelection(new Set())} className="text-nikito-cyan underline">
                  Vider la sélection
                </button>
              )}
            </div>
          )}
          {liste.map((d) => (
            <div key={d.id} className={cn('bg-bg-card rounded-xl border flex', selection.has(d.id) ? 'border-nikito-cyan/50' : 'border-white/[0.06]')}>
              {peutExporter && (
                <label className="pl-4 pt-3.5 cursor-pointer" aria-label={`Sélectionner ${d.numero}`}>
                  <input type="checkbox" checked={selection.has(d.id)} onChange={() => basculer(d.id)} className="w-5 h-5 accent-nikito-cyan" />
                </label>
              )}
              <div className="flex-1 min-w-0">
              <button onClick={() => setOuvert(ouvert === d.id ? null : d.id)} className="w-full text-left px-4 py-3 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  {d.niveau && (
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md', NIVEAU_CLS[d.niveau])}>Niveau {d.niveau}</span>
                  )}
                  <strong>{d.numero}</strong>
                  <span className="text-nikito-cyan font-semibold">{d.parcs?.code}</span>
                  <span>{d.activite}</span>
                  {d.est_mineur && <span className="text-[11px] bg-amber/15 text-amber px-2 py-0.5 rounded-md">Mineur</span>}
                  {d.niveau === 3 &&
                    (d.client_appele_le ? (
                      <span className="text-[11px] bg-green/15 text-green px-2 py-0.5 rounded-md">📞 Client appelé</span>
                    ) : (
                      <span className="text-[11px] font-semibold bg-red/15 text-red px-2 py-0.5 rounded-md">📞 Client à appeler</span>
                    ))}
                  <span className="text-dim text-[12px] ml-auto">{dateHeure(d.survenu_le)}</span>
                </div>
                <div className="text-[13px]">
                  {d.victime_prenom} {d.victime_nom} · {d.blessure}
                </div>
                <div className="text-[12px] text-dim">{d.emplacement}</div>
              </button>
              {ouvert === d.id && (
                <div className="px-4 pb-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-[13px] border-t border-white/[0.06] pt-3">
                  {d.niveau === 3 && (
                    <div
                      className={cn(
                        'sm:col-span-2 mb-2 rounded-[10px] border px-3 py-2.5 flex flex-wrap items-center gap-3',
                        d.client_appele_le ? 'border-green/30 bg-green/[0.06]' : 'border-red/40 bg-red/[0.06]'
                      )}
                    >
                      {d.client_appele_le ? (
                        <div className="text-[13px]">
                          <strong className="text-green">📞 Client appelé</strong> le {dateHeure(d.client_appele_le)}
                          {d.client_appele_par_nom ? ` par ${d.client_appele_par_nom}` : ''}
                          {d.client_appel_note && <div className="text-dim whitespace-pre-wrap mt-0.5">{d.client_appel_note}</div>}
                        </div>
                      ) : (
                        <>
                          <div className="text-[13px] flex-1 min-w-[200px]">
                            <strong className="text-red">📞 Client à appeler</strong>
                            <div className="text-[12px] text-dim">
                              Téléphone : {d.contact_telephone || '—'} · rappel envoyé tous les 3 jours tant que ce n'est pas validé
                            </div>
                          </div>
                          <button
                            onClick={() => setAValiderAppel(d)}
                            className="px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-green/20 text-green border border-green/40"
                          >
                            ✓ Client appelé
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <Info k="Se déplace seul" v={d.peut_se_deplacer === false ? 'Non, intervention sur la structure' : ouiNon(d.peut_se_deplacer)} />
                  <Info k="Date de naissance" v={dateCourte(d.victime_date_naissance)} />
                  <Info k="Adresse" v={[d.victime_adresse, d.victime_cp_ville].filter(Boolean).join(', ')} />
                  <Info k="Téléphone" v={d.contact_telephone} />
                  <Info k="Secouristes" v={d.secouristes ? `Oui${d.secouristes_heure ? ` · pris en charge à ${d.secouristes_heure.slice(0, 5)}` : ''}` : ouiNon(d.secouristes)} />
                  <Info k="Staff référent" v={d.staff_referent} />
                  <Info k="Manager au courant" v={d.manager_informe ? `Oui · ${d.manager_prenom ?? ''}` : ouiNon(d.manager_informe)} />
                  <Info k="Déclaré par" v={`${d.declare_par_nom ?? '—'} · ${dateHeure(d.declare_le)}`} />
                  {d.circonstances && (
                    <div className="sm:col-span-2 mt-1">
                      <div className="text-dim text-[12px]">Détails</div>
                      <div className="whitespace-pre-wrap">{d.circonstances}</div>
                    </div>
                  )}
                  {peutSupprimer && (
                    <div className="sm:col-span-2 mt-2">
                      <button
                        onClick={() => setASupprimer(d)}
                        className="px-3 min-h-[40px] rounded-[10px] text-[12px] font-semibold border border-red/40 text-red"
                      >
                        Supprimer la déclaration
                      </button>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>
      )}

      {aValiderAppel && (
        <ModaleAppelClient
          declaration={aValiderAppel}
          onClose={() => setAValiderAppel(null)}
          onValide={() => {
            setAValiderAppel(null);
            qc.invalidateQueries({ queryKey: ['declarations_blesses'] });
          }}
        />
      )}

      {aSupprimer && (
        <ModaleSupprimerBlesse
          declaration={aSupprimer}
          onClose={() => setASupprimer(null)}
          onSupprime={() => {
            setSelection((s) => {
              const n = new Set(s);
              n.delete(aSupprimer.id);
              return n;
            });
            setASupprimer(null);
            qc.invalidateQueries({ queryKey: ['declarations_blesses'] });
          }}
        />
      )}
    </div>
  );
}

/** Suppression d'une déclaration (chef d'équipe), motif obligatoire — elle est masquée, pas effacée */
function ModaleSupprimerBlesse({
  declaration,
  onClose,
  onSupprime,
}: {
  declaration: DeclarationBlesse;
  onClose: () => void;
  onSupprime: () => void;
}) {
  const toast = useToast();
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const supprimer = async () => {
    setEnvoi(true);
    const { error } = await supabase.rpc('supprimer_blesse', { p_id: declaration.id, p_motif: motif });
    setEnvoi(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Déclaration ${declaration.numero} supprimée`);
    onSupprime();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[440px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-red/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[16px] font-bold">Supprimer {declaration.numero} ?</div>
          <div className="text-[12px] text-dim">
            {declaration.victime_prenom} {declaration.victime_nom} · {declaration.parcs?.nom} · {dateHeure(declaration.survenu_le)}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Motif (obligatoire)</span>
          <input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : doublon, déclaration de test, erreur de saisie"
            className="bg-bg-app border border-white/10 rounded-lg px-3 min-h-[44px] text-[14px]"
            autoFocus
          />
        </label>
        <div className="text-[11px] text-dim">La déclaration disparaît du registre et des exports (elle reste archivée en base).</div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 min-h-[44px] rounded-[10px] text-[13px] text-dim">
            Annuler
          </button>
          <button
            onClick={supprimer}
            disabled={motif.trim().length < 3 || envoi}
            className="px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-red/20 text-red border border-red/40 disabled:opacity-40"
          >
            {envoi ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Niveau 3 : valider que le client a été appelé (arrête les rappels tous les 3 jours) */
function ModaleAppelClient({
  declaration,
  onClose,
  onValide,
}: {
  declaration: DeclarationBlesse;
  onClose: () => void;
  onValide: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const valider = async () => {
    setEnvoi(true);
    const { error } = await supabase.rpc('valider_appel_client_blesse', { p_id: declaration.id, p_note: note });
    setEnvoi(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${declaration.numero} : appel du client validé, plus de rappel`);
    onValide();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-[440px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-green/30 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[16px] font-bold">📞 Client appelé · {declaration.numero}</div>
          <div className="text-[12px] text-dim">
            {declaration.victime_prenom} {declaration.victime_nom} · {declaration.contact_telephone || 'pas de téléphone'} ·{' '}
            {declaration.parcs?.nom}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-dim">Résultat de l'appel (facultatif)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. : va mieux, plâtre 3 semaines, pas de suite à donner"
            className="bg-bg-app border border-white/10 rounded-lg px-3 py-2 text-[14px]"
            autoFocus
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 min-h-[44px] rounded-[10px] text-[13px] text-dim">
            Annuler
          </button>
          <button
            onClick={valider}
            disabled={envoi}
            className="px-4 min-h-[44px] rounded-[10px] text-[13px] font-bold bg-green/20 text-green border border-green/40 disabled:opacity-40"
          >
            {envoi ? 'Validation…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <span className="text-dim text-[12px]">{k} : </span>
      {v || '—'}
    </div>
  );
}
