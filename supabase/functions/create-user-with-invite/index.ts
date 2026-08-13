import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, role, full_name, display_name, password }: { 
      email: string; 
      role: string;
      full_name?: string;
      display_name?: string;
      password?: string;
    } = await req.json();

    console.log("Creating user:", { email, role, full_name, display_name, hasPassword: !!password });

    // Validate input
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);
    
    if (userExists) {
      console.error("User with this email already exists");
      return new Response(
        JSON.stringify({ error: "User already registered" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se senha foi fornecida, criar usuário diretamente
    if (password) {
      console.log("Creating user directly with password");

      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirmar email
        user_metadata: {
          full_name: full_name || null,
          display_name: display_name || full_name || null,
          invited_role: role,
        },
      });

      if (userError) {
        console.error("Error creating user:", userError);
        return new Response(
          JSON.stringify({ error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Criar role do usuário
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userData.user.id,
          role: role,
        });

      if (roleError) {
        console.error("Error creating user role:", roleError);
      }

      // Criar perfil do usuário
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userData.user.id,
          full_name: full_name || null,
          display_name: display_name || full_name || null,
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error("Error creating user profile:", profileError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userData.user.id,
          message: "Usuário criado com sucesso"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fluxo de convite (sem senha)
    console.log("Generating invite link for new user:", email);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // CORREÇÃO DO BUG: generateLink com type='invite' JÁ CRIA o usuário
    // Documentação Supabase: "generateLink() handles the creation of the user for signup, invite and magiclink"
    // Passar role via data para ser processada por trigger após signup
    const redirectTo = 'https://app.coffeelier.com.br/auth';

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo,
        data: {
          invited_at: new Date().toISOString(),
          invited_role: role, // Será usado pelo trigger para criar a role
          full_name: full_name || null,
          display_name: display_name || full_name || null,
        },
      },
    });

    if (inviteError) {
      console.error("Error generating invite link:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to generate invitation link" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Invite link generated successfully. User will be created when they accept.');
    console.log('Invite action_link:', inviteData?.properties?.action_link);

    // Send invitation email via Resend
    const emailResponse = await resend.emails.send({
      from: Deno.env.get("RESEND_FROM_EMAIL") ?? "Coffeelier <onboarding@resend.dev>",
      to: [email],
      subject: "Convite - Sistema Coffeelier",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: #667eea; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .info-box { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 Bem-vindo ao Coffeelier!</h1>
              </div>
              <div class="content">
                <p>Olá!</p>
                <p>Você foi convidado(a) para acessar o sistema <strong>Coffeelier</strong>.</p>
                
                <div class="info-box">
                  <p style="margin: 0;"><strong>📧 Email:</strong> ${email}</p>
                  <p style="margin: 10px 0 0 0;"><strong>👤 Perfil:</strong> ${role}</p>
                </div>

                <p>Para ativar sua conta e definir sua senha, clique no botão abaixo:</p>
                
                <div style="text-align: center;">
                  <a href="${inviteData.properties.action_link}" class="button">
                    Ativar Conta e Definir Senha
                  </a>
                </div>

                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  <strong>Importante:</strong> Este link é válido por 24 horas. Após esse período, será necessário solicitar um novo convite.
                </p>

                <p style="font-size: 14px; color: #6b7280;">
                  Se você não solicitou este convite, pode ignorar este email com segurança.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Coffeelier - Sistema de Gestão</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      return new Response(
        JSON.stringify({ 
          warning: "Invite link generated but email failed to send. User will be created when they click the link.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invitation email sent successfully:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        emailId: emailResponse.data?.id,
        message: "Convite enviado! Usuário será criado quando aceitar o convite."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in create-user-with-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
