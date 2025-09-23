import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Package2, Plus } from "lucide-react";
import type { Recipe } from "@/types";

interface LaunchProductDialogProps {
  recipe: Recipe;
  onSuccess: () => void;
}

const productCategories = [
  { value: 'Salgados', label: 'Salgados' },
  { value: 'Doces', label: 'Doces' },
  { value: 'Low Fat', label: 'Low Fat' },
  { value: 'Bebidas', label: 'Bebidas' }
];

export function LaunchProductDialog({ recipe, onSuccess }: LaunchProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: recipe.name,
    description: recipe.description,
    category: '',
    unitWeight: recipe.totalWeight ? (recipe.totalWeight / 1000).toFixed(3) : '',
    profitMargin: '30',
    sellingPrice: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.unitWeight) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const costPrice = recipe.totalCost || 0;
      const margin = parseFloat(formData.profitMargin) / 100;
      const calculatedPrice = costPrice / (1 - margin);
      const finalPrice = formData.sellingPrice ? parseFloat(formData.sellingPrice) : calculatedPrice;

      // Inserir produto (code será gerado automaticamente pelo trigger)
      const { error } = await supabase
        .from('products')
        .insert({
          name: formData.name,
          description: formData.description,
          recipe_id: recipe.id,
          category: formData.category as any,
          unit_weight: parseFloat(formData.unitWeight),
          cost_price: costPrice,
          selling_price: finalPrice,
          profit_margin: parseFloat(formData.profitMargin),
          is_active: true
        } as any);

      if (error) throw error;

      toast.success('Produto criado com sucesso!');
      setOpen(false);
      onSuccess();
      
      // Reset form
      setFormData({
        name: recipe.name,
        description: recipe.description,
        category: '',
        unitWeight: '',
        profitMargin: '30',
        sellingPrice: ''
      });

    } catch (error) {
      console.error('Erro ao criar produto:', error);
      toast.error('Erro ao criar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleProfitMarginChange = (value: string) => {
    setFormData(prev => ({ ...prev, profitMargin: value }));
    
    if (value && recipe.totalCost) {
      const margin = parseFloat(value) / 100;
      const calculatedPrice = recipe.totalCost / (1 - margin);
      setFormData(prev => ({ ...prev, sellingPrice: calculatedPrice.toFixed(2) }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center gap-2">
          <Package2 className="h-4 w-4" />
          Lançar como Produto
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Lançar Receita como Produto
          </DialogTitle>
          <DialogDescription>
            Transforme esta receita em um produto para usar nas propostas de venda
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações do Produto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {productCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="unitWeight">Peso Unitário (gramas) *</Label>
              <Input
                id="unitWeight"
                type="number"
                step="0.01"
                value={formData.unitWeight}
                onChange={(e) => setFormData(prev => ({ ...prev, unitWeight: e.target.value }))}
                placeholder="Ex: 150 (para um sanduíche de 150g)"
                required
              />
            </div>
          </div>

          {/* Precificação */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Precificação</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Custo da Receita</Label>
                <Input
                  value={`R$ ${(recipe.totalCost || 0).toFixed(2)}`}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="profitMargin">Margem de Lucro (%)</Label>
                <Input
                  id="profitMargin"
                  type="number"
                  step="0.1"
                  value={formData.profitMargin}
                  onChange={(e) => handleProfitMarginChange(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="sellingPrice">Preço de Venda</Label>
                <Input
                  id="sellingPrice"
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                  placeholder="Calculado automaticamente"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Produto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}