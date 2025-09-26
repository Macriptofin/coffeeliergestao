import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Key, 
  Download, 
  QrCode, 
  Copy,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useMFASettings } from '@/hooks/useMFASettings';
import { toast } from 'sonner';

interface MFASetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MFASetupDialog = ({ open, onOpenChange }: MFASetupDialogProps) => {
  const { setupMFA, loading } = useMFASettings();
  const [step, setStep] = useState<'intro' | 'setup' | 'backup-codes' | 'complete'>('intro');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [qrCodeData, setQrCodeData] = useState('');
  const [totpSecret, setTotpSecret] = useState('');

  const handleSetupMFA = async () => {
    try {
      const result = await setupMFA(recoveryEmail);
      if (result) {
        setBackupCodes(result.backupCodes);
        setQrCodeData(result.qrCodeData);
        setTotpSecret(result.totpSecret);
        setStep('backup-codes');
      }
    } catch (error) {
      console.error('MFA setup failed:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para área de transferência');
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setStep('intro');
    setRecoveryEmail('');
    setBackupCodes([]);
    setQrCodeData('');
    setTotpSecret('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configurar Autenticação de Dois Fatores
          </DialogTitle>
          <DialogDescription>
            Adicione uma camada extra de segurança à sua conta
          </DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                O MFA protege sua conta mesmo se sua senha for comprometida. 
                Você precisará de um aplicativo autenticador como Google Authenticator ou Authy.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label htmlFor="recovery-email">
                E-mail de Recuperação (Opcional)
              </Label>
              <Input
                id="recovery-email"
                type="email"
                placeholder="seu-email@exemplo.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Usado para recuperação caso perca acesso ao autenticador
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSetupMFA} disabled={loading} className="flex-1">
                <Key className="h-4 w-4 mr-1" />
                {loading ? 'Configurando...' : 'Configurar MFA'}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-4">
            <Alert>
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                Escaneie o código QR com seu aplicativo autenticador ou adicione manualmente
              </AlertDescription>
            </Alert>

            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded border">
                {/* In production, use a proper QR code library */}
                <div className="text-xs break-all bg-gray-100 p-2 rounded">
                  {qrCodeData}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Chave Manual (caso não consiga escanear)</Label>
                <div className="flex gap-2">
                  <Input value={totpSecret} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(totpSecret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Button onClick={() => setStep('backup-codes')} className="w-full">
              Continuar
            </Button>
          </div>
        )}

        {step === 'backup-codes' && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Salve estes códigos de backup em local seguro. 
                Eles permitem acesso se você perder seu dispositivo autenticador.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label>Códigos de Backup</Label>
              <div className="bg-muted p-4 rounded space-y-1">
                {backupCodes.map((code, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <Badge variant="outline" className="font-mono">
                      {code}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(code)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={downloadBackupCodes} variant="outline" className="flex-1">
                <Download className="h-4 w-4 mr-1" />
                Baixar Códigos
              </Button>
              <Button onClick={() => setStep('complete')} className="flex-1">
                Finalizar
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">MFA Configurado com Sucesso!</h3>
              <p className="text-muted-foreground">
                Sua conta agora está protegida com autenticação de dois fatores.
              </p>
            </div>

            <Separator />

            <div className="text-left space-y-2">
              <h4 className="font-medium">Próximos passos:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Teste o login com MFA</li>
                <li>• Guarde os códigos de backup em local seguro</li>
                <li>• Considere configurar um e-mail de recuperação</li>
              </ul>
            </div>

            <Button onClick={handleClose} className="w-full">
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MFASetupDialog;