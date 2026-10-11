import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { useAccesCommandes, useCommandes } from '@/hooks/queries/useCommandes';
import { useLeverAttentePiece, useMettreEnAttentePiece } from '@/hooks/queries/useTickets';

const champ =
  'w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-3 text-text text-[13px] outline-none focus:border-nikito-cyan min-h-[44px]';

const STATUTS_EN_COURS = ['demandee', 'validee', 'commandee'];

/**
 * Ticket bloqué par une pièce : rangé dans « Pièce en attente » (sans être
 * fermé), avec la pièce attendue et éventuellement la commande liée — la
 * livraison de cette commande remet le ticket dans « À faire ».
 */
export function PanneauAttentePiece({ incident }: { incident: Record<string, unknown> }) {
  const toast = useToast();
  const mettre = useMettreEnAttentePiece();
  const lever = useLeverAttentePiece();
  const { peutCommander, estGestionnaire } = useAccesCommandes();
  const { data: commandes } = useCommandes(estGestionnaire ? 'toutes' : 'miennes');

  const statut = incident.statut as string;
  const enAttente = incident.attente_piece === true;
  const commande = incident.attente_commande as { numero: string; statut: string } | null;

  const [ouvert, setOuvert] = useState(false);
  const [detail, setDetail] = useState('');
  const [commandeId, setCommandeId] = useState('');

  if (statut === 'resolu' || statut === 'ferme') return null;

  const commandesOuvertes = (commandes ?? []).filter((c) => STATUTS_EN_COURS.includes(c.statut));

  const envoyer = async () => {
    if (!detail.trim() && !commandeId) {
      toast.error('Indique la pièce attendue');
      return;
    }
    try {
      await mettre.mutateAsync({ incidentId: incident.id as string, detail: detail.trim(), commandeId: commandeId || null });
      toast.success('Ticket rangé dans « Pièce en attente »');
      setOuvert(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remettreAFaire = async () => {
    try {
      await lever.mutateAsync(incident.id as string);
      toast.info('Pièce reçue : ticket remis dans « À faire »');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (enAttente) {
    const depuis = incident.attente_piece_depuis
      ? new Date(incident.attente_piece_depuis as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
      : null;
    return (
      <div className="bg-bg-card rounded-xl p-3.5 px-4 border border-amber/40">
        <div className="text-[11px] text-amber uppercase tracking-wider mb-1.5">
          Pièce en attente{depuis ? ` · depuis le ${depuis}` : ''}
        </div>
        {incident.attente_piece_detail ? (
          <div className="text-[14px] font-semibold">{incident.attente_piece_detail as string}</div>
        ) : null}
        {commande && (
          <div className="text-[12px] text-dim mt-0.5">
            Commande {commande.numero} · {commande.statut === 'livree' ? 'livrée' : 'en cours'} — le ticket reviendra dans
            « À faire » à la livraison
          </div>
        )}
        <button
          onClick={remettreAFaire}
          disabled={lever.isPending}
          className="mt-3 bg-green/15 text-green border border-green/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]"
        >
          Pièce reçue · remettre à faire
        </button>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl p-3.5 px-4">
      {!ouvert ? (
        <button onClick={() => setOuvert(true)} className="w-full text-left flex items-center justify-between gap-3 min-h-[44px]">
          <div>
            <div className="text-[13px] font-semibold">Pièce en attente</div>
            <div className="text-[12px] text-dim">Bloqué par une pièce à recevoir ? Range le ticket sans le fermer.</div>
          </div>
          <span className="text-amber text-[12px] font-semibold whitespace-nowrap">Ranger ›</span>
        </button>
      ) : (
        <div className="grid gap-2.5">
          <div className="text-[13px] font-semibold">Mettre en attente de pièce</div>
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Pièce attendue (ex. courroie 8PK1200)"
            className={champ}
          />
          {peutCommander && commandesOuvertes.length > 0 && (
            <select value={commandeId} onChange={(e) => setCommandeId(e.target.value)} className={champ}>
              <option value="">Lier à une commande (facultatif)</option>
              {commandesOuvertes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.parc?.code ?? ''} · {c.commande_lignes.map((l) => l.produit_nom).join(', ').slice(0, 60)}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOuvert(false)} className="text-dim text-[13px] px-3 min-h-[44px]">
              Annuler
            </button>
            <button
              onClick={envoyer}
              disabled={mettre.isPending}
              className={cn(
                'bg-amber/15 text-amber border border-amber/40 px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px]',
                mettre.isPending && 'opacity-40'
              )}
            >
              {mettre.isPending ? '…' : 'Ranger en attente'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
