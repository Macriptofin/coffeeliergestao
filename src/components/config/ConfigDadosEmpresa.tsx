import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Building2, MapPin, Phone, Landmark, UserCircle, Loader2, Pencil, X } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

// Field component that shows text in view mode, input in edit mode
interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  className?: string;
}

const Field = ({ id, label, value, onChange, isEditing, placeholder, type = "text", maxLength, className }: FieldProps) => {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </Label>
      {isEditing ? (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="h-9"
        />
      ) : (
        <p className="text-sm py-2 min-h-[36px] border-b border-transparent">
          {value || <span className="text-muted-foreground/50 italic">Não informado</span>}
        </p>
      )}
    </div>
  );
};

export const ConfigDadosEmpresa = () => {
  const { getConfigValue, setConfigValue, loading } = useConfig();
  const [formData, setFormData] = useState<CompanyData>(initialData);
  const [savedData, setSavedData] = useState<CompanyData>(initialData);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const handleCancel = () => {
    setFormData({ ...savedData });
    setIsEditing(false);
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
        setIsEditing(false);
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
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dados da Empresa</h2>
          <p className="text-sm text-muted-foreground">
            {isEditing ? "Editando informações da empresa" : "Visualizando informações da empresa"}
          </p>
        </div>
        {!isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        )}
      </div>

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
            <Field
              id="empresa_nome"
              label="Razão Social"
              value={formData.empresa_nome}
              onChange={(v) => handleChange('empresa_nome', v)}
              isEditing={isEditing}
              placeholder="Nome completo da empresa"
              className="lg:col-span-2"
            />
            <Field
              id="empresa_nome_fantasia"
              label="Nome Fantasia"
              value={formData.empresa_nome_fantasia}
              onChange={(v) => handleChange('empresa_nome_fantasia', v)}
              isEditing={isEditing}
              placeholder="Nome fantasia"
            />
            <Field
              id="empresa_cnpj"
              label="CNPJ"
              value={formData.empresa_cnpj}
              onChange={(v) => handleChange('empresa_cnpj', v)}
              isEditing={isEditing}
              placeholder="00.000.000/0000-00"
            />
            <Field
              id="empresa_inscricao_estadual"
              label="Inscrição Estadual"
              value={formData.empresa_inscricao_estadual}
              onChange={(v) => handleChange('empresa_inscricao_estadual', v)}
              isEditing={isEditing}
              placeholder="Inscrição estadual"
            />
            <Field
              id="empresa_inscricao_municipal"
              label="Inscrição Municipal"
              value={formData.empresa_inscricao_municipal}
              onChange={(v) => handleChange('empresa_inscricao_municipal', v)}
              isEditing={isEditing}
              placeholder="Inscrição municipal"
            />
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
            <Field
              id="empresa_endereco"
              label="Logradouro"
              value={formData.empresa_endereco}
              onChange={(v) => handleChange('empresa_endereco', v)}
              isEditing={isEditing}
              placeholder="Rua, Avenida, etc."
              className="lg:col-span-2"
            />
            <Field
              id="empresa_numero"
              label="Número"
              value={formData.empresa_numero}
              onChange={(v) => handleChange('empresa_numero', v)}
              isEditing={isEditing}
              placeholder="Número"
            />
            <Field
              id="empresa_complemento"
              label="Complemento"
              value={formData.empresa_complemento}
              onChange={(v) => handleChange('empresa_complemento', v)}
              isEditing={isEditing}
              placeholder="Apto, Sala, etc."
            />
            <Field
              id="empresa_bairro"
              label="Bairro"
              value={formData.empresa_bairro}
              onChange={(v) => handleChange('empresa_bairro', v)}
              isEditing={isEditing}
              placeholder="Bairro"
            />
            <Field
              id="empresa_cidade"
              label="Cidade"
              value={formData.empresa_cidade}
              onChange={(v) => handleChange('empresa_cidade', v)}
              isEditing={isEditing}
              placeholder="Cidade"
            />
            <Field
              id="empresa_estado"
              label="Estado (UF)"
              value={formData.empresa_estado}
              onChange={(v) => handleChange('empresa_estado', v)}
              isEditing={isEditing}
              placeholder="UF"
              maxLength={2}
            />
            <Field
              id="empresa_cep"
              label="CEP"
              value={formData.empresa_cep}
              onChange={(v) => handleChange('empresa_cep', v)}
              isEditing={isEditing}
              placeholder="00000-000"
            />
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
            <Field
              id="empresa_telefone"
              label="Telefone Fixo"
              value={formData.empresa_telefone}
              onChange={(v) => handleChange('empresa_telefone', v)}
              isEditing={isEditing}
              placeholder="(00) 0000-0000"
            />
            <Field
              id="empresa_celular"
              label="Celular / WhatsApp"
              value={formData.empresa_celular}
              onChange={(v) => handleChange('empresa_celular', v)}
              isEditing={isEditing}
              placeholder="(00) 00000-0000"
            />
            <Field
              id="empresa_email"
              label="E-mail"
              value={formData.empresa_email}
              onChange={(v) => handleChange('empresa_email', v)}
              isEditing={isEditing}
              placeholder="contato@empresa.com.br"
              type="email"
            />
            <Field
              id="empresa_website"
              label="Website"
              value={formData.empresa_website}
              onChange={(v) => handleChange('empresa_website', v)}
              isEditing={isEditing}
              placeholder="www.empresa.com.br"
            />
            <Field
              id="empresa_instagram"
              label="Instagram"
              value={formData.empresa_instagram}
              onChange={(v) => handleChange('empresa_instagram', v)}
              isEditing={isEditing}
              placeholder="@empresa"
            />
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
            <Field
              id="empresa_banco_nome"
              label="Nome do Banco"
              value={formData.empresa_banco_nome}
              onChange={(v) => handleChange('empresa_banco_nome', v)}
              isEditing={isEditing}
              placeholder="Banco do Brasil, Itaú, etc."
            />
            <Field
              id="empresa_banco_agencia"
              label="Agência"
              value={formData.empresa_banco_agencia}
              onChange={(v) => handleChange('empresa_banco_agencia', v)}
              isEditing={isEditing}
              placeholder="0000"
            />
            <Field
              id="empresa_banco_conta"
              label="Conta"
              value={formData.empresa_banco_conta}
              onChange={(v) => handleChange('empresa_banco_conta', v)}
              isEditing={isEditing}
              placeholder="00000-0"
            />
            <Field
              id="empresa_banco_tipo"
              label="Tipo de Conta"
              value={formData.empresa_banco_tipo}
              onChange={(v) => handleChange('empresa_banco_tipo', v)}
              isEditing={isEditing}
              placeholder="Corrente ou Poupança"
            />
            <Field
              id="empresa_pix"
              label="Chave PIX"
              value={formData.empresa_pix}
              onChange={(v) => handleChange('empresa_pix', v)}
              isEditing={isEditing}
              placeholder="CNPJ, e-mail, telefone ou chave aleatória"
              className="lg:col-span-2"
            />
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
            <Field
              id="empresa_responsavel_nome"
              label="Nome Completo"
              value={formData.empresa_responsavel_nome}
              onChange={(v) => handleChange('empresa_responsavel_nome', v)}
              isEditing={isEditing}
              placeholder="Nome do responsável"
            />
            <Field
              id="empresa_responsavel_cpf"
              label="CPF"
              value={formData.empresa_responsavel_cpf}
              onChange={(v) => handleChange('empresa_responsavel_cpf', v)}
              isEditing={isEditing}
              placeholder="000.000.000-00"
            />
            <Field
              id="empresa_responsavel_cargo"
              label="Cargo"
              value={formData.empresa_responsavel_cargo}
              onChange={(v) => handleChange('empresa_responsavel_cargo', v)}
              isEditing={isEditing}
              placeholder="Sócio-Administrador, Diretor, etc."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
