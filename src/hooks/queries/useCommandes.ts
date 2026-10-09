import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Module « Commander » : catalogue activités → produits, panier, commandes.
// Tables : commande_activites, commande_produits, commandes, commande_lignes.

export type StatutCommande = 'demandee' | 'validee' | 'commandee' | 'livree' | 'refusee' | 'annulee';

export const STATUTS_COMMANDE: Record<StatutCommande, { label: string; tone: 'cyan' | 'amber' | 'green' | 'red' | 'dim' }> = {
  demandee: { label: 'Demandée', tone: 'amber' },
  validee: { label: 'Validée', tone: 'cyan' },
  commandee: { label: 'Commandée', tone: 'cyan' },
  livree: { label: 'Livrée', tone: 'green' },
  refusee: { label: 'Refusée', tone: 'red' },
  annulee: { label: 'Annulée', tone: 'dim' },
};

export interface ActiviteCommande {
  id: string;
  nom: string;
  description: string | null;
  ordre: number;
  actif: boolean;
}

export interface ProduitCommande {
  id: string;
  activite_id: string;
  nom: string;
  reference: string | null;
  description: string | null;
  unite: string;
  prix_unitaire: number | null;
  photo_url: string | null;
  ordre: number;
  actif: boolean;
}

export interface LigneCommande {
  id: string;
  produit_id: string | null;
  activite_nom: string | null;
  produit_nom: string;
  reference: string | null;
  unite: string;
  quantite: number;
  prix_unitaire: number | null;
}

export interface Commande {
  id: string;
  numero: string;
  statut: StatutCommande;
  commentaire: string | null;
  motif_refus: string | null;
  total_estime: number | null;
  cree_le: string;
  traitee_le: string | null;
  demandeur_id: string;
  demandeur: { prenom: string; nom: string } | null;
  parc: { code: string; nom: string } | null;
  commande_lignes: LigneCommande[];
}

/** Gestionnaire des commandes = gère le catalogue et reçoit les demandes. */
export function useEstGestionnaireCommandes() {
  const { utilisateur } = useAuth();
  return useQuery({
    queryKey: ['commandes', 'est-gestionnaire', utilisateur?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('est_gestionnaire_commandes');
      // Module pas encore installé en base → simplement pas gestionnaire
      if (error) return false;
      return data === true;
    },
    enabled: !!utilisateur,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * Accès à l'onglet Commander : gestionnaire, ou rôle explicitement ouvert dans
 * le feature flag `commandes`. Contrairement à hasAccess(), un flag absent
 * ou pas encore chargé ferme l'accès (module en cours de mise en place).
 */
export function useAccesCommandes() {
  const { utilisateur } = useAuth();
  const gestionnaire = useEstGestionnaireCommandes();
  const flag = useQuery({
    queryKey: ['feature_flags', 'commandes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('actif_global, roles_autorises')
        .eq('feature_code', 'commandes')
        .maybeSingle();
      if (error) return null;
      return data as { actif_global: boolean; roles_autorises: string[] } | null;
    },
    enabled: !!utilisateur,
    staleTime: 60_000,
  });

  const parRole =
    !!utilisateur &&
    !!flag.data?.actif_global &&
    flag.data.roles_autorises.includes(utilisateur.role_code);
  const estGestionnaire = gestionnaire.data === true;

  return {
    peutCommander: estGestionnaire || parRole,
    estGestionnaire,
    isLoading: gestionnaire.isLoading || flag.isLoading,
  };
}

export function useCatalogueCommandes(inclureInactifs = false) {
  return useQuery({
    queryKey: ['commandes', 'catalogue', inclureInactifs],
    queryFn: async () => {
      let qa = supabase.from('commande_activites').select('*').order('ordre').order('nom');
      let qp = supabase.from('commande_produits').select('*').order('ordre').order('nom');
      if (!inclureInactifs) {
        qa = qa.eq('actif', true);
        qp = qp.eq('actif', true);
      }
      const [a, p] = await Promise.all([qa, qp]);
      if (a.error) throw a.error;
      if (p.error) throw p.error;
      return {
        activites: (a.data ?? []) as ActiviteCommande[],
        produits: (p.data ?? []) as ProduitCommande[],
      };
    },
  });
}

const SELECT_COMMANDE = `id, numero, statut, commentaire, motif_refus, total_estime, cree_le, traitee_le, demandeur_id,
  demandeur:utilisateurs!commandes_demandeur_id_fkey(prenom, nom),
  parc:parcs(code, nom),
  commande_lignes(id, produit_id, activite_nom, produit_nom, reference, unite, quantite, prix_unitaire)`;

/** Mes commandes (demandeur) ou toutes les commandes (gestionnaire). */
export function useCommandes(portee: 'miennes' | 'toutes') {
  const { utilisateur } = useAuth();
  return useQuery({
    queryKey: ['commandes', 'liste', portee, utilisateur?.id],
    queryFn: async () => {
      let q = supabase.from('commandes').select(SELECT_COMMANDE).order('cree_le', { ascending: false }).limit(200);
      if (portee === 'miennes' && utilisateur) q = q.eq('demandeur_id', utilisateur.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Commande[];
    },
    enabled: !!utilisateur,
    refetchInterval: 60_000,
  });
}

export function usePasserCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      parcId: string;
      lignes: Array<{ produit_id: string; quantite: number }>;
      commentaire: string;
    }) => {
      const { data, error } = await supabase.rpc('passer_commande', {
        p_parc_id: params.parcId,
        p_lignes: params.lignes,
        p_commentaire: params.commentaire || null,
      });
      if (error) throw error;
      return data as { id: string; numero: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes'] }),
  });
}

export function useAnnulerCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commandeId: string) => {
      const { error } = await supabase.rpc('annuler_commande', { p_commande_id: commandeId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes'] }),
  });
}

export function useChangerStatutCommande() {
  const qc = useQueryClient();
  const { utilisateur } = useAuth();
  return useMutation({
    mutationFn: async (params: { id: string; statut: StatutCommande; motifRefus?: string }) => {
      const { error } = await supabase
        .from('commandes')
        .update({
          statut: params.statut,
          motif_refus: params.statut === 'refusee' ? params.motifRefus || null : null,
          traitee_le: new Date().toISOString(),
          traitee_par_id: utilisateur?.id ?? null,
        })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes'] }),
  });
}

// ---------------------------------------------------------------------------
// Gestion du catalogue (gestionnaires)
// ---------------------------------------------------------------------------

export type ActiviteInput = Pick<ActiviteCommande, 'nom' | 'description' | 'ordre' | 'actif'>;
export type ProduitInput = Omit<ProduitCommande, 'id'>;

export function useEnregistrerActivite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ActiviteInput & { id?: string }) => {
      const { error } = id
        ? await supabase.from('commande_activites').update(payload).eq('id', id)
        : await supabase.from('commande_activites').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes', 'catalogue'] }),
  });
}

export function useEnregistrerProduit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ProduitInput & { id?: string }) => {
      const { error } = id
        ? await supabase
            .from('commande_produits')
            .update({ ...payload, modifie_le: new Date().toISOString() })
            .eq('id', id)
        : await supabase.from('commande_produits').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes', 'catalogue'] }),
  });
}

export function useSupprimerElementCatalogue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ table, id }: { table: 'commande_activites' | 'commande_produits'; id: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commandes', 'catalogue'] }),
  });
}
