import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import type { StatutControle, TypeControle } from '@/types/database';

export interface ControleHistorique {
  id: string;
  parc_id: string;
  parc_code: string;
  parc_nom: string;
  type: TypeControle;
  date_planifiee: string;
  date_demarrage: string | null;
  date_validation: string | null;
  statut: StatutControle;
  realise_par_id: string | null;
  realise_par_nom: string | null;
  realise_par_role: string | null;
  signature_at: string | null;
  signature_url: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  hash_integrite: string | null;
  remplace_id: string | null;
  motif_correction: string | null;
  nb_ok: number;
  nb_ko: number;
  nb_total: number;
}

export interface ControleItemDetail {
  id: string;
  point_id: string;
  etat: string;
  commentaire: string | null;
  photo_url: string | null;
  point_libelle_snapshot: string | null;
  point_categorie_snapshot: string | null;
  point_libelle: string | null;
  point_categorie: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  utilisateur_nom: string | null;
  utilisateur_role: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

interface FiltresHistorique {
  dateDebut: string;
  dateFin: string;
  parcId?: string;
  type?: TypeControle;
  statut?: StatutControle;
  recherche?: string;
}

export function useHistoriqueControles(filtres: FiltresHistorique) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['historique_controles', filtres, estFormation],
    queryFn: async () => {
      let q = supabase
        .from('controles')
        .select(`
          id,
          parc_id,
          type,
          date_planifiee,
          date_demarrage,
          date_validation,
          statut,
          realise_par_id,
          realise_par_nom,
          realise_par_role,
          signature_at,
          signature_url,
          gps_latitude,
          gps_longitude,
          hash_integrite,
          remplace_id,
          motif_correction,
          parcs!inner(code, nom),
          controle_items(id, etat)
        `)
        .eq('est_formation', estFormation)
        .gte('date_planifiee', filtres.dateDebut)
        .lte('date_planifiee', filtres.dateFin)
        .order('date_planifiee', { ascending: false });

      if (filtres.parcId) {
        q = q.eq('parc_id', filtres.parcId);
      }
      if (filtres.type) {
        q = q.eq('type', filtres.type);
      }
      if (filtres.statut) {
        q = q.eq('statut', filtres.statut);
      }

      const { data, error } = await q;
      if (error) throw error;

      let result = (data ?? []).map((row: Record<string, unknown>) => {
        const parc = row.parcs as { code: string; nom: string };
        const items = row.controle_items as { id: string; etat: string }[];
        const nbOk = items.filter((i) => i.etat === 'ok').length;
        const nbKo = items.filter((i) => i.etat !== 'ok').length;

        return {
          id: row.id as string,
          parc_id: row.parc_id as string,
          parc_code: parc.code,
          parc_nom: parc.nom,
          type: row.type as TypeControle,
          date_planifiee: row.date_planifiee as string,
          date_demarrage: row.date_demarrage as string | null,
          date_validation: row.date_validation as string | null,
          statut: row.statut as StatutControle,
          realise_par_id: row.realise_par_id as string | null,
          realise_par_nom: row.realise_par_nom as string | null,
          realise_par_role: row.realise_par_role as string | null,
          signature_at: row.signature_at as string | null,
          signature_url: row.signature_url as string | null,
          gps_latitude: row.gps_latitude as number | null,
          gps_longitude: row.gps_longitude as number | null,
          hash_integrite: row.hash_integrite as string | null,
          remplace_id: row.remplace_id as string | null,
          motif_correction: row.motif_correction as string | null,
          nb_ok: nbOk,
          nb_ko: nbKo,
          nb_total: items.length,
        } satisfies ControleHistorique;
      });

      if (filtres.recherche) {
        const search = filtres.recherche.toLowerCase();
        result = result.filter(
          (c) => c.realise_par_nom?.toLowerCase().includes(search)
        );
      }

      return result;
    },
  });
}

export function useControleDetail(controleId: string | null) {
  return useQuery({
    queryKey: ['controle_detail', controleId],
    queryFn: async () => {
      if (!controleId) return null;

      const { data: items, error: errItems } = await supabase
        .from('controle_items')
        .select(`
          id,
          point_id,
          etat,
          commentaire,
          photo_url,
          point_libelle_snapshot,
          point_categorie_snapshot,
          bibliotheque_points(libelle, categories_equipement(nom))
        `)
        .eq('controle_id', controleId);

      if (errItems) throw errItems;

      const { data: auditLog, error: errAudit } = await supabase
        .from('controles_audit_log')
        .select('id, action, utilisateur_nom, utilisateur_role, details, ip, created_at')
        .eq('controle_id', controleId)
        .order('created_at', { ascending: true });

      if (errAudit) throw errAudit;

      const mappedItems: ControleItemDetail[] = (items ?? []).map((item: Record<string, unknown>) => {
        const bp = item.bibliotheque_points as { libelle: string; categories_equipement: { nom: string } | null } | null;
        return {
          id: item.id as string,
          point_id: item.point_id as string,
          etat: item.etat as string,
          commentaire: item.commentaire as string | null,
          photo_url: item.photo_url as string | null,
          point_libelle_snapshot: item.point_libelle_snapshot as string | null,
          point_categorie_snapshot: item.point_categorie_snapshot as string | null,
          point_libelle: bp?.libelle ?? null,
          point_categorie: bp?.categories_equipement?.nom ?? null,
        };
      });

      return {
        items: mappedItems,
        auditLog: (auditLog ?? []) as AuditLogEntry[],
      };
    },
    enabled: !!controleId,
  });
}
