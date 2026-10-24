import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Objets qui portent des notes partagées (cf composant NotesPartagees) */
export type ObjetNote = 'ticket' | 'commande';

/** Nombre de notes par objet (pastille « 💬 » sur les listes) */
export function useNombreNotes(type: ObjetNote, tous: string[]) {
  // Liste plafonnée : l'URL de la requête reste courte
  const ids = tous.slice(0, 150);
  return useQuery({
    queryKey: ['notes-partagees', type, 'compte', ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes_partagees')
        .select('objet_id')
        .eq('objet_type', type)
        .eq('actif', true)
        .in('objet_id', ids);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data ?? []).forEach((n: { objet_id: string }) => (m[n.objet_id] = (m[n.objet_id] ?? 0) + 1));
      return m;
    },
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}
