import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Settings } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect } from "react";

interface ConfigParamsProps {
  namespace: string;
}

export const ConfigParams = ({ namespace }: ConfigParamsProps) => {
  const { getConfigValue, setConfigValue, getOptionsByNamespace, loading } = useConfig();
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const options = getOptionsByNamespace(namespace);

  useEffect(() => {
    if (!loading) {
      const initialValues: Record<string, any> = {};
      options.forEach(option => {
        const value = getConfigValue(namespace, option.key);
        initialValues[option.key] = value;
      });
      setValues(initialValues);
    }
  }, [loading, options, getConfigValue, namespace]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(values).map(([key, value]) => 
          setConfigValue(namespace, key, value)
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const renderInput = (option: any) => {
    const value = values[option.key];
    
    switch (option.value_type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={option.key}
              checked={value || false}
              onCheckedChange={(checked) => handleValueChange(option.key, checked)}
            />
            <Label htmlFor={option.key}>{option.description}</Label>
          </div>
        );
      
      case 'number':
        return (
          <div className="space-y-2">
            <Label htmlFor={option.key}>{option.description}</Label>
            <Input
              id={option.key}
              type="number"
              step="0.01"
              value={value || ''}
              onChange={(e) => handleValueChange(option.key, parseFloat(e.target.value) || 0)}
              placeholder={option.default_value?.toString() || '0'}
            />
          </div>
        );
      
      case 'json':
      case 'array':
        return (
          <div className="space-y-2">
            <Label htmlFor={option.key}>{option.description}</Label>
            <textarea
              id={option.key}
              className="w-full h-24 p-2 border rounded-md font-mono text-sm"
              value={JSON.stringify(value || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleValueChange(option.key, parsed);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              placeholder={JSON.stringify(option.default_value || {}, null, 2)}
            />
          </div>
        );
      
      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={option.key}>{option.description}</Label>
            <Input
              id={option.key}
              value={value || ''}
              onChange={(e) => handleValueChange(option.key, e.target.value)}
              placeholder={option.default_value?.toString() || ''}
            />
          </div>
        );
    }
  };

  if (loading) {
    return <div className="animate-pulse">Carregando parâmetros...</div>;
  }

  if (options.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum parâmetro configurável encontrado para este módulo.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Parâmetros do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {options.map(option => (
          <div key={option.key}>
            {renderInput(option)}
          </div>
        ))}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving || options.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Parâmetros'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};