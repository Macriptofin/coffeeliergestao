import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Building2 } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect } from "react";

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

  if (loading) {
    return <div className="animate-pulse">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {options.map(option => (
            <div key={option.key} className="space-y-2">
              <Label htmlFor={option.key}>{option.description}</Label>
              {option.value_type === 'string' ? (
                <Input
                  id={option.key}
                  value={values[option.key] || ''}
                  onChange={(e) => handleValueChange(option.key, e.target.value)}
                  placeholder={option.default_value?.toString() || ''}
                />
              ) : option.value_type === 'number' ? (
                <Input
                  id={option.key}
                  type="number"
                  value={values[option.key] || ''}
                  onChange={(e) => handleValueChange(option.key, parseFloat(e.target.value) || 0)}
                  placeholder={option.default_value?.toString() || '0'}
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
                />
              )}
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};