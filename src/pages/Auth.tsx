import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CoffeelierLogo } from '@/components/CoffeelierLogo';
import { usePasswordSecurity } from '@/hooks/usePasswordSecurity';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { toast } from 'sonner';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordValidationMessage, setPasswordValidationMessage] = useState('');
  const navigate = useNavigate();
  const { validatePassword, isValidating } = usePasswordSecurity();
  const { checkRateLimit, logAuthAttempt, isChecking } = useRateLimiting();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          navigate('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

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
      }
    } catch (error: any) {
      await logAuthAttempt(email, 'signin', false, 'unexpected_error');
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    // Validar senha antes do registro
    const validation = await validatePassword(password);
    if (!validation.valid) {
      setError(validation.message);
      setLoading(false);
      return;
    }

    try {
      // Check rate limiting for signup
      const rateLimitCheck = await checkRateLimit(email, 'signup');
      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.message || 'Muitas tentativas. Tente mais tarde.');
        await logAuthAttempt(email, 'signup', false, rateLimitCheck.reason);
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        const failureReason = error.message.includes('User already registered') 
          ? 'user_exists' 
          : 'auth_error';
          
        await logAuthAttempt(email, 'signup', false, failureReason);
        
        if (error.message.includes('User already registered')) {
          setError('Este email já está cadastrado. Tente fazer login.');
        } else {
          setError(error.message);
        }
      } else {
        await logAuthAttempt(email, 'signup', true);
        toast.success('Cadastro realizado! Verifique seu email para confirmar a conta.');
      }
    } catch (error: any) {
      await logAuthAttempt(email, 'signup', false, 'unexpected_error');
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-2/5 flex flex-col justify-center px-8 py-12 sm:px-16 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <CoffeelierLogo />
          </div>
          
          <div>
            <h2 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-6">
              {isSignUp ? 'E-MAIL E SENHA' : 'NOME DE USUÁRIO OU E-MAIL'}
            </h2>
            
            <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-6">
              <div>
                <Input
                  type="email"
                  placeholder=""
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                  SENHA
                </h3>
                <Input
                  type="password"
                  placeholder=""
                  value={password}
                  onChange={(e) => isSignUp ? handlePasswordChange(e.target.value) : setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {isSignUp && passwordValidationMessage && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription>{passwordValidationMessage}</AlertDescription>
                  </Alert>
                )}
                {isSignUp && isValidating && (
                  <p className="text-sm text-muted-foreground mt-1">Verificando segurança da senha...</p>
                )}
              </div>

              {isSignUp && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide mb-3">
                    CONFIRMAR SENHA
                  </h3>
                  <Input
                    type="password"
                    placeholder=""
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              {/* Success message */}
              {!error && (
                <div className="flex items-center text-green-600 text-sm">
                  <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center mr-2">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  Sucesso!
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-md transition-colors duration-200"
                disabled={loading || isChecking || (isSignUp && (isValidating || !!passwordValidationMessage))}
              >
                {loading || isChecking ? 'Verificando...' : (isSignUp ? 'Criar Conta' : 'Entrar')}
              </Button>

              {!isSignUp && (
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 py-3 px-4 rounded-md transition-colors duration-200"
                  disabled
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Entrar com Google
                </Button>
              )}

              <div className="flex justify-between text-sm">
                <button 
                  type="button"
                  className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  disabled
                >
                  Esqueci minha senha
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setPasswordValidationMessage('');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  {isSignUp ? 'Já tenho conta' : 'Crie uma conta'}
                </button>
              </div>
            </form>
          </div>

          {/* Footer links */}
          <div className="mt-16">
            <div className="text-sm text-gray-500 mb-4">
              Baixe nosso app:
            </div>
            <div className="flex space-x-4">
              <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center">
                <span className="text-white text-xs">▶</span>
              </div>
              <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center">
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
        />
      </div>
    </div>
  );
};

export default Auth;