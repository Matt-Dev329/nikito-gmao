import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useFournisseurs } from '@/hooks/queries/useReferentiel';
import {
  useCloturerTicketExterieur,
  useConfierIntervenantExterieur,
  useReprendreTicketEnInterne,
} from '@/hooks/queries/useTickets';
import { ChoixTestActivite } from '@/components/tickets/ChoixTestActivite';

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

const AUTRE = '__autre__';

/**
 * Ticket confié à un intervenant extérieur (prestataire, fabricant…) :
 * confier / suivre / clôturer avec le compte-rendu / reprendre en interne.
 */
export function PanneauIntervenantExterieur({
  incident,
  onCloture,
}: {
  incident: Record<string, unknown>;
  onCloture?: () => void;
}) {
  const toast = useToast();
  const confier = useConfierIntervenantExterieur();
  const reprendre = useReprendreTicketEnInterne();
  const cloturer = useCloturerTicketExterieur();
  const { data: fournisseurs } = useFournisseurs();

  const statut = incident.statut as string;
  const resolu = statut === 'resolu' || statut === 'ferme';
  const externe = incident.externe === true;
  const fournisseur = incident.externe_fournisseur as { nom: string; contact_tel: string | null; contact_nom: string | null } | null;
  const meta = (incident.meta ?? {}) as Record<string, unknown>;
  const compteRendu = meta.externe_compte_rendu as string | undefined;

  const [formulaire, setFormulaire] = useState<'confier' | 'cloturer' | null>(null);
  const [fournisseurId, setFournisseurId] = useState('');
  const [nom, setNom] = useState('');
  const [datePrevue, setDatePrevue] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [cr, setCr] = useState('');
  const [testActivite, setTestActivite] = useState<boolean | null>(null);

  if (resolu && !compteRendu) return null;

  const nomIntervenant = fournisseur?.nom ?? (incident.externe_nom as string | null) ?? 'Intervenant extérieur';
  const datePrevueTxt = incident.externe_date_prevue
    ? new Date(`${incident.externe_date_prevue as string}T12:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null;

  const envoyerConfier = async () => {
    const libre = fournisseurId === AUTRE || !fournisseurId;
    if (libre && !nom.trim()) {
      toast.error("Indique le nom de l'intervenant");
      return;
    }
    try {
      await confier.mutateAsync({
        incidentId: incident.id as string,
        fournisseurId: libre ? null : fournisseurId,
        nom: libre ? nom.trim() : '',
        datePrevue,
        commentaire: commentaire.trim(),
      });
      toast.success('Ticket confié à un intervenant extérieur');
      setFormulaire(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const envoyerCloture = async () => {
    if (!cr.trim()) {
      toast.error("Indique ce qu'a fait l'intervenant");
      return;
    }
    if (testActivite === null) {
      toast.error('Indique si le test de l’activité a été fait (oui ou non)');
      return;
    }
    try {
      await cloturer.mutateAsync({ incidentId: incident.id as string, compteRendu: cr.trim(), testActivite });
      toast.success('Ticket clôturé (travaux de l’intervenant extérieur)');
      setFormulaire(null);
      onCloture?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reprendreEnInterne = async () => {
    try {
      await reprendre.mutateAsync(incident.id as string);
      toast.info('Ticket repris en interne');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Ticket résolu par un intervenant extérieur : on affiche son compte-rendu
  if (resolu) {
    return (
      <div className="bg-bg-card rounded-xl p-3.5 px-4 border border-amber/30">
        <div className="text-[11px] text-amber uppercase tracking-wider mb-1.5">Réalisé par un intervenant extérieur</div>
        <div className="text-[13px] font-semibold">{nomIntervenant}</div>
        <div className="text-[13px] text-dim mt-1 whitespace-pre-line">{compteRendu}</div>
      </div>
    );
  }

  if (!externe) {
    return (
      <div className="bg-bg-card rounded-xl p-3.5 px-4">
        {formulaire !== 'confier' ? (
          <button
            onClick={() => setFormulaire('confier')}
            className="w-full text-left flex items-center justify-between gap-3 min-h-[44px]"
          >
            <div>
              <div className="text-[13px] font-semibold">Intervenant extérieur</div>
              <div className="text-[12px] text-dim">Problème traité par un prestataire, pas par l'équipe ?</div>
            </div>
            <span className="text-amber text-[12px] font-semibold whitespace-nowrap">Confier ›</span>
          </button>
        ) : (
          <div className="grid gap-2.5">
            <div className="text-[13px] font-semibold">Confier à un intervenant extérieur</div>
            <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={champ}>
              <option value="">Choisir le prestataire…</option>
              {(fournisseurs ?? []).map((f) => (
                <option key={f.id as string} value={f.id as string}>
                  {f.nom as string}
                </option>
              ))}
              <option value={AUTRE}>Autre (saisir le nom)</option>
            </select>
            {(fournisseurId === AUTRE || !fournisseurId) && (
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom de l'intervenant / société"
                className={champ}
              />
            )}
            <label className="text-[11px] text-dim uppercase tracking-wider">Passage prévu (facultatif)</label>
            <input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className={champ} />
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Commentaire (n° de dossier, contact, consignes…)"
              className={cn(champ, 'resize-none')}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setFormulaire(null)} className="text-dim text-[13px] px-3 min-h-[44px]">
                Annuler
              </button>
              <button
                onClick={envoyerConfier}
                disabled={confier.isPending}
                className={cn(
                  'bg-amber/15 text-amber border border-amber/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]',
                  confier.isPending && 'opacity-40'
                )}
              >
                {confier.isPending ? '…' : 'Confier'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl p-3.5 px-4 border border-amber/40">
      <div className="text-[11px] text-amber uppercase tracking-wider mb-1.5">Confié à un intervenant extérieur</div>
      <div className="text-[14px] font-semibold">{nomIntervenant}</div>
      {(fournisseur?.contact_nom || fournisseur?.contact_tel) && (
        <div className="text-[12px] text-dim mt-0.5">
          {fournisseur.contact_nom}
          {fournisseur.contact_tel && (
            <>
              {fournisseur.contact_nom ? ' · ' : ''}
              <a href={`tel:${fournisseur.contact_tel}`} className="text-nikito-cyan underline">
                {fournisseur.contact_tel}
              </a>
            </>
          )}
        </div>
      )}
      {datePrevueTxt && <div className="text-[12px] text-text mt-1">Passage prévu : {datePrevueTxt}</div>}
      {incident.externe_commentaire ? (
        <div className="text-[12px] text-dim mt-1 whitespace-pre-line">{incident.externe_commentaire as string}</div>
      ) : null}

      {formulaire === 'cloturer' ? (
        <div className="grid gap-2.5 mt-3">
          <textarea
            value={cr}
            onChange={(e) => setCr(e.target.value)}
            rows={3}
            placeholder="Compte-rendu : ce qu'a fait l'intervenant, pièces changées, n° de bon…"
            className={cn(champ, 'resize-none')}
          />
          <ChoixTestActivite valeur={testActivite} onChange={setTestActivite} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setFormulaire(null)} className="text-dim text-[13px] px-3 min-h-[44px]">
              Annuler
            </button>
            <button
              onClick={envoyerCloture}
              disabled={cloturer.isPending || testActivite === null}
              className={cn(
                'bg-green/15 text-green border border-green/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]',
                (cloturer.isPending || testActivite === null) && 'opacity-40'
              )}
            >
              {cloturer.isPending ? '…' : 'Clôturer le ticket'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setFormulaire('cloturer')}
            className="bg-green/15 text-green border border-green/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
          >
            Travaux terminés · clôturer
          </button>
          <button
            onClick={reprendreEnInterne}
            disabled={reprendre.isPending}
            className="text-dim text-[13px] px-3 min-h-[44px] underline"
          >
            Reprendre en interne
          </button>
        </div>
      )}
    </div>
  );
}
