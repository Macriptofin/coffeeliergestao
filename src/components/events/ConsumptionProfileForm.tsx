import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConsumptionProfile {
  id?: string;
  name: string;
  grams_per_person: number;
  notes?: string;
  mix?: Array<{
    category_label: string;
    percent: number;
  }>;
}

interface ConsumptionProfileFormProps {
  profile?: ConsumptionProfile;
  onSave: () => void;
  onCancel: () => void;
}

export function ConsumptionProfileForm({ profile, onSave, onCancel }: ConsumptionProfileFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ConsumptionProfile>({
    name: profile?.name || "",
    grams_per_person: profile?.grams_per_person || 200,
    notes: profile?.notes || "",
    mix: profile?.mix || [
      { category_label: "Salgados", percent: 40 },
      { category_label: "Doces", percent: 30 },
      { category_label: "Bebidas", percent: 20 },
      { category_label: "Frutas", percent: 10 },
    ],
  });

  const addMixItem = () => {
    setFormData(prev => ({
      ...prev,
      mix: [...(prev.mix || []), { category_label: "", percent: 0 }]
    }));
  };

  const removeMixItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mix: prev.mix?.filter((_, i) => i !== index)
    }));
  };

  const updateMixItem = (index: number, field: 'category_label' | 'percent', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      mix: prev.mix?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const totalPercent = formData.mix?.reduce((sum, item) => sum + item.percent, 0) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (totalPercent !== 100) {
        toast({
          title: "Erro de validação",
          description: "A soma das porcentagens deve ser exatamente 100%",
          variant: "destructive",
        });
        return;
      }

      let profileId = profile?.id;

      if (profile?.id) {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('consumption_profiles')
          .update({
            name: formData.name,
            grams_per_person: formData.grams_per_person,
            notes: formData.notes,
          })
          .eq('id', profile.id);

        if (error) throw error;

        // Remover mix antigo
        await supabase
          .from('consumption_profile_mix')
          .delete()
          .eq('profile_id', profile.id);
      } else {
        // Criar novo perfil
        const { data, error } = await supabase
          .from('consumption_profiles')
          .insert({
            name: formData.name,
            grams_per_person: formData.grams_per_person,
            notes: formData.notes,
          })
          .select()
          .single();

        if (error) throw error;
        profileId = data.id;
      }

      // Inserir novo mix
      if (formData.mix && profileId) {
        const { error: mixError } = await supabase
          .from('consumption_profile_mix')
          .insert(
            formData.mix.map(item => ({
              profile_id: profileId,
              category_label: item.category_label,
              percent: item.percent,
            }))
          );

        if (mixError) throw mixError;
      }

      toast({
        title: "Sucesso",
        description: profile?.id ? "Perfil atualizado com sucesso!" : "Perfil criado com sucesso!",
      });

      onSave();
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar perfil. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {profile?.id ? "Editar Perfil de Consumo" : "Novo Perfil de Consumo"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Perfil</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Intervalo 15min – 200g/pessoa"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grams">Gramas por Pessoa</Label>
              <Input
                id="grams"
                type="number"
                min="1"
                step="0.01"
                value={formData.grams_per_person}
                onChange={(e) => setFormData(prev => ({ ...prev, grams_per_person: parseFloat(e.target.value) || 0 }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações sobre este perfil..."
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Mix de Categorias</Label>
              <div className="flex items-center gap-2">
                <Badge variant={totalPercent === 100 ? "default" : "destructive"}>
                  Total: {totalPercent}%
                </Badge>
                <Button type="button" variant="outline" size="sm" onClick={addMixItem}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {formData.mix?.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Categoria"
                    value={item.category_label}
                    onChange={(e) => updateMixItem(index, 'category_label', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="%"
                    value={item.percent}
                    onChange={(e) => updateMixItem(index, 'percent', parseFloat(e.target.value) || 0)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeMixItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading || totalPercent !== 100}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}