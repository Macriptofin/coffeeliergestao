import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FeatureFlags {
  FF_UNIFY_BOM_RECEITAS: boolean;
  FF_MOVE_COSTS_TO_REPORTS: boolean;
  FF_ORDERS_AS_CENTRAL: boolean;
  FF_EVENT_TABLES_ENABLED: boolean;
  FF_HIDE_LEGACY_RECIPES: boolean;
}

const defaultFlags: FeatureFlags = {
  FF_UNIFY_BOM_RECEITAS: false,
  FF_MOVE_COSTS_TO_REPORTS: false,
  FF_ORDERS_AS_CENTRAL: false,
  FF_EVENT_TABLES_ENABLED: false,
  FF_HIDE_LEGACY_RECIPES: false,
};

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  const loadFlags = async () => {
    try {
      console.info('🚩 Loading feature flags...');
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', Object.keys(defaultFlags));
      
      if (error) {
        console.error('❌ Error loading feature flags:', error);
        // Continue mesmo com erro, usando flags padrão
        setLoading(false);
        return;
      }

      const flagsData: Partial<FeatureFlags> = {};
      data?.forEach(item => {
        flagsData[item.key as keyof FeatureFlags] = item.value === 'true';
      });

      const updatedFlags = { ...defaultFlags, ...flagsData };
      setFlags(updatedFlags);
      
      console.info('🚩 Feature flags loaded:', updatedFlags);
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  return { flags, loading, reload: loadFlags };
};

export const logFeatureFlagEvent = (event: string, flagName?: string) => {
  console.info(`🚩 Feature Flag Event: ${event}${flagName ? ` (${flagName})` : ''}`);
};