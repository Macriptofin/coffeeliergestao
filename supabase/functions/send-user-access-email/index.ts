import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Envia (ou reenvia) o e-mail de acesso pro usuário definir a própria senha e entrar —
// substitui o fluxo anterior de "admin cria com senha e repassa por fora" (que não
// mandava e-mail nenhum) e o "Reenviar verificação" (que usa o e-mail genérico do
// Supabase, sem a marca Coffeelier). Gera um link de recovery e manda via Resend.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { user_id }: { user_id: string } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerErr } = await supabaseClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roles, error: roleErr } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "manager"]);
    if (roleErr || !roles?.length) {
      return new Response(JSON.stringify({ error: "Apenas admins/gerentes podem enviar e-mail de acesso" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: targetData, error: targetErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (targetErr || !targetData?.user?.email) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const email = targetData.user.email;
    const fullName = targetData.user.user_metadata?.full_name || targetData.user.user_metadata?.display_name || "";

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://app.coffeelier.com.br/auth" },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error("Error generating recovery link:", linkErr);
      return new Response(JSON.stringify({ error: "Falha ao gerar link de acesso" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResp = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [email],
      subject: "Acesso ao Sistema Coffeelier",
      html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#3a2417">
        <div style="background:linear-gradient(135deg,#552D19,#C06C3A);color:#FCE8D0;padding:34px 30px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:24px">☕ Bem-vindo(a) ao Coffeelier</h1>
        </div>
        <div style="background:#fff;border:1px solid #eaddcd;border-top:none;padding:30px;border-radius:0 0 14px 14px">
          <p>Olá${fullName ? `, ${fullName}` : ""}!</p>
          <p>Sua conta no Sistema de Gestão da Coffeelier está pronta. Clique no botão abaixo para definir sua senha e acessar:</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${linkData.properties.action_link}" style="display:inline-block;background:#552D19;color:#FCE8D0;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Definir senha e entrar
            </a>
          </div>
          <p style="font-size:13px;color:#8a7666">Seu e-mail de acesso é <strong>${email}</strong>. Se o link expirar, peça pra equipe reenviar este e-mail.</p>
        </div>
      </div>`,
    });

    if (emailResp.error) {
      console.error("Error sending access email:", emailResp.error);
      return new Response(JSON.stringify({ error: "Link gerado, mas o e-mail falhou ao enviar." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: true, message: `E-mail de acesso enviado para ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-user-access-email function:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
