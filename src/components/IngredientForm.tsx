import { useState } from "react";
import { MEASUREMENT_UNITS } from '@/lib/units';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { X, Calculator, AlertTriangle } from "lucide-react";
import type { Ingredient } from "@/types";

interface IngredientFormProps {
  ingredient?: Ingredient | null;
  existingIngredients: Ingredient[];
  onSubmit: (ingredient: Omit<Ingredient, 'id'>) => void;
  onCancel: () => void;
}

export const IngredientForm = ({ ingredient, existingIngredients, onSubmit, onCancel }: IngredientFormProps) => {
  const [formData, setFormData] = useState({
    name: ingredient?.name || '',
    purchaseUnit: ingredient?.purchaseUnit || '',
    usageUnit: ingredient?.usageUnit || '',
    conversionFactor: ingredient?.conversionFactor?.toString() || '',
    pricePerPurchaseUnit: ingredient?.pricePerPurchaseUnit?.toString() || '',
    supplier: ingredient?.supplier || '',
  });
  const [duplicateError, setDuplicateError] = useState('');

  const units = [
    ...MEASUREMENT_UNITS
  ];

  // Calcula o preço por unidade de uso
  const getPricePerUsageUnit = () => {
    const price = parseFloat(formData.pricePerPurchaseUnit) || 0;
    const conversion = parseFloat(formData.conversionFactor) || 1;
    return conversion > 0 ? (price / conversion).toFixed(4) : '0.0000';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.purchaseUnit || !formData.usageUnit || !formData.conversionFactor || !formData.pricePerPurchaseUnit) return;

    // Verificar duplicidade (ignorar o próprio ingrediente se estivermos editando)
    const duplicateIngredient = existingIngredients.find(ing => 
      ing.name.toLowerCase() === formData.name.toLowerCase() && 
      (!ingredient || ing.id !== ingredient.id)
    );

    if (duplicateIngredient) {
      setDuplicateError(`Já existe um ingrediente cadastrado com o nome "${duplicateIngredient.name}"`);
      return;
    }

    setDuplicateError('');
    onSubmit({
      name: formData.name,
      purchaseUnit: formData.purchaseUnit,
      usageUnit: formData.usageUnit,
      conversionFactor: parseFloat(formData.conversionFactor),
      pricePerPurchaseUnit: parseFloat(formData.pricePerPurchaseUnit),
      supplier: formData.supplier || undefined,
    });
  };

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value });
    // Limpar erro de duplicidade quando o usuário começar a digitar
    if (duplicateError) {
      setDuplicateError('');
    }
  };

  const handleNameSelect = (selectedName: string) => {
    // Quando selecionar um nome existente, mostrar aviso
    const existing = existingIngredients.find(ing => 
      ing.name.toLowerCase() === selectedName.toLowerCase()
    );
    if (existing && (!ingredient || existing.id !== ingredient.id)) {
      setDuplicateError(`Ingrediente "${selectedName}" já está cadastrado`);
    }
  };

  return (
    <Card className="shadow-elegant border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-primary">
            {ingredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {duplicateError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {duplicateError}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Ingrediente *</Label>
            <AutocompleteInput
              id="name"
              value={formData.name}
              onChange={handleNameChange}
              onSelect={handleNameSelect}
              suggestions={existingIngredients.map(ing => ing.name)}
              placeholder="Ex: Farinha de trigo"
              required
              className={duplicateError ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchaseUnit">Unidade de Compra *</Label>
              <Select value={formData.purchaseUnit} onValueChange={(value) => setFormData({ ...formData, purchaseUnit: value })}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Como você compra?" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="usageUnit">Unidade de Uso *</Label>
              <Select value={formData.usageUnit} onValueChange={(value) => setFormData({ ...formData, usageUnit: value })}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Como você usa?" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
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
              <Label htmlFor="conversionFactor">Fator de Conversão *</Label>
              <Input
                id="conversionFactor"
                type="number"
                step="0.01"
                value={formData.conversionFactor}
                onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                placeholder="Ex: 1000 (1kg = 1000g)"
                required
              />
              <p className="text-xs text-muted-foreground">
                Quantas unidades de uso em 1 unidade de compra
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="price">Preço por Unidade de Compra (R$) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.pricePerPurchaseUnit}
                onChange={(e) => setFormData({ ...formData, pricePerPurchaseUnit: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          {formData.conversionFactor && formData.pricePerPurchaseUnit && (
            <div className="bg-accent-creme/30 p-4 rounded-lg border border-accent-mocca/20">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-accent-coffee" />
                <span className="font-medium text-accent-coffee">Cálculo Automático</span>
              </div>
              <p className="text-sm text-accent-coffee">
                <strong>Custo por {formData.usageUnit}:</strong> R$ {getPricePerUsageUnit()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este será o valor usado nos cálculos das receitas
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="supplier">Fornecedor (Opcional)</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="Ex: Distribuidora ABC"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="bg-gradient-primary flex-1">
              {ingredient ? 'Atualizar Ingrediente' : 'Cadastrar Ingrediente'}
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