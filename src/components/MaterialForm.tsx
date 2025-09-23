import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { X, Calculator, AlertTriangle, Package, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Material } from "@/pages/Materials";

interface MaterialFormProps {
  material?: Material | null;
  existingMaterials: Material[];
  onSubmit: (material: Omit<Material, 'id' | 'code'>) => void;
  onCancel: () => void;
}

export const MaterialForm = ({ material, existingMaterials, onSubmit, onCancel }: MaterialFormProps) => {
  const [formData, setFormData] = useState({
    name: material?.name || '',
    purchaseUnit: material?.purchaseUnit || '',
    usageUnit: material?.usageUnit || '',
    conversionFactor: material?.conversionFactor?.toString() || '',
    pricePerPurchaseUnit: material?.pricePerPurchaseUnit?.toString() || '',
    supplier: material?.supplier || '',
    category: material?.category || 'Insumo' as Material['category'],
    materialType: material?.materialType || 'ingredient' as Material['materialType'],
  });
  const [duplicateError, setDuplicateError] = useState('');

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const categories = [
    { value: 'Insumo' as const, label: 'Insumos', description: 'Ingredientes básicos para produção', icon: Package },
    { value: 'Embalagem' as const, label: 'Embalagens', description: 'Materiais de embalagem e apresentação', icon: Package },
    { value: 'Produto Acabado' as const, label: 'Produtos Acabados', description: 'Produtos finais prontos para venda', icon: Tag },
    { value: 'Produto Composto' as const, label: 'Produtos Compostos', description: 'Produtos feitos com outros materiais', icon: Tag }
  ];

  const materialTypes = [
    { value: 'ingredient' as const, label: 'Ingrediente' },
    { value: 'packaging' as const, label: 'Embalagem' },
    { value: 'finished_product' as const, label: 'Produto Acabado' },
    { value: 'composite_product' as const, label: 'Produto Composto' }
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

    // Verificar duplicidade (ignorar o próprio material se estivermos editando)
    const duplicateMaterial = existingMaterials.find(mat => 
      mat.name.toLowerCase() === formData.name.toLowerCase() && 
      (!material || mat.id !== material.id)
    );

    if (duplicateMaterial) {
      setDuplicateError(`Já existe um material cadastrado com o nome "${duplicateMaterial.name}"`);
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
      category: formData.category,
      materialType: formData.materialType,
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
    const existing = existingMaterials.find(mat => 
      mat.name.toLowerCase() === selectedName.toLowerCase()
    );
    if (existing && (!material || existing.id !== material.id)) {
      setDuplicateError(`Material "${selectedName}" já está cadastrado`);
    }
  };

  const selectedCategory = categories.find(cat => cat.value === formData.category);

  return (
    <Card className="shadow-elegant border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-primary flex items-center gap-2">
            {selectedCategory?.icon && <selectedCategory.icon className="h-5 w-5" />}
            {material ? 'Editar Material' : 'Novo Material'}
            {material && (
              <Badge variant="outline" className="ml-2">
                {material.code}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {duplicateError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {duplicateError}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Categoria */}
          <div className="space-y-3">
            <Label htmlFor="category">Categoria do Material *</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value as Material['category'] })}>
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    <div className="flex items-center gap-3">
                      <category.icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{category.label}</div>
                        <div className="text-xs text-muted-foreground">{category.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome do Material */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Material *</Label>
            <AutocompleteInput
              id="name"
              value={formData.name}
              onChange={handleNameChange}
              onSelect={handleNameSelect}
              suggestions={existingMaterials.map(mat => mat.name)}
              placeholder="Ex: Farinha de trigo, Caixa de papelão, Brigadeiro"
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
              {material ? 'Atualizar Material' : 'Cadastrar Material'}
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