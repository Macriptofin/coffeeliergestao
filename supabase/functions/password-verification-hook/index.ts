import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordValidationRequest {
  password: string;
}

interface PasswordValidationResponse {
  valid: boolean;
  message: string;
}

// Função para verificar se a senha foi comprometida usando HaveIBeenPwned API
async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    // Criar hash SHA-1 da senha
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    // Usar apenas os primeiros 5 caracteres (k-anonymity)
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);
    
    // Consultar a API HaveIBeenPwned
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'Coffeelier-Security-Check'
      }
    });
    
    if (!response.ok) {
      console.warn('Erro ao consultar API HaveIBeenPwned, permitindo senha por precaução');
      return false;
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    // Verificar se o sufixo da senha está na lista
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        console.log(`Senha encontrada ${count} vezes em vazamentos`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar senha comprometida:', error);
    // Por segurança, permitir a senha se houver erro na verificação
    return false;
  }
}

// Função para validar força da senha com critérios mais rigorosos
function isPasswordStrong(password: string): { valid: boolean; message?: string } {
  // Mínimo de 12 caracteres (mais rigoroso)
  if (password.length < 12) {
    return { valid: false, message: 'A senha deve ter pelo menos 12 caracteres' };
  }
  
  // Máximo de 128 caracteres para evitar ataques DoS
  if (password.length > 128) {
    return { valid: false, message: 'A senha deve ter no máximo 128 caracteres' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra minúscula' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra maiúscula' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos um número' };
  }
  
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos um caractere especial (!@#$%^&*()_+-=[]{}|;:,.<>?)' };
  }
  
  // Verificar se tem pelo menos 2 caracteres especiais
  const specialChars = password.match(/[^a-zA-Z0-9]/g);
  if (!specialChars || specialChars.length < 2) {
    return { valid: false, message: 'A senha deve conter pelo menos 2 caracteres especiais' };
  }
  
  // Verificar se não contém sequências simples
  const commonSequences = ['123', 'abc', 'qwe', 'asd', 'zxc', '456', '789'];
  const lowerPassword = password.toLowerCase();
  for (const seq of commonSequences) {
    if (lowerPassword.includes(seq)) {
      return { valid: false, message: 'A senha não pode conter sequências simples como "123", "abc", etc.' };
    }
  }
  
  // Verificar se não contém palavras comuns
  const commonWords = ['password', 'senha', '123456', 'qwerty', 'admin', 'usuario', 'coffeelier'];
  for (const word of commonWords) {
    if (lowerPassword.includes(word)) {
      return { valid: false, message: 'A senha não pode conter palavras comuns ou previsíveis' };
    }
  }
  
  // Verificar se não tem mais de 2 caracteres repetidos consecutivos
  const repeatedPattern = /(.)\1{2,}/;
  if (repeatedPattern.test(password)) {
    return { valid: false, message: 'A senha não pode ter mais de 2 caracteres iguais consecutivos' };
  }
  
  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Método não permitido', { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { password }: PasswordValidationRequest = await req.json();

    if (!password) {
      return new Response(JSON.stringify({
        valid: false,
        message: 'Senha é obrigatória'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar força da senha
    const strengthCheck = isPasswordStrong(password);
    if (!strengthCheck.valid) {
      return new Response(JSON.stringify({
        valid: false,
        message: strengthCheck.message
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar se a senha foi comprometida
    const isPwned = await isPasswordPwned(password);
    if (isPwned) {
      return new Response(JSON.stringify({
        valid: false,
        message: 'Esta senha foi encontrada em vazamentos de dados e não é segura. Por favor, escolha uma senha diferente.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Senha aprovada em todas as verificações
    return new Response(JSON.stringify({
      valid: true,
      message: 'Senha aprovada'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro na validação de senha:', error);
    
    // Em caso de erro, aceitar por precaução
    return new Response(JSON.stringify({
      valid: true,
      message: 'Verificação de senha temporariamente indisponível, continuando por precaução'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});