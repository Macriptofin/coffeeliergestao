import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeForLogging } from '@/lib/security-utils';

interface MFASettings {
  id: string;
  user_id: string;
  is_enabled: boolean;
  backup_codes?: string[];
  totp_secret?: string;
  recovery_email?: string;
  last_used_at?: string;
  enabled_at?: string;
  disabled_at?: string;
}

export function useMFASettings() {
  const [mfaSettings, setMfaSettings] = useState<MFASettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);

  // Fetch user's MFA settings
  const fetchMFASettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('mfa_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        throw error;
      }

      setMfaSettings(data);
    } catch (error) {
      console.error('Error fetching MFA settings:', sanitizeForLogging(error));
    } finally {
      setLoading(false);
    }
  };

  // Generate backup codes
  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  // Generate TOTP secret (simplified - in production use proper crypto)
  const generateTOTPSecret = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

  // Setup MFA
  const setupMFA = async (recoveryEmail?: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      const backupCodes = generateBackupCodes();
      const totpSecret = generateTOTPSecret();

      const mfaData = {
        user_id: user.id,
        is_enabled: true,
        backup_codes: backupCodes,
        totp_secret: totpSecret,
        recovery_email: recoveryEmail,
        enabled_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('mfa_settings')
        .upsert(mfaData)
        .select()
        .single();

      if (error) throw error;

      setMfaSettings(data);
      setIsSetupMode(false);
      
      toast.success('MFA configurado com sucesso!');
      
      return {
        backupCodes,
        totpSecret,
        qrCodeData: `otpauth://totp/Sistema:${user.email}?secret=${totpSecret}&issuer=Sistema`
      };
    } catch (error) {
      console.error('Error setting up MFA:', sanitizeForLogging(error));
      toast.error('Erro ao configurar MFA');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Disable MFA
  const disableMFA = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('mfa_settings')
        .update({
          is_enabled: false,
          disabled_at: new Date().toISOString(),
          totp_secret: null,
          backup_codes: null
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchMFASettings();
      toast.success('MFA desabilitado');
    } catch (error) {
      console.error('Error disabling MFA:', sanitizeForLogging(error));
      toast.error('Erro ao desabilitar MFA');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Regenerate backup codes
  const regenerateBackupCodes = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not authenticated');

      const newBackupCodes = generateBackupCodes();

      const { error } = await supabase
        .from('mfa_settings')
        .update({ backup_codes: newBackupCodes })
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchMFASettings();
      toast.success('Códigos de backup regenerados');
      
      return newBackupCodes;
    } catch (error) {
      console.error('Error regenerating backup codes:', sanitizeForLogging(error));
      toast.error('Erro ao regenerar códigos de backup');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Verify TOTP code (simplified - in production use proper TOTP verification)
  const verifyTOTPCode = async (code: string): Promise<boolean> => {
    try {
      // In production, implement proper TOTP verification
      // This is a simplified version for demonstration
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        // Update last used timestamp
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && mfaSettings) {
          await supabase
            .from('mfa_settings')
            .update({ last_used_at: new Date().toISOString() })
            .eq('user_id', user.id);
        }
        
        return true; // Simplified validation
      }
      return false;
    } catch (error) {
      console.error('Error verifying TOTP code:', sanitizeForLogging(error));
      return false;
    }
  };

  // Verify backup code
  const verifyBackupCode = async (code: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !mfaSettings?.backup_codes) return false;

      const isValidCode = mfaSettings.backup_codes.includes(code.toUpperCase());
      
      if (isValidCode) {
        // Remove used backup code
        const updatedCodes = mfaSettings.backup_codes.filter(c => c !== code.toUpperCase());
        
        await supabase
          .from('mfa_settings')
          .update({ 
            backup_codes: updatedCodes,
            last_used_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
        
        await fetchMFASettings();
        toast.warning('Código de backup usado. Considere gerar novos códigos.');
      }
      
      return isValidCode;
    } catch (error) {
      console.error('Error verifying backup code:', sanitizeForLogging(error));
      return false;
    }
  };

  useEffect(() => {
    fetchMFASettings();
  }, []);

  return {
    mfaSettings,
    loading,
    isSetupMode,
    setIsSetupMode,
    setupMFA,
    disableMFA,
    regenerateBackupCodes,
    verifyTOTPCode,
    verifyBackupCode,
    fetchMFASettings,
    isMFAEnabled: mfaSettings?.is_enabled ?? false
  };
}