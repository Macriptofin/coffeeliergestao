import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSecureAuth } from '@/hooks/useSecureAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function PortalLogin() {
  const navigate = useNavigate();
  const { user } = useSecureAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Convidado chega pelo link do e-mail (#type=invite/recovery): definir senha.
  const [mode, setMode] = useState<'login' | 'setpw'>(
    () => (/type=(invite|recovery|signup)/.test(window.location.hash) ? 'setpw' : 'login')
  );

  // Já logado em modo normal → portal cuida do redirecionamento.
  useEffect(() => { if (user && mode === 'login') navigate('/portal', { replace: true }); }, [user, mode, navigate]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('A senha deve ter ao menos 8 caracteres.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { toast.error('Não foi possível definir a senha. O link pode ter expirado.'); return; }
      toast.success('Senha definida! Bem-vindo ao seu portal.');
      navigate('/portal', { replace: true });
    } finally { setSubmitting(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        toast.error('E-mail ou senha inválidos.');
        return;
      }
      navigate('/portal', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) { toast.info('Informe seu e-mail para redefinir a senha.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/portal/login`,
    });
    if (error) toast.error('Não foi possível enviar o e-mail.');
    else toast.success('Enviamos um link de redefinição para seu e-mail.');
  };

  return (
    <div className="min-h-screen flex portal-body">
      {/* Painel de marca */}
      <div className="hidden md:flex w-[46%] flex-col justify-between p-14 text-accent-creme relative overflow-hidden"
           style={{ background: 'linear-gradient(150deg, hsl(20 54% 20%), hsl(25 53% 42%) 60%, hsl(25 53% 49%))' }}>
        <div className="flex items-center gap-2.5 font-display font-bold text-3xl">
          <Coffee className="h-7 w-7" /> Coffeelier
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight max-w-md">
            Sua próxima experiência começa aqui.
          </h1>
          <p className="opacity-85 mt-4 text-base max-w-sm leading-relaxed">
            Acompanhe seus pedidos, aprove propostas e monte novos eventos — com a praticidade que você merece.
          </p>
        </div>
        <p className="text-sm opacity-70">Portal exclusivo para clientes Coffeelier</p>
        <Coffee className="absolute -right-8 -bottom-10 h-72 w-72 opacity-[0.08]" />
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center bg-background px-6">
        {mode === 'setpw' ? (
          <form onSubmit={handleSetPassword} className="w-full max-w-sm">
            <div className="md:hidden flex items-center gap-2 font-display font-bold text-2xl text-primary mb-8">
              <Coffee className="h-6 w-6" /> Coffeelier
            </div>
            <h2 className="font-display text-3xl font-semibold">Defina sua senha</h2>
            <p className="text-muted-foreground mt-2.5 mb-8 text-sm">
              Você foi convidado para o portal. Crie uma senha para ativar seu acesso.
            </p>
            <div className="space-y-1.5 mb-6">
              <Label htmlFor="newpw" className="text-xs text-muted-foreground font-semibold">Nova senha</Label>
              <Input id="newpw" type="password" autoComplete="new-password" required
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="mínimo 8 caracteres" className="h-12 rounded-xl" />
            </div>
            <Button type="submit" disabled={submitting}
              className="w-full h-12 rounded-xl text-base font-semibold text-accent-creme shadow-warm"
              style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
              {submitting ? 'Salvando…' : 'Definir senha e entrar'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="w-full max-w-sm">
            <div className="md:hidden flex items-center gap-2 font-display font-bold text-2xl text-primary mb-8">
              <Coffee className="h-6 w-6" /> Coffeelier
            </div>
            <h2 className="font-display text-3xl font-semibold">Bem-vindo de volta</h2>
            <p className="text-muted-foreground mt-2.5 mb-8 text-sm">
              Entre com o e-mail da sua empresa para acessar seus pedidos.
            </p>

            <div className="space-y-1.5 mb-4">
              <Label htmlFor="email" className="text-xs text-muted-foreground font-semibold">E-mail corporativo</Label>
              <Input id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@suaempresa.com" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-1.5 mb-6">
              <Label htmlFor="password" className="text-xs text-muted-foreground font-semibold">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className="h-12 rounded-xl" />
            </div>

            <Button type="submit" disabled={submitting}
              className="w-full h-12 rounded-xl text-base font-semibold text-accent-creme shadow-warm"
              style={{ background: 'linear-gradient(135deg, hsl(20 54% 22%), hsl(25 53% 49%))' }}>
              {submitting ? 'Entrando…' : 'Entrar no meu portal'}
            </Button>

            <button type="button" onClick={handleReset}
              className="block w-full text-center mt-5 text-sm text-primary hover:underline">
              Esqueci minha senha
            </button>
            <p className="text-center text-xs text-muted-foreground mt-7">
              Acesso liberado pela equipe Coffeelier mediante convite.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
