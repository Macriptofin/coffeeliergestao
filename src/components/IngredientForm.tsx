import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { Ingredient } from "@/pages/Index";

interface IngredientFormProps {
  onSubmit: (ingredient: Omit<Ingredient, 'id'>) => void;
  onCancel: () => void;
}

export const IngredientForm = ({ onSubmit, onCancel }: IngredientFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    pricePerUnit: '',
    supplier: '',
  });

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.unit || !formData.pricePerUnit) return;

    onSubmit({
      name: formData.name,
      unit: formData.unit,
      pricePerUnit: parseFloat(formData.pricePerUnit),
      supplier: formData.supplier || undefined,
    });
  };

  return (
    <Card className="shadow-elegant border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-primary">Novo Ingrediente</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Ingrediente *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Farinha de trigo"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade de Medida *</Label>
              <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço por Unidade (R$) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.pricePerUnit}
                onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor (Opcional)</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                placeholder="Ex: Distribuidora ABC"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="bg-gradient-primary flex-1">
              Cadastrar Ingrediente
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};