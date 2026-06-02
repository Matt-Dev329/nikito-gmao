import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface FeatureFlag {
  feature_code: string;
  actif_global: boolean;
  roles_autorises: string[];
}

export function useFeatureFlags() {
  const { utilisateur } = useAuth();

  const { data: flags } = useQuery({
    queryKey: ['feature_flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('feature_code, actif_global, roles_autorises')
        .order('ordre');
      if (error) throw error;
      return data as FeatureFlag[];
    },
    staleTime: 60_000,
  });

  function hasAccess(featureCode: string): boolean {
    if (!flags || !utilisateur) return true;
    const flag = flags.find((f) => f.feature_code === featureCode);
    if (!flag) return true;
    if (!flag.actif_global) return false;
    return flag.roles_autorises.includes(utilisateur.role_code);
  }

  return { flags, hasAccess };
}
