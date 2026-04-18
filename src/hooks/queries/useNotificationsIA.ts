import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import { useAuth } from '@/hooks/useAuth';
import type { AnalyseIA } from '@/types/ia-predictive';

export interface RapportIAHebdo {
  id: string;
  semaine_iso: string;
  score_sante: number;
  tendance: 'stable' | 'amelioration' | 'degradation';
  donnees_analyse: Record<string, unknown>;
  genere_le: string;
  est_formation: boolean;
  cree_le: string;
}

export type ResultatReel = 'bon_choix' | 'mauvais_choix' | 'non_evalue';

export interface HypotheseIA {
  id: string;
  rapport_id: string;
  type: 'equipement_risque' | 'alerte' | 'recommandation';
  titre: string;
  description: string;
  donnees: Record<string, unknown>;
  priorite: 'haute' | 'moyenne' | 'basse';
  statut: 'en_attente' | 'validee' | 'rejetee';
  validee_par_id: string | null;
  validee_le: string | null;
  commentaire_validation: string | null;
  resultat_reel: ResultatReel;
  resultat_commentaire: string | null;
  resultat_evalue_par_id: string | null;
  resultat_evalue_le: string | null;
  est_formation: boolean;
  cree_le: string;
  rapport?: RapportIAHebdo;
  valideur?: { nom: string; prenom: string } | null;
  evaluateur?: { nom: string; prenom: string } | null;
}

export interface HistoriqueDecision {
  id: string;
  hypothese_id: string;
  action: 'validee' | 'rejetee' | 'resultat_bon' | 'resultat_mauvais';
  utilisateur_id: string;
  utilisateur_nom: string;
  commentaire: string | null;
  donnees_snapshot: Record<string, unknown>;
  cree_le: string;
}

export interface DecisionStats {
  total_evaluees: number;
  bons_choix: number;
  mauvais_choix: number;
  taux_reussite: number;
  a_evaluer: number;
}

export interface NotificationsStats {
  total: number;
  en_attente: number;
  validees: number;
  rejetees: number;
}

export function useRapportsIA() {
  const { estFormation } = useFormationFilter();

  return useQuery({
    queryKey: ['rapports-ia-hebdo', estFormation],
    queryFn: async (): Promise<RapportIAHebdo[]> => {
      const { data, error } = await supabase
        .from('rapports_ia_hebdo')
        .select('*')
        .eq('est_formation', estFormation)
        .order('genere_le', { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data ?? []) as RapportIAHebdo[];
    },
    staleTime: 60_000,
  });
}

export function useHypothesesIA(rapportId?: string) {
  const { estFormation } = useFormationFilter();

  return useQuery({
    queryKey: ['hypotheses-ia', estFormation, rapportId ?? 'all'],
    queryFn: async (): Promise<HypotheseIA[]> => {
      let query = supabase
        .from('hypotheses_ia')
        .select(`
          *,
          rapport:rapports_ia_hebdo(id, semaine_iso, score_sante, tendance, genere_le),
          valideur:utilisateurs!hypotheses_ia_validee_par_id_fkey(nom, prenom),
          evaluateur:utilisateurs!hypotheses_ia_resultat_evalue_par_id_fkey(nom, prenom)
        `)
        .eq('est_formation', estFormation)
        .order('cree_le', { ascending: false });

      if (rapportId) {
        query = query.eq('rapport_id', rapportId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as HypotheseIA[];
    },
    staleTime: 30_000,
  });
}

export function useHypothesesEnAttente() {
  const { estFormation } = useFormationFilter();

  return useQuery({
    queryKey: ['hypotheses-ia-en-attente', estFormation],
    queryFn: async (): Promise<HypotheseIA[]> => {
      const { data, error } = await supabase
        .from('hypotheses_ia')
        .select(`
          *,
          rapport:rapports_ia_hebdo(id, semaine_iso, score_sante, tendance, genere_le)
        `)
        .eq('est_formation', estFormation)
        .eq('statut', 'en_attente')
        .order('priorite', { ascending: true })
        .order('cree_le', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as HypotheseIA[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNotificationsStats() {
  const { estFormation } = useFormationFilter();

  return useQuery({
    queryKey: ['notifications-ia-stats', estFormation],
    queryFn: async (): Promise<NotificationsStats> => {
      const [totalRes, attenteRes, valideesRes, rejeteesRes] = await Promise.all([
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true }).eq('est_formation', estFormation),
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true }).eq('est_formation', estFormation).eq('statut', 'en_attente'),
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true }).eq('est_formation', estFormation).eq('statut', 'validee'),
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true }).eq('est_formation', estFormation).eq('statut', 'rejetee'),
      ]);

      return {
        total: totalRes.count ?? 0,
        en_attente: attenteRes.count ?? 0,
        validees: valideesRes.count ?? 0,
        rejetees: rejeteesRes.count ?? 0,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useValiderHypothese() {
  const queryClient = useQueryClient();
  const { utilisateur } = useAuth();

  return useMutation({
    mutationFn: async ({ id, statut, commentaire }: { id: string; statut: 'validee' | 'rejetee'; commentaire?: string }) => {
      const { error } = await supabase
        .from('hypotheses_ia')
        .update({
          statut,
          validee_par_id: utilisateur?.id ?? null,
          validee_le: new Date().toISOString(),
          commentaire_validation: commentaire ?? null,
        })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('historique_decisions_ia').insert({
        hypothese_id: id,
        action: statut,
        utilisateur_id: utilisateur?.id ?? '',
        utilisateur_nom: `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim(),
        commentaire: commentaire ?? null,
        donnees_snapshot: { statut },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hypotheses-ia'] });
      queryClient.invalidateQueries({ queryKey: ['hypotheses-ia-en-attente'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-ia-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] });
      queryClient.invalidateQueries({ queryKey: ['historique-decisions-ia'] });
      queryClient.invalidateQueries({ queryKey: ['decision-stats'] });
    },
  });
}

export function useEvaluerResultat() {
  const queryClient = useQueryClient();
  const { utilisateur } = useAuth();

  return useMutation({
    mutationFn: async ({ id, resultat, commentaire }: { id: string; resultat: 'bon_choix' | 'mauvais_choix'; commentaire?: string }) => {
      const { error } = await supabase
        .from('hypotheses_ia')
        .update({
          resultat_reel: resultat,
          resultat_commentaire: commentaire ?? null,
          resultat_evalue_par_id: utilisateur?.id ?? null,
          resultat_evalue_le: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      await supabase.from('historique_decisions_ia').insert({
        hypothese_id: id,
        action: resultat === 'bon_choix' ? 'resultat_bon' : 'resultat_mauvais',
        utilisateur_id: utilisateur?.id ?? '',
        utilisateur_nom: `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim(),
        commentaire: commentaire ?? null,
        donnees_snapshot: { resultat },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hypotheses-ia'] });
      queryClient.invalidateQueries({ queryKey: ['historique-decisions-ia'] });
      queryClient.invalidateQueries({ queryKey: ['decision-stats'] });
    },
  });
}

export function useHistoriqueDecisions(hypotheseId?: string) {
  return useQuery({
    queryKey: ['historique-decisions-ia', hypotheseId ?? 'all'],
    queryFn: async (): Promise<HistoriqueDecision[]> => {
      let query = supabase
        .from('historique_decisions_ia')
        .select('*')
        .order('cree_le', { ascending: false })
        .limit(100);

      if (hypotheseId) {
        query = query.eq('hypothese_id', hypotheseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as HistoriqueDecision[];
    },
    staleTime: 30_000,
  });
}

export function useDecisionStats() {
  const { estFormation } = useFormationFilter();

  return useQuery({
    queryKey: ['decision-stats', estFormation],
    queryFn: async (): Promise<DecisionStats> => {
      const [bonRes, mauvaisRes, aEvaluerRes] = await Promise.all([
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true })
          .eq('est_formation', estFormation).eq('resultat_reel', 'bon_choix'),
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true })
          .eq('est_formation', estFormation).eq('resultat_reel', 'mauvais_choix'),
        supabase.from('hypotheses_ia').select('id', { count: 'exact', head: true })
          .eq('est_formation', estFormation)
          .in('statut', ['validee', 'rejetee'])
          .eq('resultat_reel', 'non_evalue'),
      ]);

      const bons = bonRes.count ?? 0;
      const mauvais = mauvaisRes.count ?? 0;
      const totalEvaluees = bons + mauvais;

      return {
        total_evaluees: totalEvaluees,
        bons_choix: bons,
        mauvais_choix: mauvais,
        taux_reussite: totalEvaluees > 0 ? Math.round((bons / totalEvaluees) * 100) : 0,
        a_evaluer: aEvaluerRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

export function useGenererRapportIA() {
  const queryClient = useQueryClient();
  const { estFormation } = useFormationFilter();

  return useMutation({
    mutationFn: async (analyse: AnalyseIA) => {
      const now = new Date();
      const onejan = new Date(now.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
      const semaineIso = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      const { data: existing } = await supabase
        .from('rapports_ia_hebdo')
        .select('id')
        .eq('semaine_iso', semaineIso)
        .eq('est_formation', estFormation)
        .maybeSingle();

      if (existing) {
        return { rapportId: existing.id, alreadyExists: true };
      }

      const { data: rapport, error: rapportError } = await supabase
        .from('rapports_ia_hebdo')
        .insert({
          semaine_iso: semaineIso,
          score_sante: analyse.score_sante_global,
          tendance: analyse.tendance,
          donnees_analyse: analyse as unknown as Record<string, unknown>,
          est_formation: estFormation,
        })
        .select('id')
        .single();

      if (rapportError) throw rapportError;

      const hypotheses: Array<{
        rapport_id: string;
        type: string;
        titre: string;
        description: string;
        donnees: Record<string, unknown>;
        priorite: string;
        est_formation: boolean;
      }> = [];

      for (const eq of analyse.equipements_a_risque) {
        hypotheses.push({
          rapport_id: rapport.id,
          type: 'equipement_risque',
          titre: `${eq.equipement_code} - Risque ${eq.score_risque}%`,
          description: eq.prediction || eq.action_recommandee || eq.justification || '',
          donnees: eq as unknown as Record<string, unknown>,
          priorite: eq.priorite ?? 'moyenne',
          est_formation: estFormation,
        });
      }

      for (const al of analyse.alertes) {
        hypotheses.push({
          rapport_id: rapport.id,
          type: 'alerte',
          titre: al.message ?? 'Alerte IA',
          description: `Type: ${al.type?.replace(/_/g, ' ') ?? 'inconnu'} - Parc: ${al.parc ?? ''}`,
          donnees: al as unknown as Record<string, unknown>,
          priorite: al.priorite ?? 'moyenne',
          est_formation: estFormation,
        });
      }

      for (const rec of analyse.recommandations) {
        hypotheses.push({
          rapport_id: rapport.id,
          type: 'recommandation',
          titre: rec.titre ?? 'Recommandation IA',
          description: rec.description ?? '',
          donnees: rec as unknown as Record<string, unknown>,
          priorite: 'moyenne',
          est_formation: estFormation,
        });
      }

      if (hypotheses.length > 0) {
        const { error: hypError } = await supabase
          .from('hypotheses_ia')
          .insert(hypotheses);

        if (hypError) throw hypError;
      }

      return { rapportId: rapport.id, alreadyExists: false, hypothesesCount: hypotheses.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rapports-ia-hebdo'] });
      queryClient.invalidateQueries({ queryKey: ['hypotheses-ia'] });
      queryClient.invalidateQueries({ queryKey: ['hypotheses-ia-en-attente'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-ia-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] });
    },
  });
}
