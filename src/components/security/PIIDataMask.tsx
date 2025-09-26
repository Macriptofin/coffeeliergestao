import { useState, memo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';

interface PIIDataMaskProps {
  data: string;
  type: 'email' | 'cpf' | 'cnpj' | 'phone' | 'address' | 'name';
  resourceId?: string;
  resourceType?: string;
  showToggle?: boolean;
  className?: string;
}

const maskingRules = {
  email: (data: string) => {
    if (!data?.includes('@')) return data;
    const [local, domain] = data.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  },
  cpf: (data: string) => {
    const numbers = data?.replace(/\D/g, '') || '';
    if (numbers.length !== 11) return data;
    return `***.***.***-${numbers.slice(-2)}`;
  },
  cnpj: (data: string) => {
    const numbers = data?.replace(/\D/g, '') || '';
    if (numbers.length !== 14) return data;
    return `**.***.***/**${numbers.slice(-4)}`;
  },
  phone: (data: string) => {
    const numbers = data?.replace(/\D/g, '') || '';
    if (numbers.length < 6) return data;
    return `****-${numbers.slice(-4)}`;
  },
  address: (data: string) => {
    if (!data || data.length < 10) return data;
    return `${data.substring(0, 10)}...`;
  },
  name: (data: string) => {
    if (!data) return data;
    const parts = data.split(' ');
    if (parts.length === 1) return `${parts[0].substring(0, 2)}***`;
    return `${parts[0]} ${parts[parts.length - 1].substring(0, 1)}***`;
  }
};

export const PIIDataMask = memo(function PIIDataMask({ 
  data, 
  type, 
  resourceId, 
  resourceType = 'general',
  showToggle = true, 
  className = '' 
}: PIIDataMaskProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const { isAdmin } = useUserRole();
  const { logPIIAccess } = useSecurityMonitoring();

  // Admins can see sensitive data by default, others see masked
  const canViewSensitiveData = isAdmin();
  const shouldMask = !canViewSensitiveData && !isRevealed;

  const handleToggleVisibility = async () => {
    // Skip logging in preview environment to prevent loops
    const isPreview = window.location.hostname.includes('lovableproject.com') || 
                      window.location.hostname.includes('lovable.app');
    
    if (!isRevealed && !canViewSensitiveData && !isPreview) {
      // Log PII access attempt only in production
      await logPIIAccess(
        resourceId || null,
        'MANUAL_REVEAL',
        [type]
      );
    }
    
    setIsRevealed(!isRevealed);
  };

  const displayData = shouldMask && data 
    ? maskingRules[type]?.(data) || data 
    : data;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={shouldMask ? 'font-mono text-muted-foreground' : ''}>
        {displayData || '-'}
      </span>
      
      {showToggle && data && !canViewSensitiveData && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleVisibility}
          className="h-6 w-6 p-0 hover:bg-muted"
        >
          {isRevealed ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
});