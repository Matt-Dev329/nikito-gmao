import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import type { ObjetNote } from '@/hooks/queries/useNotesPartagees';

interface NotePartagee {
  id: string;
  texte: string;
  auteur_id: string;
  cree_le: string;
  modifie_le: string | null;
  auteur: { prenom: string | null; nom: string | null } | null;
}

const dateHeure = (d: string) =>
  new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Notes partagées d'un ticket ou d'une commande : tous ceux qui voient l'objet
 * les lisent et en ajoutent ; les personnes concernées sont prévenues.
 */
export function NotesPartagees({ type, objetId, className }: { type: ObjetNote; objetId: string; className?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { utilisateur } = useAuth();
  const [texte, setTexte] = useState('');
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const cle = ['notes-partagees', type, objetId];
  const estChef = utilisateur?.role_code === 'chef_maintenance';

  const { data: notes, isLoading } = useQuery({
    queryKey: cle,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes_partagees')
        .select('id, texte, auteur_id, cree_le, modifie_le, auteur:utilisateurs!notes_partagees_auteur_id_fkey(prenom, nom)')
        .eq('objet_type', type)
        .eq('objet_id', objetId)
        .eq('actif', true)
        .order('cree_le');
      if (error) throw error;
      return (data ?? []) as unknown as NotePartagee[];
    },
    refetchInterval: 30_000,
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: cle });
    qc.invalidateQueries({ queryKey: ['notes-partagees', type, 'compte'] });
  };

  const ajouter = useMutation({
    mutationFn: async () => {
      const t = texte.trim();
      if (!t) throw new Error('Écris ta note');
      const { error } = await supabase.from('notes_partagees').insert({ objet_type: type, objet_id: objetId, texte: t });
      if (error) throw error;
    },
    onSuccess: () => {
      setTexte('');
      rafraichir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const maj = useMutation({
    mutationFn: async ({ id, valeurs }: { id: string; valeurs: { texte?: string; actif?: boolean } }) => {
      const { error } = await supabase.from('notes_partagees').update(valeurs).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { valeurs }) => {
      setEdition(null);
      if (valeurs.actif === false) toast.info('Note retirée');
      rafraichir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className={cn('bg-bg-card border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3', className)}>
      <div className="text-[11px] text-dim uppercase tracking-wider">
        💬 Notes {notes && notes.length > 0 && <span className="text-faint">· {notes.length}</span>}
      </div>

      {isLoading ? (
        <div className="h-10 bg-bg-deep rounded-lg animate-pulse" />
      ) : (notes ?? []).length === 0 ? (
        <div className="text-[12px] text-faint">Aucune note pour l’instant.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {(notes ?? []).map((n) => {
            const mienne = n.auteur_id === utilisateur?.id;
            const nom = [n.auteur?.prenom, n.auteur?.nom].filter(Boolean).join(' ') || 'Quelqu’un';
            return (
              <div key={n.id} className={cn('rounded-lg px-3 py-2', mienne ? 'bg-nikito-cyan/[0.07]' : 'bg-bg-deep')}>
                <div className="flex items-center gap-2 text-[11px] text-faint">
                  <span className={cn('font-semibold', mienne ? 'text-nikito-cyan' : 'text-dim')}>{mienne ? 'Moi' : nom}</span>
                  <span>{dateHeure(n.cree_le)}</span>
                  {n.modifie_le && <span>· modifiée</span>}
                  <span className="ml-auto flex gap-3">
                    {mienne && edition?.id !== n.id && (
                      <button onClick={() => setEdition({ id: n.id, texte: n.texte })} className="hover:text-text">
                        Modifier
                      </button>
                    )}
                    {(mienne || estChef) && edition?.id !== n.id && (
                      <button onClick={() => maj.mutate({ id: n.id, valeurs: { actif: false } })} className="hover:text-red">
                        Retirer
                      </button>
                    )}
                  </span>
                </div>
                {edition?.id === n.id ? (
                  <div className="flex flex-col gap-2 mt-1.5">
                    <textarea
                      value={edition.texte}
                      onChange={(e) => setEdition({ id: n.id, texte: e.target.value })}
                      rows={2}
                      maxLength={4000}
                      className="w-full bg-bg-deep border border-white/[0.08] rounded-[10px] p-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEdition(null)} className="text-dim text-[12px] px-2 min-h-[36px]">
                        Annuler
                      </button>
                      <button
                        onClick={() => edition.texte.trim() && maj.mutate({ id: n.id, valeurs: { texte: edition.texte.trim() } })}
                        disabled={maj.isPending}
                        className="bg-nikito-cyan text-bg-app px-3 rounded-lg text-[12px] font-bold min-h-[36px]"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] mt-0.5 whitespace-pre-wrap break-words">{n.texte}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder={type === 'ticket' ? 'Ajouter une note sur ce ticket…' : 'Ajouter une note sur cette commande…'}
          className="flex-1 bg-bg-deep border border-white/[0.08] rounded-[10px] p-2.5 text-text text-[13px] outline-none focus:border-nikito-cyan resize-y min-h-[44px]"
        />
        <button
          onClick={() => ajouter.mutate()}
          disabled={ajouter.isPending || !texte.trim()}
          className="bg-nikito-cyan text-bg-app px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] disabled:opacity-40"
        >
          {ajouter.isPending ? '…' : 'Ajouter'}
        </button>
      </div>
      <div className="text-[11px] text-faint -mt-1">
        Visible par tous ceux qui voient {type === 'ticket' ? 'ce ticket' : 'cette commande'} ; les personnes concernées sont prévenues.
      </div>
    </div>
  );
}
