import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.190.0/hash/mod.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const hookSecret = Deno.env.get("PASSWORD_VERIFICATION_HOOK_SECRET");

interface WebhookPayload {
  user_id: string;
  password: string;
  valid: boolean;
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

// Função para validar força da senha
function isPasswordStrong(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'A senha deve ter pelo menos 8 caracteres' };
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
    return { valid: false, message: 'A senha deve conter pelo menos um caractere especial' };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    // Verificar webhook signature
    if (hookSecret) {
      const wh = new Webhook(hookSecret);
      try {
        wh.verify(payload, headers);
      } catch (error) {
        console.error('Erro na verificação do webhook:', error);
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const { user_id, password, valid }: WebhookPayload = JSON.parse(payload);

    // Se a senha já é inválida por outras razões, manter como inválida
    if (!valid) {
      return new Response(JSON.stringify({
        decision: 'reject',
        message: 'Senha inválida'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar força da senha
    const strengthCheck = isPasswordStrong(password);
    if (!strengthCheck.valid) {
      return new Response(JSON.stringify({
        decision: 'reject',
        message: strengthCheck.message
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar se a senha foi comprometida
    const isPwned = await isPasswordPwned(password);
    if (isPwned) {
      return new Response(JSON.stringify({
        decision: 'reject',
        message: 'Esta senha foi encontrada em vazamentos de dados e não é segura. Por favor, escolha uma senha diferente.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Senha aprovada em todas as verificações
    return new Response(JSON.stringify({
      decision: 'continue',
      message: 'Senha aprovada'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Erro no hook de verificação de senha:', error);
    
    // Em caso de erro, continuar por segurança (evitar lock-out de usuários)
    return new Response(JSON.stringify({
      decision: 'continue',
      message: 'Verificação de senha temporariamente indisponível'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});