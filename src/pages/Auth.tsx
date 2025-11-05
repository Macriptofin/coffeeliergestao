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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const navigate = useNavigate();
  const { validatePassword, isValidating } = usePasswordSecurity();
  const { checkRateLimit, logAuthAttempt, isChecking } = useRateLimiting();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);

    console.log('=== AUTH PAGE DEBUG ===');
    console.log('Full URL:', window.location.href);
    console.log('Hash params:', Object.fromEntries(hash.entries()));
    console.log('Query params:', Object.fromEntries(query.entries()));

    const type = hash.get('type') ?? query.get('type');
    const tokenHash = hash.get('token_hash') ?? query.get('token_hash');
    const code = query.get('code') ?? hash.get('code');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const inviteFlag = query.get('invite');
    const error = hash.get('error') ?? query.get('error');
    const errorDescription = hash.get('error_description') ?? query.get('error_description');
    
    console.log('Detected type:', type);
    console.log('Has token_hash:', !!tokenHash);
    console.log('Has access_token:', !!accessToken);
    console.log('Error:', error);
    console.log('Error Description:', errorDescription);
    
    // PRIORIDADE 1: Detectar modo de recuperação de senha
    // Verificar se é um fluxo de recovery por vários indicadores
    const isRecoveryFlow = 
      type === 'recovery' || 
      (accessToken && refreshToken && (
        errorDescription?.toLowerCase().includes('password') ||
        errorDescription?.toLowerCase().includes('recovery') ||
        hash.toString().includes('recovery') ||
        query.toString().includes('recovery')
      ));
    
    if (isRecoveryFlow) {
      console.log('✅ Modo recuperação de senha ATIVADO');
      setIsPasswordRecovery(true);

      // Trocar "code" por sessão (fluxo PKCE) OU estabelecer sessão via tokens no hash
      if (code) {
        console.log('Trocando code por sessão (recovery)...');
        setTimeout(async () => {
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.error('Erro ao trocar code por sessão (recovery):', error);
            } else {
              // Limpar o code da URL para não reprocessar
              const base = `${window.location.origin}/auth#type=recovery`;
              window.history.replaceState({}, '', base);
            }
          } catch (err) {
            console.error('Falha ao processar sessão de recovery:', err);
          }
        }, 0);
      } else if (accessToken && refreshToken) {
        console.log('Estabelecendo sessão para recovery...');
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => {
            const base = `${window.location.origin}/auth#type=recovery`;
            window.history.replaceState({}, '', base);
          })
          .catch(err => console.error('Erro ao estabelecer sessão para recovery:', err));
      }
      return;
    }
    
    // PRIORIDADE 2: Processar convites já aceitos (com access_token)
    if (accessToken && refreshToken && !isRecoveryFlow) {
      console.log('Convite já processado, estabelecendo sessão...');
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(async ({ data, error }) => {
          if (error) {
            console.error('Erro ao estabelecer sessão:', error);
            setError('Erro ao processar convite. Tente novamente.');
            return;
          }
          
          const { data: { session: verifiedSession } } = await supabase.auth.getSession();
          if (verifiedSession) {
            console.log('Sessão estabelecida com sucesso, redirecionando...');
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
    
    // PRIORIDADE 3: Modo convite (ainda não processado)
    if (type === 'invite' || inviteFlag === 'true' || tokenHash || code) {
      console.log('Modo convite detectado:', { type, tokenHash: !!tokenHash, code: !!code });
      setIsInviteMode(true);
      return;
    }

    // PRIORIDADE 4: Verificar se já está logado
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


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth#type=recovery`,
      });

      if (error) {
        setError('Erro ao enviar email de recuperação. Verifique o endereço e tente novamente.');
      } else {
        setResetEmailSent(true);
        toast.success('Email de recuperação enviado! Verifique sua caixa de entrada e clique no link apenas UMA vez.');
      }
    } catch (error: any) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    // Validar senha
    const validation = await validatePassword(password);
    if (!validation.valid) {
      setError(validation.message);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError('Erro ao redefinir senha. Tente novamente.');
      } else {
        toast.success('Senha redefinida com sucesso!');
        navigate('/');
      }
    } catch (error: any) {
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

  

  // Render password recovery form (after clicking email link)
  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/lovable-uploads/capa-sistema.png"
            alt="Mesa especial Coffeelier com diversos pratos gourmet"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>

        {/* Floating card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-border/50">
            <div className="mb-6 flex justify-center">
              <CoffeelierLogo />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Redefinir Senha
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Digite sua nova senha segura
              </p>
              
              <form onSubmit={handlePasswordRecovery} className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    NOVA SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder="Digite sua nova senha"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
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
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    CONFIRMAR SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder="Confirme sua nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading || isValidating || !!passwordValidationMessage}
                >
                  {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render forgot password form
  if (isForgotPassword) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/lovable-uploads/capa-sistema.png"
            alt="Mesa especial Coffeelier com diversos pratos gourmet"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>

        {/* Floating card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-border/50">
            <div className="mb-6 flex justify-center">
              <CoffeelierLogo />
            </div>
            
            {resetEmailSent ? (
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Email Enviado!
                </h2>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                  </p>
                  <div className="bg-accent/30 border border-accent rounded-lg p-3 text-left">
                    <p className="text-xs font-medium text-accent-foreground mb-1">⚠️ Importante:</p>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Clique no link do email apenas UMA vez</li>
                      <li>O link expira em 1 hora</li>
                      <li>Se expirar, solicite um novo link</li>
                    </ul>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetEmailSent(false);
                    setEmail('');
                  }}
                  className="w-full"
                >
                  Voltar ao Login
                </Button>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Esqueci Minha Senha
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Digite seu email para receber instruções de recuperação
                </p>
                
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      E-MAIL
                    </h3>
                    <Input
                      type="email"
                      placeholder="seu.email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
                  </Button>

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setError('');
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ← Voltar ao login
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render invite activation form
  if (isInviteMode) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Background image */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/lovable-uploads/capa-sistema.png"
            alt="Mesa especial Coffeelier com diversos pratos gourmet"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        </div>

        {/* Floating login card */}
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-border/50">
            <div className="mb-6">
              <CoffeelierLogo />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Ative sua conta
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Defina uma senha segura para acessar o sistema Coffeelier
              </p>
              
              <form onSubmit={handleInviteActivation} className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    NOVA SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder="Digite uma senha segura"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
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
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    CONFIRMAR SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder="Confirme sua senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading || isValidating || !!passwordValidationMessage}
                >
                  {loading ? 'Ativando...' : 'Ativar Conta'}
                </Button>

                <div className="text-center text-xs text-muted-foreground mt-4">
                  Link expirado?{' '}
                  <button 
                    type="button"
                    onClick={() => navigate('/auth')}
                    className="text-primary hover:text-primary/90 transition-colors"
                  >
                    Solicitar novo convite
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/lovable-uploads/capa-sistema.png"
          alt="Mesa especial Coffeelier com diversos pratos gourmet"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      </div>

      {/* Floating login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-border/50">
          <div className="mb-6 flex justify-center">
            <CoffeelierLogo />
          </div>
          
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Sistema de Gestão
            </h2>
            <p className="text-sm text-muted-foreground">
              Gostaria de entrar e vender uma xícara de café?
            </p>
          </div>
          
          <div>
            
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  E-MAIL
                </h3>
                <Input
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  SENHA
                </h3>
                <Input
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>


              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading || isChecking}
              >
                {loading || isChecking ? 'Verificando...' : 'Entrar'}
              </Button>

              <div className="text-center mt-4">
                <button 
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                <p className="text-xs text-accent-foreground text-center">
                  <span className="font-semibold">🔐 Acesso Restrito</span>
                  <br />
                  Este sistema é exclusivo para colaboradores autorizados.
                  <br />
                  Caso ainda não tenha acesso, solicite um convite ao administrador do sistema.
                </p>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Auth;
