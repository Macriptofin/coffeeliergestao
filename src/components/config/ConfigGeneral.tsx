import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Settings, Loader2 } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Only general system settings, not company data
const generalSettings = [
  { key: 'moeda_simbolo', label: 'Símbolo da Moeda', placeholder: 'R$' },
];

export const ConfigGeneral = () => {
  const { getConfigValue, setConfigValue, loading } = useConfig();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  // Load initial values only once
  useEffect(() => {
    if (!loading && !initialized) {
      const initialValues: Record<string, string> = {};
      generalSettings.forEach(setting => {
        const value = getConfigValue('gerais', setting.key);
        initialValues[setting.key] = value !== null && value !== undefined ? String(value) : '';
      });
      setValues(initialValues);
      setInitialized(true);
    }
  }, [loading, initialized, getConfigValue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(values).map(([key, value]) => 
        setConfigValue('gerais', key, value || '')
      );
      await Promise.all(promises);
      toast({
        title: "Configurações salvas",
        description: "As configurações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
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
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Parâmetros Gerais do Sistema
          </CardTitle>
          <CardDescription>Configurações básicas de funcionamento do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generalSettings.map(setting => (
              <div key={setting.key} className="space-y-1.5">
                <Label htmlFor={setting.key}>{setting.label}</Label>
                <Input
                  id={setting.key}
                  value={values[setting.key] || ''}
                  onChange={(e) => handleValueChange(setting.key, e.target.value)}
                  placeholder={setting.placeholder}
                  className="h-9"
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-end pt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
