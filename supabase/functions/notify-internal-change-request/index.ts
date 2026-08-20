import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Avisa a EQUIPE Coffeelier por e-mail quando um cliente do Portal registra uma
// solicitação de alteração (complementa o alerta do sininho, criado por trigger
// no banco — este e-mail cobre o caso "ninguém estava logado no sistema").
// Destinatário: app_settings 'portal.internal_notify_email' (configurável em
// Vendas → Portal → Configurações). Recebe proposal_id e localiza a solicitação
// aberta mais recente da proposta (a RPC request_proposal_change não devolve o id).
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { proposal_id } = await req.json() as { proposal_id: string };
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const biz = (msg: string) => new Response(JSON.stringify({ error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: setting } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'portal.internal_notify_email')
      .maybeSingle();
    const to = (setting?.value || '').trim();
    if (!to) return biz("Sem e-mail de avisos internos configurado (Vendas → Portal → Configurações).");

    const { data: request } = await admin
      .from('proposal_change_requests')
      .select('id, message, created_at, proposals(proposal_number, event_name, clients(name))')
      .eq('proposal_id', proposal_id)
      .eq('status', 'aberta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!request) return biz("Nenhuma solicitação aberta encontrada para esta proposta.");

    const prop = (request as any).proposals;
    const clientName = prop?.clients?.name || 'Cliente';
    const adminUrl = 'https://app.coffeelier.com.br/vendas#portal';

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResp = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [to],
      subject: `Solicitação de alteração — Proposta ${prop?.proposal_number || ''} (${clientName})`,
      html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#3a2417">
        <div style="background:linear-gradient(135deg,#552D19,#C06C3A);color:#FCE8D0;padding:34px 30px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:22px">✏️ Solicitação de alteração no Portal</h1>
        </div>
        <div style="background:#fff;border:1px solid #eaddcd;border-top:none;padding:30px;border-radius:0 0 14px 14px">
          <p><strong>${clientName}</strong> solicitou uma alteração na proposta
            <strong>${prop?.proposal_number || ''}</strong>${prop?.event_name ? ` — ${prop.event_name}` : ''}:</p>
          <p style="background:#FCE8D0;border-radius:10px;padding:14px 18px;margin:18px 0;white-space:pre-wrap">${(request.message || '').replace(/</g, '&lt;')}</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${adminUrl}" style="display:inline-block;background:#552D19;color:#FCE8D0;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Abrir solicitações no sistema
            </a>
          </div>
          <p style="font-size:13px;color:#8a7666">A solicitação também aparece no sininho de alertas e em Vendas → Portal → Solicitações.</p>
        </div>
      </div>`,
    });

    return new Response(JSON.stringify({
      success: !emailResp.error,
      message: emailResp.error ? "Falha ao enviar o e-mail interno." : "Equipe notificada por e-mail.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("notify-internal-change-request error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
