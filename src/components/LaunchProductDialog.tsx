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
    unitWeight: recipe.totalWeight ? (recipe.totalWeight / 1000).toFixed(3) : ''
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
      const unitWeightGrams = parseFloat(formData.unitWeight);

      // 1. Primeiro, inserir como material na categoria "Produto Acabado"
      const { data: materialData, error: materialError } = await supabase
        .from('materials')
        .insert({
          name: formData.name,
          category: 'Produto Acabado',
          material_type: 'ingredient',
          usage_unit: 'unidade',
          purchase_unit: 'unidade',
          conversion_factor: 1,
          price_per_purchase_unit: costPrice,
          unit_weight: unitWeightGrams
        })
        .select()
        .single();

      if (materialError) throw materialError;

      // 2. Inserir produto referenciando o material criado
      const { error: productError } = await (supabase as any)
        .from('products')
        .insert({
          name: formData.name,
          description: formData.description,
          recipe_id: recipe.id,
          category: formData.category as any,
          unit_weight: unitWeightGrams,
          cost_price: costPrice,
          selling_price: 0, // Será definido na proposta
          is_active: true
        } as any);

      if (productError) throw productError;

      // 3. Criar registro inicial no estoque com quantidade zero
      const { error: stockError } = await supabase
        .from('stock_items')
        .insert({
          material_id: materialData.id,
          current_quantity: 0,
          minimum_quantity: 0,
          average_price: costPrice,
          total_value: 0
        });

      if (stockError) throw stockError;

      toast.success('Produto criado e adicionado ao controle de estoque!');
      setOpen(false);
      onSuccess();
      
      // Reset form
      setFormData({
        name: recipe.name,
        description: recipe.description,
        category: '',
        unitWeight: recipe.totalWeight ? (recipe.totalWeight / 1000).toFixed(3) : ''
      });

    } catch (error) {
      console.error('Erro ao criar produto:', error);
      toast.error('Erro ao criar produto');
    } finally {
      setLoading(false);
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
            Transforme esta receita em um produto acabado que será controlado no estoque e disponível para propostas de venda
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

          {/* Custo da receita - apenas informativo */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Informações Financeiras</h3>
            
            <div>
              <Label>Custo da Receita</Label>
              <Input
                value={`R$ ${(recipe.totalCost || 0).toFixed(2)}`}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                O preço de venda será definido nas propostas comerciais
              </p>
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