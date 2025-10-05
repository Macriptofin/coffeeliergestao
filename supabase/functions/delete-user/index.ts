import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteUserRequest {
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'userId é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('Missing required Supabase env vars');
      return new Response(JSON.stringify({ success: false, error: 'Server not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create client with user token for authorization check
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user }, error: getUserErr } = await userClient.auth.getUser();
    if (getUserErr || !user) {
      console.error('Error getting user:', getUserErr);
      return new Response(JSON.stringify({ success: false, error: 'Usuário inválido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Prevent self-deletion
    if (user.id === userId) {
      return new Response(JSON.stringify({ success: false, error: 'Você não pode deletar o próprio usuário' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify admin role using security definer function
    const { data: isAdmin, error: roleErr } = await userClient.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'admin' 
    });
    
    if (roleErr) {
      console.error('Error checking admin role:', roleErr);
      return new Response(JSON.stringify({ success: false, error: 'Erro ao verificar permissões' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Admin client for privileged operations (bypass RLS)
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Clean dependencies
    const tables = [
      'hr_permissions',
      'financial_permissions',
      'client_assignments',
      'user_permissions',
      'user_roles',
      'user_profiles',
    ];

    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) {
        console.warn(`Erro ao limpar ${table}:`, error.message);
      }
    }

    // Delete from auth.users
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('Erro ao deletar usuário do auth:', delErr);
      return new Response(JSON.stringify({ success: false, error: delErr.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Log security alert (best effort)
    try {
      await admin.rpc('create_security_alert', {
        p_alert_type: 'user_deleted',
        p_severity: 'medium',
        p_title: 'Usuário excluído',
        p_description: `Usuário ${userId} removido por ${user.id}`,
        p_ip_address: null,
        p_metadata: { target_user: userId, actor: user.id },
      } as any);
    } catch (_) {}

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e: any) {
    console.error('Erro no delete-user:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});