import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Building2, MapPin, Phone, Landmark, UserCircle } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";

interface FieldGroup {
  title: string;
  icon: React.ReactNode;
  description: string;
  keys: string[];
}

const fieldGroups: FieldGroup[] = [
  {
    title: "Identificação da Empresa",
    icon: <Building2 className="h-5 w-5" />,
    description: "Informações básicas de identificação",
    keys: ["empresa_nome", "empresa_nome_fantasia", "empresa_cnpj", "empresa_inscricao_estadual", "empresa_inscricao_municipal", "moeda_simbolo"]
  },
  {
    title: "Endereço",
    icon: <MapPin className="h-5 w-5" />,
    description: "Localização da empresa",
    keys: ["empresa_endereco", "empresa_numero", "empresa_complemento", "empresa_bairro", "empresa_cidade", "empresa_estado", "empresa_cep"]
  },
  {
    title: "Contatos",
    icon: <Phone className="h-5 w-5" />,
    description: "Telefones e redes sociais",
    keys: ["empresa_telefone", "empresa_celular", "empresa_email", "empresa_website", "empresa_instagram"]
  },
  {
    title: "Dados Bancários",
    icon: <Landmark className="h-5 w-5" />,
    description: "Informações para pagamento",
    keys: ["empresa_banco_nome", "empresa_banco_agencia", "empresa_banco_conta", "empresa_banco_tipo", "empresa_pix"]
  },
  {
    title: "Responsável Legal",
    icon: <UserCircle className="h-5 w-5" />,
    description: "Dados do responsável pela empresa",
    keys: ["empresa_responsavel_nome", "empresa_responsavel_cpf", "empresa_responsavel_cargo"]
  }
];

export const ConfigGeneral = () => {
  const { getConfigValue, setConfigValue, getOptionsByNamespace, loading } = useConfig();
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const options = getOptionsByNamespace('gerais');

  useEffect(() => {
    if (!loading) {
      const initialValues: Record<string, any> = {};
      options.forEach(option => {
        const value = getConfigValue('gerais', option.key);
        initialValues[option.key] = value;
      });
      setValues(initialValues);
    }
  }, [loading, options, getConfigValue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(values).map(([key, value]) => 
          setConfigValue('gerais', key, value)
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const getOptionByKey = (key: string) => {
    return options.find(opt => opt.key === key);
  };

  const renderField = (key: string) => {
    const option = getOptionByKey(key);
    if (!option) return null;

    return (
      <div key={option.key} className="space-y-1.5">
        <Label htmlFor={option.key} className="text-sm font-medium">
          {option.description}
        </Label>
        {option.value_type === 'string' ? (
          <Input
            id={option.key}
            value={values[option.key] || ''}
            onChange={(e) => handleValueChange(option.key, e.target.value)}
            placeholder={option.default_value?.toString().replace(/"/g, '') || ''}
            className="h-9"
          />
        ) : option.value_type === 'number' ? (
          <Input
            id={option.key}
            type="number"
            value={values[option.key] || ''}
            onChange={(e) => handleValueChange(option.key, parseFloat(e.target.value) || 0)}
            placeholder={option.default_value?.toString() || '0'}
            className="h-9"
          />
        ) : (
          <Input
            id={option.key}
            value={JSON.stringify(values[option.key] || {})}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleValueChange(option.key, parsed);
              } catch {}
            }}
            placeholder={JSON.stringify(option.default_value || {})}
            className="h-9"
          />
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="animate-pulse">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {fieldGroups.map((group, index) => (
        <Card key={group.title}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              {group.icon}
              {group.title}
            </CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.keys.map(key => renderField(key))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
        </Button>
      </div>
    </div>
  );
};
