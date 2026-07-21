import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FeatureFlags {
  FF_EVENT_TABLES_ENABLED: boolean;
}

const defaultFlags: FeatureFlags = {
  FF_EVENT_TABLES_ENABLED: false,
};

const FEATURE_FLAGS_QUERY_KEY = ['feature-flags'] as const;

/**
 * Busca os feature flags. Usado como queryFn única e compartilhada via
 * react-query: antes cada consumidor refazia a busca e iniciava com os flags
 * em `false`, causando troca de conteúdo visível na 1ª carga da sessão.
 */
async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', Object.keys(defaultFlags));

  if (error) {
    console.error('Error loading feature flags:', error);
    return defaultFlags;
  }

  const flagsData: Partial<FeatureFlags> = {};
  data?.forEach(item => {
    flagsData[item.key as keyof FeatureFlags] = item.value === 'true';
  });

  return { ...defaultFlags, ...flagsData };
}

export const useFeatureFlags = () => {
  const queryClient = useQueryClient();

  const { data: flags = defaultFlags, isPending: loading } = useQuery({
    queryKey: FEATURE_FLAGS_QUERY_KEY,
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60_000,    // flags raramente mudam — 5min frescos
    gcTime: 30 * 60_000,
  });

  return {
    flags,
    loading,
    reload: () => queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_QUERY_KEY }),
  };
};

export const logFeatureFlagEvent = (event: string, flagName?: string) => {
  console.info(`🚩 Feature Flag Event: ${event}${flagName ? ` (${flagName})` : ''}`);
};
