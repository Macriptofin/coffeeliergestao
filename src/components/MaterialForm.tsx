import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Textarea } from "@/components/ui/textarea";
import { X, AlertTriangle, Package, Tag, Wrench, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Material } from "@/types";
import { materialCategories, getSubcategoriesByCategory } from "@/lib/material-categories";

interface MaterialFormProps {
  material?: Material | null;
  existingMaterials: Material[];
  onSubmit: (material: Omit<Material, 'id' | 'code'>) => void;
  onCancel: () => void;
}

export const MaterialForm = ({ material, existingMaterials, onSubmit, onCancel }: MaterialFormProps) => {
  const [formData, setFormData] = useState({
    name: material?.name || '',
    description: material?.description || '',
    purchaseUnit: material?.purchaseUnit || '',
    usageUnit: material?.usageUnit || '',
    conversionFactor: material?.conversionFactor?.toString() || '',
    supplier: material?.supplier || '',
    allowedBrands: material?.allowedBrands?.join(', ') || '',
    category: material?.category || 'Insumos',
    subcategory: material?.subcategory || '',
    materialType: material?.materialType || 'ingredient' as Material['materialType'],
    unitWeight: material?.unitWeight?.toString() || '',
  });
  const [duplicateError, setDuplicateError] = useState('');
  const originalName = material?.name || '';

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const weightUnits = ['kg', 'g'];
  const isWeightUnit = weightUnits.includes(formData.usageUnit);
  const needsUnitWeight = !isWeightUnit && formData.usageUnit;

  // Get icon component by name
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Package': return Package;
      case 'Tag': return Tag;
      case 'Wrench': return Wrench;
      case 'Building': return Building;
      default: return Package;
    }
  };

  // Get available subcategories for selected category
  const availableSubcategories = getSubcategoriesByCategory(formData.category);

  const materialTypes = [
    { value: 'ingredient' as const, label: 'Ingrediente' },
    { value: 'packaging' as const, label: 'Embalagem' },
    { value: 'intermediate_product' as const, label: 'Produto Intermediário (Receita-base)' },
    { value: 'finished_product' as const, label: 'Produto Acabado' },
    { value: 'composite_product' as const, label: 'Produto Composto' }
  ];


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.purchaseUnit || !formData.usageUnit || !formData.conversionFactor) return;

    // Verificar duplicidade apenas se o nome foi alterado do original
    if (formData.name.toLowerCase() !== originalName.toLowerCase()) {
      const duplicateMaterial = existingMaterials.find(mat => 
        mat.name.toLowerCase() === formData.name.toLowerCase() && 
        (!material || mat.id !== material.id)
      );

      if (duplicateMaterial) {
        setDuplicateError(`Já existe um material cadastrado com o nome "${duplicateMaterial.name}"`);
        return;
      }
    }

    setDuplicateError('');
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      purchaseUnit: formData.purchaseUnit,
      usageUnit: formData.usageUnit,
      conversionFactor: parseFloat(formData.conversionFactor),
      pricePerPurchaseUnit: 0, // Valor padrão, será definido no controle de estoque
      supplier: formData.supplier || undefined,
      allowedBrands: formData.allowedBrands ? formData.allowedBrands.split(',').map(b => b.trim()).filter(b => b) : undefined,
      category: formData.category,
      subcategory: formData.subcategory || undefined,
      materialType: formData.materialType,
      unitWeight: formData.unitWeight ? parseFloat(formData.unitWeight) : undefined,
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
    // Quando selecionar um nome existente, mostrar aviso apenas se não for o próprio material
    // e se o nome for diferente do original
    const existing = existingMaterials.find(mat => 
      mat.name.toLowerCase() === selectedName.toLowerCase()
    );
    if (existing && (!material || existing.id !== material.id) && selectedName.toLowerCase() !== originalName.toLowerCase()) {
      setDuplicateError(`Material "${selectedName}" já está cadastrado`);
    }
  };

  const selectedCategory = materialCategories.find(cat => cat.value === formData.category);
  
  // Reset subcategory when category changes
  const handleCategoryChange = (newCategory: string) => {
    setFormData({ 
      ...formData, 
      category: newCategory,
      subcategory: '' // Reset subcategory when category changes
    });
  };

  return (
    <Card className="shadow-elegant border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-primary flex items-center gap-2">
            {selectedCategory && (() => {
              const IconComponent = getIconComponent(selectedCategory.icon);
              return <IconComponent className="h-5 w-5" />;
            })()}
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
            <Select value={formData.category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {materialCategories.map((category) => {
                  const IconComponent = getIconComponent(category.icon);
                  return (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center gap-3">
                        <IconComponent className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{category.label}</div>
                          <div className="text-xs text-muted-foreground">{category.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          {availableSubcategories.length > 0 && (
            <div className="space-y-3">
              <Label htmlFor="subcategory">Subcategoria (Opcional)</Label>
              <Select value={formData.subcategory} onValueChange={(value) => setFormData({ ...formData, subcategory: value })}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Selecione uma subcategoria" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  <SelectItem value="">Nenhuma subcategoria</SelectItem>
                  {availableSubcategories.map((subcategory) => (
                    <SelectItem key={subcategory.value} value={subcategory.value}>
                      <div>
                        <div className="font-medium">{subcategory.label}</div>
                        <div className="text-xs text-muted-foreground">{subcategory.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              originalValue={originalName}
              className={duplicateError ? "border-red-300 focus:border-red-500" : ""}
            />
          </div>

          {/* Descrição do Material */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição Detalhada</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva as características, propriedades e especificações técnicas do material..."
              className="min-h-20"
            />
            <p className="text-xs text-muted-foreground">
              Inclua informações relevantes como características físicas, qualidade, especificações técnicas, etc.
            </p>
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
            
          </div>


          {needsUnitWeight && (
            <div className="space-y-2">
              <Label htmlFor="unitWeight">Peso por {formData.usageUnit} (gramas) *</Label>
              <Input
                id="unitWeight"
                type="number"
                step="0.1"
                value={formData.unitWeight}
                onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                placeholder="Ex: 50 (gramas por unidade)"
                required
              />
              <p className="text-xs text-muted-foreground">
                Peso em gramas de 1 {formData.usageUnit} para cálculos de receitas
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

          <div className="space-y-2">
            <Label htmlFor="allowedBrands">Marcas Permitidas (Opcional)</Label>
            <Input
              id="allowedBrands"
              value={formData.allowedBrands}
              onChange={(e) => setFormData({ ...formData, allowedBrands: e.target.value })}
              placeholder="Ex: Fleischmann, Fermipan, Itaiquara (separar por vírgulas)"
            />
            <p className="text-xs text-muted-foreground">
              Liste as marcas aprovadas para compra deste material, separadas por vírgulas
            </p>
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