import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Building2, MapPin, Phone, Landmark, UserCircle, Loader2 } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface CompanyData {
  empresa_nome: string;
  empresa_nome_fantasia: string;
  empresa_cnpj: string;
  empresa_inscricao_estadual: string;
  empresa_inscricao_municipal: string;
  empresa_endereco: string;
  empresa_numero: string;
  empresa_complemento: string;
  empresa_bairro: string;
  empresa_cidade: string;
  empresa_estado: string;
  empresa_cep: string;
  empresa_telefone: string;
  empresa_celular: string;
  empresa_email: string;
  empresa_website: string;
  empresa_instagram: string;
  empresa_banco_nome: string;
  empresa_banco_agencia: string;
  empresa_banco_conta: string;
  empresa_banco_tipo: string;
  empresa_pix: string;
  empresa_responsavel_nome: string;
  empresa_responsavel_cpf: string;
  empresa_responsavel_cargo: string;
}

const initialData: CompanyData = {
  empresa_nome: '',
  empresa_nome_fantasia: '',
  empresa_cnpj: '',
  empresa_inscricao_estadual: '',
  empresa_inscricao_municipal: '',
  empresa_endereco: '',
  empresa_numero: '',
  empresa_complemento: '',
  empresa_bairro: '',
  empresa_cidade: '',
  empresa_estado: '',
  empresa_cep: '',
  empresa_telefone: '',
  empresa_celular: '',
  empresa_email: '',
  empresa_website: '',
  empresa_instagram: '',
  empresa_banco_nome: '',
  empresa_banco_agencia: '',
  empresa_banco_conta: '',
  empresa_banco_tipo: '',
  empresa_pix: '',
  empresa_responsavel_nome: '',
  empresa_responsavel_cpf: '',
  empresa_responsavel_cargo: '',
};

export const ConfigDadosEmpresa = () => {
  const { getConfigValue, setConfigValue, loading } = useConfig();
  const [formData, setFormData] = useState<CompanyData>(initialData);
  const [savedData, setSavedData] = useState<CompanyData>(initialData);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    return Object.keys(formData).some(
      key => formData[key as keyof CompanyData] !== savedData[key as keyof CompanyData]
    );
  }, [formData, savedData]);

  // Load initial values only once when not loading and not yet initialized
  useEffect(() => {
    if (!loading && !initialized) {
      const loadedData: CompanyData = { ...initialData };
      (Object.keys(initialData) as Array<keyof CompanyData>).forEach(key => {
        const value = getConfigValue('gerais', key);
        if (value !== null && value !== undefined) {
          loadedData[key] = typeof value === 'string' ? value : String(value);
        }
      });
      setFormData(loadedData);
      setSavedData(loadedData);
      setInitialized(true);
    }
  }, [loading, initialized, getConfigValue]);

  const handleChange = (key: keyof CompanyData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Use silent mode for batch save - no individual toasts
      const promises = Object.entries(formData).map(([key, value]) => 
        setConfigValue('gerais', key, value || '', true)
      );
      const results = await Promise.all(promises);
      
      // Check if all saves succeeded
      if (results.every(r => r === true)) {
        setSavedData({ ...formData });
        toast({
          title: "Dados salvos",
          description: "Os dados da empresa foram salvos com sucesso.",
        });
      } else {
        throw new Error('Alguns campos não foram salvos');
      }
    } catch (error) {
      console.error('Error saving company data:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os dados da empresa.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identificação */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Identificação da Empresa
          </CardTitle>
          <CardDescription>Informações básicas de identificação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="empresa_nome">Razão Social</Label>
              <Input
                id="empresa_nome"
                value={formData.empresa_nome}
                onChange={(e) => handleChange('empresa_nome', e.target.value)}
                placeholder="Nome completo da empresa"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_nome_fantasia">Nome Fantasia</Label>
              <Input
                id="empresa_nome_fantasia"
                value={formData.empresa_nome_fantasia}
                onChange={(e) => handleChange('empresa_nome_fantasia', e.target.value)}
                placeholder="Nome fantasia"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_cnpj">CNPJ</Label>
              <Input
                id="empresa_cnpj"
                value={formData.empresa_cnpj}
                onChange={(e) => handleChange('empresa_cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_inscricao_estadual">Inscrição Estadual</Label>
              <Input
                id="empresa_inscricao_estadual"
                value={formData.empresa_inscricao_estadual}
                onChange={(e) => handleChange('empresa_inscricao_estadual', e.target.value)}
                placeholder="Inscrição estadual"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_inscricao_municipal">Inscrição Municipal</Label>
              <Input
                id="empresa_inscricao_municipal"
                value={formData.empresa_inscricao_municipal}
                onChange={(e) => handleChange('empresa_inscricao_municipal', e.target.value)}
                placeholder="Inscrição municipal"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Endereço
          </CardTitle>
          <CardDescription>Localização da empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="empresa_endereco">Logradouro</Label>
              <Input
                id="empresa_endereco"
                value={formData.empresa_endereco}
                onChange={(e) => handleChange('empresa_endereco', e.target.value)}
                placeholder="Rua, Avenida, etc."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_numero">Número</Label>
              <Input
                id="empresa_numero"
                value={formData.empresa_numero}
                onChange={(e) => handleChange('empresa_numero', e.target.value)}
                placeholder="Número"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_complemento">Complemento</Label>
              <Input
                id="empresa_complemento"
                value={formData.empresa_complemento}
                onChange={(e) => handleChange('empresa_complemento', e.target.value)}
                placeholder="Apto, Sala, etc."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_bairro">Bairro</Label>
              <Input
                id="empresa_bairro"
                value={formData.empresa_bairro}
                onChange={(e) => handleChange('empresa_bairro', e.target.value)}
                placeholder="Bairro"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_cidade">Cidade</Label>
              <Input
                id="empresa_cidade"
                value={formData.empresa_cidade}
                onChange={(e) => handleChange('empresa_cidade', e.target.value)}
                placeholder="Cidade"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_estado">Estado (UF)</Label>
              <Input
                id="empresa_estado"
                value={formData.empresa_estado}
                onChange={(e) => handleChange('empresa_estado', e.target.value)}
                placeholder="UF"
                className="h-9"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_cep">CEP</Label>
              <Input
                id="empresa_cep"
                value={formData.empresa_cep}
                onChange={(e) => handleChange('empresa_cep', e.target.value)}
                placeholder="00000-000"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contatos */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5" />
            Contatos
          </CardTitle>
          <CardDescription>Telefones e redes sociais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="empresa_telefone">Telefone Fixo</Label>
              <Input
                id="empresa_telefone"
                value={formData.empresa_telefone}
                onChange={(e) => handleChange('empresa_telefone', e.target.value)}
                placeholder="(00) 0000-0000"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_celular">Celular / WhatsApp</Label>
              <Input
                id="empresa_celular"
                value={formData.empresa_celular}
                onChange={(e) => handleChange('empresa_celular', e.target.value)}
                placeholder="(00) 00000-0000"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_email">E-mail</Label>
              <Input
                id="empresa_email"
                type="email"
                value={formData.empresa_email}
                onChange={(e) => handleChange('empresa_email', e.target.value)}
                placeholder="contato@empresa.com.br"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_website">Website</Label>
              <Input
                id="empresa_website"
                value={formData.empresa_website}
                onChange={(e) => handleChange('empresa_website', e.target.value)}
                placeholder="www.empresa.com.br"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_instagram">Instagram</Label>
              <Input
                id="empresa_instagram"
                value={formData.empresa_instagram}
                onChange={(e) => handleChange('empresa_instagram', e.target.value)}
                placeholder="@empresa"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Bancários */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5" />
            Dados Bancários
          </CardTitle>
          <CardDescription>Informações para pagamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="empresa_banco_nome">Nome do Banco</Label>
              <Input
                id="empresa_banco_nome"
                value={formData.empresa_banco_nome}
                onChange={(e) => handleChange('empresa_banco_nome', e.target.value)}
                placeholder="Banco do Brasil, Itaú, etc."
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_banco_agencia">Agência</Label>
              <Input
                id="empresa_banco_agencia"
                value={formData.empresa_banco_agencia}
                onChange={(e) => handleChange('empresa_banco_agencia', e.target.value)}
                placeholder="0000"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_banco_conta">Conta</Label>
              <Input
                id="empresa_banco_conta"
                value={formData.empresa_banco_conta}
                onChange={(e) => handleChange('empresa_banco_conta', e.target.value)}
                placeholder="00000-0"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_banco_tipo">Tipo de Conta</Label>
              <Input
                id="empresa_banco_tipo"
                value={formData.empresa_banco_tipo}
                onChange={(e) => handleChange('empresa_banco_tipo', e.target.value)}
                placeholder="Corrente ou Poupança"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="empresa_pix">Chave PIX</Label>
              <Input
                id="empresa_pix"
                value={formData.empresa_pix}
                onChange={(e) => handleChange('empresa_pix', e.target.value)}
                placeholder="CNPJ, e-mail, telefone ou chave aleatória"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsável Legal */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCircle className="h-5 w-5" />
            Responsável Legal
          </CardTitle>
          <CardDescription>Dados do responsável pela empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="empresa_responsavel_nome">Nome Completo</Label>
              <Input
                id="empresa_responsavel_nome"
                value={formData.empresa_responsavel_nome}
                onChange={(e) => handleChange('empresa_responsavel_nome', e.target.value)}
                placeholder="Nome do responsável"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_responsavel_cpf">CPF</Label>
              <Input
                id="empresa_responsavel_cpf"
                value={formData.empresa_responsavel_cpf}
                onChange={(e) => handleChange('empresa_responsavel_cpf', e.target.value)}
                placeholder="000.000.000-00"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="empresa_responsavel_cargo">Cargo</Label>
              <Input
                id="empresa_responsavel_cargo"
                value={formData.empresa_responsavel_cargo}
                onChange={(e) => handleChange('empresa_responsavel_cargo', e.target.value)}
                placeholder="Sócio-Administrador, Diretor, etc."
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button - only show when there are unsaved changes */}
      {isDirty && (
        <div className="flex justify-end sticky bottom-4">
          <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Dados da Empresa'}
          </Button>
        </div>
      )}
    </div>
  );
};
