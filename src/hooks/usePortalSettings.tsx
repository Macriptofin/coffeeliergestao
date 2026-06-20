import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Configurações de contato do portal (WhatsApp/e-mail), definidas em Vendas > Portal.
export function usePortalSettings() {
  const { data } = useQuery({
    queryKey: ['portal-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_portal_settings');
      if (error) throw error;
      return (data as { whatsapp: string | null; contact_email: string | null }) || {};
    },
    staleTime: 5 * 60 * 1000,
  });

  const digits = (data?.whatsapp || '').replace(/\D/g, '');
  const whatsappUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent('Olá! Falo pelo portal Coffeelier e gostaria de ajuda com um pedido.')}`
    : '';
  const contactEmail = data?.contact_email || '';
  const contactHref = whatsappUrl || (contactEmail ? `mailto:${contactEmail}` : '#');

  return { whatsappUrl, contactEmail, contactHref };
}
