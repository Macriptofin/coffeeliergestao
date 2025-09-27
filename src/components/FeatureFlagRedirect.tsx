import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFeatureFlags, logFeatureFlagEvent } from '@/hooks/useFeatureFlags';

export const FeatureFlagRedirect = ({ children }: { children: React.ReactNode }) => {
  const { flags, loading } = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // Skip redirects if we're already on a target page
    if (currentPath === '/producao/fichas-tecnicas' || 
        (currentPath === '/producao/relatorios' && searchParams.get('tab') === 'costs')) {
      return;
    }

    // Apply redirects based on feature flags
    if (flags.FF_UNIFY_BOM_RECEITAS) {
      if (currentPath === '/receitas' || currentPath === '/producao/bom') {
        logFeatureFlagEvent('nav.redirect.legacy_to_unified', `${currentPath} -> /producao/fichas-tecnicas`);
        navigate('/producao/fichas-tecnicas', { replace: true });
        return;
      }
    }

    if (flags.FF_MOVE_COSTS_TO_REPORTS) {
      if (currentPath === '/producao/calculo-custos') {
        logFeatureFlagEvent('nav.redirect.legacy_to_unified', `${currentPath} -> /producao/relatorios?tab=costs`);
        navigate('/producao/relatorios?tab=costs', { replace: true });
        return;
      }
    }
  }, [flags, loading, location, navigate]);

  return <>{children}</>;
};