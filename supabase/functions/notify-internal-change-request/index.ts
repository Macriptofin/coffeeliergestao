import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Avisa a EQUIPE Coffeelier por e-mail quando um cliente do Portal registra:
//  - kind 'change' (default): solicitação de ALTERAÇÃO na proposta
//  - kind 'execution': solicitação de FORNECIMENTO (execução de guarda-chuva)
// Complementa o alerta do sininho (criado por trigger no banco) — este e-mail
// cobre o caso "ninguém estava logado no sistema". Destinatário: app_settings
// 'portal.internal_notify_email' (Vendas → Portal → Configurações). Recebe
// proposal_id e localiza a solicitação aberta mais recente da proposta.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { proposal_id, kind } = await req.json() as { proposal_id: string; kind?: 'change' | 'execution' };
    const isExecution = kind === 'execution';
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

    let subject = '';
    let heading = '';
    let intro = '';
    let detailHtml = '';
    let propNumber = '';

    if (isExecution) {
      const { data: request } = await admin
        .from('umbrella_execution_requests')
        .select('name, scheduled_date, scheduled_time, number_of_people, location, notes, client_rooms(name), proposals(proposal_number, event_name, clients(name))')
        .eq('proposal_id', proposal_id)
        .eq('status', 'aberta')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!request) return biz("Nenhuma solicitação de fornecimento aberta para esta proposta.");
      const prop = (request as any).proposals;
      const clientName = prop?.clients?.name || 'Cliente';
      propNumber = prop?.proposal_number || '';
      const dateBr = String(request.scheduled_date || '').split('-').reverse().join('/');
      const time = request.scheduled_time ? String(request.scheduled_time).slice(0, 5) : '';
      const room = (request as any).client_rooms?.name || request.location || '';
      subject = `Solicitação de fornecimento — Proposta ${propNumber} (${clientName})`;
      heading = '📅 Solicitação de fornecimento no Portal';
      intro = `<strong>${clientName}</strong> solicitou um fornecimento no contrato recorrente
        <strong>${propNumber}</strong>${prop?.event_name ? ` — ${prop.event_name}` : ''}:`;
      detailHtml = `
        <strong>${(request.name || 'Fornecimento').replace(/</g, '&lt;')}</strong><br/>
        ${dateBr}${time ? ` às ${time}` : ''} · ${request.number_of_people} pessoas${room ? ` · ${String(room).replace(/</g, '&lt;')}` : ''}
        ${request.notes ? `<br/><em>${String(request.notes).replace(/</g, '&lt;')}</em>` : ''}`;
    } else {
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
      propNumber = prop?.proposal_number || '';
      subject = `Solicitação de alteração — Proposta ${propNumber} (${clientName})`;
      heading = '✏️ Solicitação de alteração no Portal';
      intro = `<strong>${clientName}</strong> solicitou uma alteração na proposta
        <strong>${propNumber}</strong>${prop?.event_name ? ` — ${prop.event_name}` : ''}:`;
      detailHtml = String(request.message || '').replace(/</g, '&lt;');
    }

    const adminUrl = 'https://app.coffeelier.com.br/vendas#portal';
    const footer = isExecution
      ? 'Aprove ou recuse pelo painel "Saldo e execuções" da proposta — a aprovação gera o evento e as ordens automaticamente. A solicitação também aparece no sininho de alertas.'
      : 'A solicitação também aparece no sininho de alertas e em Vendas → Portal → Solicitações.';

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResp = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [to],
      subject,
      html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#3a2417">
        <div style="background:linear-gradient(135deg,#552D19,#C06C3A);color:#FCE8D0;padding:34px 30px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:22px">${heading}</h1>
        </div>
        <div style="background:#fff;border:1px solid #eaddcd;border-top:none;padding:30px;border-radius:0 0 14px 14px">
          <p>${intro}</p>
          <p style="background:#FCE8D0;border-radius:10px;padding:14px 18px;margin:18px 0;white-space:pre-wrap">${detailHtml}</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${adminUrl}" style="display:inline-block;background:#552D19;color:#FCE8D0;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Abrir no sistema
            </a>
          </div>
          <p style="font-size:13px;color:#8a7666">${footer}</p>
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
