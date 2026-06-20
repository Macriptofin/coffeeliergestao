import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Redefinição de senha do PORTAL DO CLIENTE — e-mail com identidade Coffeelier (Resend).
// Pública (verify_jwt=false). Anti-enumeração: sempre responde sucesso; só envia
// de fato se o e-mail pertencer a um usuário de portal ativo.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ok = () => new Response(
    JSON.stringify({ success: true, message: "Se o e-mail tiver acesso ao portal, enviaremos um link." }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { email } = await req.json() as { email: string };
    if (!email) return ok();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Encontra o usuário e confirma que é um cliente de portal ativo.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!user) return ok();

    const { data: link } = await admin
      .from('client_users')
      .select('client_id, is_active, clients(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!link) return ok(); // não é usuário de portal (ou inativo) — não envia

    // Gera link de recuperação e envia com a marca Coffeelier.
    const redirectTo = 'https://app.coffeelier.com.br/portal/login';
    const { data: rec, error: recErr } = await admin.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo },
    });
    if (recErr || !rec?.properties?.action_link) {
      console.error("generateLink recovery error:", recErr);
      return ok(); // não revela detalhes
    }

    const clientName = (link as any).clients?.name || 'sua empresa';
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [email],
      subject: "Redefinir a senha do portal Coffeelier",
      html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#3a2417">
        <div style="background:linear-gradient(135deg,#552D19,#C06C3A);color:#FCE8D0;padding:34px 30px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:24px">☕ Portal Coffeelier</h1>
        </div>
        <div style="background:#fff;border:1px solid #eaddcd;border-top:none;padding:30px;border-radius:0 0 14px 14px">
          <p>Olá!</p>
          <p>Recebemos um pedido para redefinir a senha do seu acesso ao portal (${clientName}).</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${rec.properties.action_link}" style="display:inline-block;background:#552D19;color:#FCE8D0;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Criar nova senha
            </a>
          </div>
          <p style="font-size:13px;color:#8a7666">Este link é válido por 1 hora. Se você não pediu a redefinição, pode ignorar este e-mail com segurança.</p>
        </div>
      </div>`,
    });

    return ok();
  } catch (error: any) {
    console.error("portal-reset-password error:", error);
    return ok(); // nunca vaza estado para o cliente não-autenticado
  }
};

serve(handler);
