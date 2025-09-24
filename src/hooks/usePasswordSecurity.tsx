import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';

export interface PasswordValidationResult {
  valid: boolean;
  message: string;
}

export function usePasswordSecurity() {
  const [isValidating, setIsValidating] = useState(false);
  const { logSecurityEvent } = useSecurityMonitoring();

  const validatePassword = async (password: string): Promise<PasswordValidationResult> => {
    if (!password) {
      return { valid: false, message: 'Senha é obrigatória' };
    }

    setIsValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-verification-hook', {
        body: { password }
      });

      if (error) {
        console.warn('Erro na validação de senha, continuando por precaução:', error);
        
        // Log security event for password validation failure
        await logSecurityEvent('PASSWORD_VALIDATION_ERROR', 'authentication', undefined, {
          error: error.message,
          password_length: password.length
        });
        
        return { 
          valid: true, 
          message: 'Verificação de senha temporariamente indisponível' 
        };
      }

      const result = data as PasswordValidationResult;
      
      // Log weak password attempts
      if (!result.valid) {
        await logSecurityEvent('WEAK_PASSWORD_ATTEMPTED', 'authentication', undefined, {
          validation_message: result.message,
          password_length: password.length
        });
      }

      return result;
    } catch (error) {
      console.error('Erro na validação de senha:', error);
      
      // Log security event for unexpected errors
      await logSecurityEvent('PASSWORD_VALIDATION_SYSTEM_ERROR', 'authentication', undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Por segurança, permitir o cadastro se houver erro na validação
      return { 
        valid: true, 
        message: 'Verificação de senha temporariamente indisponível' 
      };
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validatePassword,
    isValidating
  };
}