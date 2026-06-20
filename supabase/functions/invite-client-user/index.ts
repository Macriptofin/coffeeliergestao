import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convida um usuário do CLIENTE para o portal de autoatendimento.
// Cria o usuário no Auth (via invite), marca user_profiles.user_type='client' e
// vincula em client_users (com portal_role). O cliente define a senha pelo link.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, full_name, client_id, portal_role } = await req.json() as {
      email: string; full_name?: string; client_id: string; portal_role?: string;
    };

    if (!email || !client_id) {
      return new Response(JSON.stringify({ error: "email e client_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const role = portal_role === 'aprovador' ? 'aprovador' : 'solicitante';

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Erros de negócio voltam como 200 {error} para a UI exibir a mensagem (sem overlay).
    const biz = (msg: string) => new Response(JSON.stringify({ error: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Confirma que o cliente existe (e pega o nome para o e-mail).
    const { data: client, error: clientErr } = await admin
      .from('clients').select('name').eq('id', client_id).maybeSingle();
    if (clientErr || !client) return biz("Cliente não encontrado.");

    // Procura usuário existente com este e-mail.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find(u => (u.email || '').toLowerCase() === email.toLowerCase());

    let userId: string;
    let inviteLink: string | null = null;

    if (existing) {
      // Já é usuário interno da equipe? Não pode virar cliente (perderia o acesso interno).
      const { count: roleCount } = await admin
        .from('user_roles').select('*', { count: 'exact', head: true }).eq('user_id', existing.id);
      const { data: prof } = await admin
        .from('user_profiles').select('user_type').eq('user_id', existing.id).maybeSingle();
      const isInternal = (roleCount ?? 0) > 0 || (prof?.user_type ?? 'internal') === 'internal';

      const { count: alreadyClient } = await admin
        .from('client_users').select('*', { count: 'exact', head: true }).eq('user_id', existing.id);

      if (isInternal && (alreadyClient ?? 0) === 0) {
        return biz("Este e-mail já pertence a um usuário interno da equipe. Use um e-mail diferente para o acesso de cliente.");
      }
      // Já é (ou será) cliente — apenas garante o vínculo a este cliente.
      userId = existing.id;
    } else {
      // Cria via convite (gera o usuário no Auth imediatamente).
      const redirectTo = 'https://app.coffeelier.com.br/portal/login';
      const { data: invite, error: inviteErr } = await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo, data: { full_name: full_name || null, user_type: 'client', client_id } },
      });
      if (inviteErr || !invite?.user?.id) {
        console.error("generateLink error:", inviteErr);
        return biz(`Falha ao gerar o convite${inviteErr?.message ? `: ${inviteErr.message}` : ''}.`);
      }
      userId = invite.user.id;
      inviteLink = invite.properties?.action_link ?? null;
    }

    // Perfil (marca como cliente) + vínculo com o cliente.
    await admin.from('user_profiles').upsert(
      { user_id: userId, email, full_name: full_name || null, user_type: 'client' },
      { onConflict: 'user_id' });

    const { error: linkErr } = await admin.from('client_users').upsert(
      { user_id: userId, client_id, portal_role: role, is_active: true },
      { onConflict: 'user_id' });
    if (linkErr) {
      console.error("client_users link error:", linkErr);
      return new Response(JSON.stringify({ error: "Falha ao vincular usuário ao cliente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Link para definir a senha: convite (novo) ou recuperação (usuário já existente).
    let link = inviteLink;
    if (!link) {
      const { data: rec } = await admin.auth.admin.generateLink({
        type: 'recovery', email,
        options: { redirectTo: 'https://app.coffeelier.com.br/portal/login' },
      });
      link = rec?.properties?.action_link ?? null;
    }

    // E-mail de boas-vindas (identidade Coffeelier).
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResp = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [email],
      subject: "Seu acesso ao portal Coffeelier",
      html: `
      <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;color:#3a2417">
        <div style="background:linear-gradient(135deg,#552D19,#C06C3A);color:#FCE8D0;padding:34px 30px;border-radius:14px 14px 0 0">
          <h1 style="margin:0;font-size:24px">☕ Bem-vindo ao portal Coffeelier</h1>
        </div>
        <div style="background:#fff;border:1px solid #eaddcd;border-top:none;padding:30px;border-radius:0 0 14px 14px">
          <p>Olá${full_name ? `, ${full_name}` : ''}!</p>
          <p>Você foi convidado(a) por <strong>${client.name}</strong> para acessar o portal Coffeelier,
             onde poderá acompanhar pedidos e aprovar propostas com praticidade.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${link}" style="display:inline-block;background:#552D19;color:#FCE8D0;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">
              Ativar meu acesso e definir senha
            </a>
          </div>
          <p style="font-size:13px;color:#8a7666">Este link é válido por 24 horas. Se você não esperava este convite, pode ignorar este e-mail.</p>
        </div>
      </div>`,
    });

    return new Response(JSON.stringify({
      success: true,
      message: emailResp.error ? "Acesso criado. Falha ao enviar e-mail — reenvie o convite." : "Convite enviado!",
      user_id: userId,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("invite-client-user error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
};

serve(handler);
