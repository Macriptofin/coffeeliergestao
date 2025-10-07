import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CoffeelierLogo } from '@/components/CoffeelierLogo';
import { usePasswordSecurity } from '@/hooks/usePasswordSecurity';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { toast } from 'sonner';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordValidationMessage, setPasswordValidationMessage] = useState('');
  const [isInviteMode, setIsInviteMode] = useState(false);
  const navigate = useNavigate();
  const { validatePassword, isValidating } = usePasswordSecurity();
  const { checkRateLimit, logAuthAttempt, isChecking } = useRateLimiting();

  useEffect(() => {
    // Detectar modo convite via múltiplos parâmetros de fallback
    // O Supabase pode retornar o link de convite em diferentes formatos:
    // - ?type=invite&token_hash=... (formato padrão)
    // - #access_token=...&refresh_token=... (após aceitar convite)
    // - ?code=... (PKCE flow)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);

    const type = hash.get('type') ?? query.get('type');
    const tokenHash = hash.get('token_hash') ?? query.get('token_hash');
    const code = query.get('code') ?? hash.get('code');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const inviteFlag = query.get('invite');
    
    // Se tem access_token + refresh_token no hash, já está autenticado (convite aceito)
    if (accessToken && refreshToken) {
      console.log('Convite já processado, estabelecendo sessão...');
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(async ({ data, error }) => {
          if (error) {
            console.error('Erro ao estabelecer sessão:', error);
            setError('Erro ao processar convite. Tente novamente.');
            return;
          }
          
          // Verificar se sessão foi estabelecida
          const { data: { session: verifiedSession } } = await supabase.auth.getSession();
          if (verifiedSession) {
            console.log('Sessão estabelecida com sucesso, redirecionando...');
            // Pequeno delay para garantir que a sessão está pronta
            setTimeout(() => navigate('/'), 100);
          } else {
            setError('Erro ao processar convite. Tente novamente.');
          }
        })
        .catch((error) => {
          console.error('Erro ao estabelecer sessão:', error);
          setError('Erro ao processar convite. Tente novamente.');
        });
      return;
    }
    
    // Se tem indicadores de convite, ativar modo convite
    if (type === 'invite' || inviteFlag === 'true' || tokenHash || code) {
      console.log('Modo convite detectado:', { type, tokenHash: !!tokenHash, code: !!code });
      setIsInviteMode(true);
      return;
    }

    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkSession();
  }, [navigate, searchParams]);

  const handlePasswordChange = async (newPassword: string) => {
    setPassword(newPassword);
    setPasswordValidationMessage('');
    
    if (newPassword.length >= 6) {
      const validation = await validatePassword(newPassword);
      if (!validation.valid) {
        setPasswordValidationMessage(validation.message);
      }
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check rate limiting first
      const rateLimitCheck = await checkRateLimit(email, 'signin');
      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.message || 'Muitas tentativas. Tente mais tarde.');
        await logAuthAttempt(email, 'signin', false, rateLimitCheck.reason);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const failureReason = error.message.includes('Invalid login credentials') 
          ? 'invalid_credentials' 
          : 'auth_error';
          
        await logAuthAttempt(email, 'signin', false, failureReason);
        
        if (error.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos.');
        } else {
          setError(error.message);
        }
      } else {
        await logAuthAttempt(email, 'signin', true);
        toast.success('Login realizado com sucesso!');
        navigate('/');
      }
    } catch (error: any) {
      await logAuthAttempt(email, 'signin', false, 'unexpected_error');
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };


  const handleInviteActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    // Validar senha antes de ativar
    const validation = await validatePassword(password);
    if (!validation.valid) {
      setError(validation.message);
      setLoading(false);
      return;
    }

    try {
      const tokenHash = searchParams.get('token_hash');
      const code = searchParams.get('code');
      const type = searchParams.get('type');

      // Garantir que temos uma sessão ativa antes de atualizar a senha
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (code) {
          console.log('Trocando code por sessão...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Erro ao trocar code por sessão:', error);
            setError('Link de convite inválido ou expirado. Solicite um novo convite.');
            setLoading(false);
            return;
          }
          session = data.session;
        } else if (tokenHash) {
          console.log('Verificando convite via token_hash...');
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'invite'
          });
          if (error) {
            console.error('Erro ao verificar convite:', error);
            setError('Link de convite inválido ou expirado. Solicite um novo convite.');
            setLoading(false);
            return;
          }
          session = data.session;
        } else if (type === 'invite') {
          setError('Link de convite inválido ou expirado. Abra novamente pelo e-mail.');
          setLoading(false);
          return;
        }
      }

      console.log('Sessão estabelecida, atualizando senha...');
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        setError('Erro ao definir senha. Tente novamente.');
        setLoading(false);
        return;
      }

      console.log('Senha atualizada com sucesso!');
      
      // Verificar se sessão está ativa antes de redirecionar
      const { data: { session: verifiedSession } } = await supabase.auth.getSession();
      if (verifiedSession) {
        toast.success('Conta ativada com sucesso!');
        // Pequeno delay para garantir que a sessão está pronta
        setTimeout(() => navigate('/'), 100);
      } else {
        toast.error('Erro ao estabelecer sessão. Faça login manualmente.');
        setIsInviteMode(false);
      }
    } catch (error: any) {
      console.error('Unexpected error during invite activation:', error);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  

  // Render invite activation form
  if (isInviteMode) {
    return (
      <div className="min-h-screen bg-gray-100 flex">
        {/* Left side - Invite Activation Form */}
        <div className="w-full lg:w-2/5 flex flex-col justify-center px-6 py-8 sm:px-12 lg:px-16 xl:px-20">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6">
              <CoffeelierLogo />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Ative sua conta
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Defina uma senha segura para acessar o sistema Coffeelier
              </p>
              
              <form onSubmit={handleInviteActivation} className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                    NOVA SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder="Digite uma senha segura"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {passwordValidationMessage && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">{passwordValidationMessage}</AlertDescription>
                    </Alert>
                  )}
                  {isValidating && (
                    <p className="text-xs text-muted-foreground mt-1">Verificando segurança da senha...</p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                    CONFIRMAR SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder="Confirme sua senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                  disabled={loading || isValidating || !!passwordValidationMessage}
                >
                  {loading ? 'Ativando...' : 'Ativar Conta'}
                </Button>

                <div className="text-center text-xs text-gray-600 mt-4">
                  Link expirado?{' '}
                  <button 
                    type="button"
                    onClick={() => navigate('/auth')}
                    className="text-primary hover:underline"
                  >
                    Solicitar novo convite
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right side - Promotional image */}
        <div className="hidden lg:block relative lg:w-3/5">
          <img 
            src="/lovable-uploads/Capa sistema.png.png" 
            alt="Mesa especial Coffeelier com diversos pratos gourmet"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-2/5 flex flex-col justify-center px-6 py-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6">
            <CoffeelierLogo />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Acesso ao Sistema
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Entre com suas credenciais para acessar o sistema Coffeelier
            </p>
            
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                  E-MAIL
                </h3>
                <Input
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                  SENHA
                </h3>
                <Input
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>


              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                disabled={loading || isChecking}
              >
                {loading || isChecking ? 'Verificando...' : 'Entrar'}
              </Button>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800 text-center">
                  <span className="font-semibold">🔐 Acesso Restrito</span>
                  <br />
                  Este sistema é exclusivo para colaboradores autorizados.
                  <br />
                  Caso ainda não tenha acesso, solicite um convite ao administrador do sistema.
                </p>
              </div>
            </form>
          </div>

          {/* Footer links */}
          <div className="mt-12">
            <div className="text-xs text-gray-500 mb-3">
              Baixe nosso app:
            </div>
            <div className="flex space-x-3">
              <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                <span className="text-white text-xs">▶</span>
              </div>
              <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
                <span className="text-white text-xs">🍎</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Promotional image */}
      <div className="hidden lg:block relative lg:w-3/5">
        <img 
          src="/lovable-uploads/Capa sistema.png.png" 
          alt="Mesa especial Coffeelier com diversos pratos gourmet"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default Auth;