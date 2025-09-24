import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PasswordValidationResult {
  valid: boolean;
  message: string;
}

export function usePasswordSecurity() {
  const [isValidating, setIsValidating] = useState(false);

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
        return { 
          valid: true, 
          message: 'Verificação de senha temporariamente indisponível' 
        };
      }

      return data as PasswordValidationResult;
    } catch (error) {
      console.error('Erro na validação de senha:', error);
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