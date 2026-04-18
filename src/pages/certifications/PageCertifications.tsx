import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useParcs, useEquipements } from '@/hooks/queries/useReferentiel';
import { useFormationFilter } from '@/hooks/useFormation';
import { Card } from '@/components/ui/Card';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/utils';
import type { CertificationAvecJoins } from '@/types/database';

type FiltreStatut = 'tous' | 'valide' | 'expire_bientot' | 'expire';

function useCertifications() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['certifications', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certifications')
        .select('*, equipements(code, libelle, parc_id, parcs(code, nom))')
        .eq('est_formation', estFormation)
        .order('prochaine_echeance');
      if (error) throw error;
      return (data ?? []) as CertificationAvecJoins[];
    },
  });
}

function useCreerCertification() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (payload: {
      equipement_id: string;
      norme: string;
      organisme_certificateur?: string | null;
      numero_certificat?: string | null;
      date_certif: string;
      prochaine_echeance: string;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('certifications')
        .insert({ ...payload, est_formation: estFormation })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certifications'] });
    },
  });
}

function getStatutCertif(c: CertificationAvecJoins): 'valide' | 'expire_bientot' | 'expire' {
  const today = new Date();
  const echeance = new Date(c.prochaine_echeance);
  if (echeance < today) return 'expire';
  const dans30j = new Date(today.getTime() + 30 * 86400000);
  if (echeance < dans30j) return 'expire_bientot';
  return 'valide';
}

const STATUT_BADGE = {
  valide: { label: 'Valide', cls: 'bg-green/15 text-green' },
  expire_bientot: { label: 'Expire bientot', cls: 'bg-amber/15 text-amber' },
  expire: { label: 'Expire', cls: 'bg-red/15 text-red' },
};

export function PageCertifications() {
  const { data: certifications, isLoading } = useCertifications();
  const { data: parcs } = useParcs();
  const [parcFilter, setParcFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState<FiltreStatut>('tous');
  const [recherche, setRecherche] = useState('');
  const [modaleCreer, setModaleCreer] = useState(false);

  const enrichies = useMemo(() => {
    return (certifications ?? []).map((c) => ({ ...c, _statut: getStatutCertif(c) }));
  }, [certifications]);

  const filtrees = useMemo(() => {
    let result = enrichies;
    if (parcFilter) result = result.filter((c) => c.equipements?.parc_id === parcFilter);
    if (statutFilter !== 'tous') result = result.filter((c) => c._statut === statutFilter);
    if (recherche.trim()) {
      const q = recherche.toLowerCase();
      result = result.filter((c) =>
        [c.norme, c.organisme_certificateur, c.equipements?.code, c.equipements?.libelle]
          .filter(Boolean).join(' ').toLowerCase().includes(q)
      );
    }
    return result;
  }, [enrichies, parcFilter, statutFilter, recherche]);

  const compteurs = useMemo(() => ({
    total: enrichies.length,
    valide: enrichies.filter((c) => c._statut === 'valide').length,
    bientot: enrichies.filter((c) => c._statut === 'expire_bientot').length,
    expire: enrichies.filter((c) => c._statut === 'expire').length,
  }), [enrichies]);

  return (
    <div className="p-4 md:p-6 md:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-5">
        <div>
          <h1 className="text-xl md:text-[22px] font-semibold m-0">Certifications & normes</h1>
          <p className="text-[13px] text-dim mt-1">
            Controles reglementaires obligatoires
          </p>
        </div>
        <button
          onClick={() => setModaleCreer(true)}
          className="bg-gradient-cta text-text px-5 py-2.5 rounded-[10px] text-[13px] font-bold flex items-center gap-2 min-h-[44px] w-full sm:w-auto justify-center"
        >
          <span className="text-base leading-none">+</span> Ajouter
        </button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Compteur label="Total" value={compteurs.total} />
        <Compteur label="Valide" value={compteurs.valide} color="green" />
        <Compteur label="Bientot" value={compteurs.bientot} color="amber" />
        <Compteur label="Expire" value={compteurs.expire} color="red" />
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (norme, organisme, equipement)..."
            className="flex-1 bg-bg-deep border border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-text placeholder:text-faint outline-none focus:border-nikito-cyan/50 min-h-[44px]"
          />
          <select
            value={parcFilter}
            onChange={(e) => setParcFilter(e.target.value)}
            className="bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 px-3.5 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px] sm:w-[200px]"
          >
            <option value="">Tous les parcs</option>
            {parcs?.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-px">
          {(['tous', 'valide', 'expire_bientot', 'expire'] as FiltreStatut[]).map((v) => (
            <Pill key={v} active={statutFilter === v} variant="cyan" onClick={() => setStatutFilter(v)} className="min-h-[36px]">
              {v === 'tous' ? 'Tous' : v === 'valide' ? 'Valide' : v === 'expire_bientot' ? 'Expire bientot' : 'Expire'}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtrees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dim text-sm">Aucune certification.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtrees.map((c) => {
            const badge = STATUT_BADGE[c._statut];
            const dateCertif = new Date(c.date_certif).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            const echeance = new Date(c.prochaine_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <Card
                key={c.id}
                borderLeft={c._statut === 'expire' ? 'red' : c._statut === 'expire_bientot' ? 'amber' : undefined}
                className="p-4 px-[18px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md', badge.cls)}>
                        {badge.label}
                      </span>
                      {c.organisme_certificateur && (
                        <span className="text-[10px] text-dim bg-bg-deep px-2 py-0.5 rounded">
                          {c.organisme_certificateur}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] font-medium leading-snug">{c.norme}</p>
                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-dim mt-1">
                      {c.equipements && (
                        <span>
                          <span className="text-nikito-cyan font-mono mr-1">{c.equipements.code}</span>
                          {c.equipements.libelle}
                        </span>
                      )}
                      <span>{c.equipements?.parcs?.nom}</span>
                      {c.numero_certificat && <span className="font-mono">{c.numero_certificat}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-dim mt-1.5">
                      <span>Certifie : {dateCertif}</span>
                      <span className={cn(c._statut === 'expire' && 'text-red font-medium', c._statut === 'expire_bientot' && 'text-amber font-medium')}>
                        Echeance : {echeance}
                      </span>
                    </div>
                    {c.notes && (
                      <p className="text-[11px] text-dim mt-1.5 italic">{c.notes}</p>
                    )}
                  </div>
                  {c.document_pdf_url && (
                    <a
                      href={c.document_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-nikito-cyan text-[11px] font-medium bg-nikito-cyan/10 border border-nikito-cyan/20 px-3 py-2 rounded-[10px] min-h-[44px] flex items-center whitespace-nowrap hover:bg-nikito-cyan/20"
                    >
                      Voir PDF
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modaleCreer && <ModaleCreerCertification onClose={() => setModaleCreer(false)} />}
    </div>
  );
}

function ModaleCreerCertification({ onClose }: { onClose: () => void }) {
  const creer = useCreerCertification();
  const { data: parcs } = useParcs();
  const [parcId, setParcId] = useState('');
  const { data: equipements } = useEquipements(parcId || undefined);

  const [equipementId, setEquipementId] = useState('');
  const [norme, setNorme] = useState('');
  const [organisme, setOrganisme] = useState('');
  const [numCertif, setNumCertif] = useState('');
  const [dateCertif, setDateCertif] = useState(new Date().toISOString().slice(0, 10));
  const [echeance, setEcheance] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!equipementId || !norme.trim() || !echeance) return;
    await creer.mutateAsync({
      equipement_id: equipementId,
      norme: norme.trim(),
      organisme_certificateur: organisme.trim() || null,
      numero_certificat: numCertif.trim() || null,
      date_certif: dateCertif,
      prochaine_echeance: echeance,
      notes: notes.trim() || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center md:p-4">
      <div className="w-full md:max-w-[520px] bg-bg-card rounded-t-[18px] md:rounded-[18px] border border-nikito-cyan/15 p-5 md:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[11px] text-dim tracking-[1.2px] uppercase">Reglementaire</div>
            <div className="text-[19px] font-semibold mt-0.5">Nouvelle certification</div>
          </div>
          <button onClick={onClose} className="bg-bg-deep border border-white/[0.08] text-dim w-[34px] h-[34px] rounded-[10px] text-base flex items-center justify-center">&times;</button>
        </div>
        <div className="grid gap-3.5 mb-5">
          <Field label="Parc *">
            <select value={parcId} onChange={(e) => { setParcId(e.target.value); setEquipementId(''); }} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]">
              <option value="">Selectionner un parc</option>
              {parcs?.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Field>
          <Field label="Equipement *">
            <select value={equipementId} onChange={(e) => setEquipementId(e.target.value)} disabled={!parcId} className={cn('w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]', !parcId && 'opacity-40')}>
              <option value="">Selectionner</option>
              {(equipements ?? []).map((e) => <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>)}
            </select>
          </Field>
          <Field label="Norme / type *">
            <input type="text" value={norme} onChange={(e) => setNorme(e.target.value)} placeholder="Ex: NF EN 1176, APAVE, Bureau Veritas..." className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Organisme">
              <input type="text" value={organisme} onChange={(e) => setOrganisme(e.target.value)} placeholder="Apave, Socotec..." className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
            <Field label="N. certificat">
              <input type="text" value={numCertif} onChange={(e) => setNumCertif(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Date certification">
              <input type="date" value={dateCertif} onChange={(e) => setDateCertif(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
            <Field label="Prochaine echeance *">
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observations..." className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[60px]" />
          </Field>
        </div>
        {creer.isError && (
          <div className="text-red text-[12px] mb-3 bg-red/10 rounded-lg p-3">Erreur : {(creer.error as Error).message}</div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button onClick={onClose} className="bg-transparent border border-white/15 text-dim px-4 py-2.5 rounded-[10px] text-xs min-h-[44px]">Annuler</button>
          <button onClick={submit} disabled={!equipementId || !norme.trim() || !echeance || creer.isPending} className={cn('bg-gradient-cta text-text px-6 py-2.5 rounded-[10px] text-[13px] font-bold min-h-[44px]', (!equipementId || !norme.trim() || !echeance || creer.isPending) && 'opacity-40 cursor-not-allowed')}>
            {creer.isPending ? 'Creation...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Compteur({ label, value, color }: { label: string; value: number; color?: 'red' | 'amber' | 'green' }) {
  const textCls = color === 'red' ? 'text-red' : color === 'amber' ? 'text-amber' : color === 'green' ? 'text-green' : 'text-text';
  return (
    <div className="bg-bg-card rounded-xl px-4 py-2.5 border border-white/[0.06] min-w-[90px]">
      <div className="text-[10px] text-dim uppercase tracking-wider">{label}</div>
      <div className={cn('text-lg font-semibold', textCls)}>{value}</div>
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
