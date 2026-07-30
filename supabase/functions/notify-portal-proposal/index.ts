import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Avisa por e-mail o solicitante (portal_created_by) de que uma proposta está
// disponível pra ele no Portal. Acesso do cliente é sempre pelo Portal autenticado —
// este e-mail só notifica, não carrega link de aprovação direta.
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

    const { data: proposal, error: propErr } = await admin
      .from('proposals')
      .select('proposal_number, event_name, portal_created_by, clients(name)')
      .eq('id', proposal_id)
      .maybeSingle();
    if (propErr || !proposal) return biz("Proposta não encontrada.");
    if (!proposal.portal_created_by) return biz("Proposta sem solicitante do portal vinculado — nada a notificar.");

    const { data: prof } = await admin
      .from('user_profiles')
      .select('full_name, email')
      .eq('user_id', proposal.portal_created_by)
      .maybeSingle();
    if (!prof?.email) return biz("Solicitante sem e-mail cadastrado.");

    const clientName = (proposal as any).clients?.name || '';
    const loginUrl = 'https://app.coffeelier.com.br/portal/login';

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResp = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [prof.email],
      subject: `Nova proposta disponível: ${proposal.proposal_number}`,
      html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#3a2417">
        <div style="background:linear-gradient(135deg,#552D19,#C06C3A);color:#FCE8D0;padding:34px 30px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:24px">☕ Nova proposta no seu portal Coffeelier</h1>
        </div>
        <div style="background:#fff;border:1px solid #eaddcd;border-top:none;padding:30px;border-radius:0 0 14px 14px">
          <p>Olá${prof.full_name ? `, ${prof.full_name}` : ''}!</p>
          <p>${clientName ? `<strong>${clientName}</strong> tem uma` : 'Você tem uma'} nova proposta disponível
             para acompanhamento e aprovação:</p>
          <p style="background:#FCE8D0;border-radius:10px;padding:14px 18px;margin:18px 0">
            <strong>${proposal.proposal_number}</strong>${proposal.event_name ? ` — ${proposal.event_name}` : ''}
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${loginUrl}" style="display:inline-block;background:#552D19;color:#FCE8D0;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Acessar o Portal
            </a>
          </div>
          <p style="font-size:13px;color:#8a7666">Entre com seu e-mail e senha cadastrados para ver os detalhes, aprovar ou solicitar alteração.</p>
        </div>
      </div>`,
    });

    return new Response(JSON.stringify({
      success: true,
      message: emailResp.error ? "Proposta enviada, mas houve falha ao notificar por e-mail." : "Notificação enviada!",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("notify-portal-proposal error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
