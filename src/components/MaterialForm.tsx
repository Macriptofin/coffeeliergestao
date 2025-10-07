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
import { useTaxonomy } from "@/hooks/useConfig";
import { HelpTooltip } from "@/components/ui/help-tooltip";

interface MaterialFormProps {
  material?: Material | null;
  existingMaterials: Material[];
  onSubmit: (material: Omit<Material, 'id' | 'code'>) => void;
  onCancel: () => void;
}

export const MaterialForm = ({ material, existingMaterials, onSubmit, onCancel }: MaterialFormProps) => {
  const { terms, loading: taxonomyLoading, getTermsByTaxonomy } = useTaxonomy();
  
  const [formData, setFormData] = useState({
    name: material?.name || '',
    description: material?.description || '',
    purchaseUnit: material?.purchaseUnit || '',
    usageUnit: material?.usageUnit || '',
    conversionFactor: material?.conversionFactor?.toString() || '',
    supplier: material?.supplier || '',
    allowedBrands: material?.allowedBrands?.join(', ') || '',
    category: material?.category || 'Insumo',
    subcategory: material?.subcategory || '',
    materialType: material?.materialType || 'ingredient' as Material['materialType'],
    unitWeight: material?.unitWeight?.toString() || '',
    densityGPerMl: material?.densityGPerMl?.toString() || '',
  });
  const [duplicateError, setDuplicateError] = useState('');
  const originalName = material?.name || '';

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const weightUnits = ['kg', 'g'];
  const volumeUnits = ['ml', 'l'];
  const isWeightUnit = weightUnits.includes(formData.usageUnit.toLowerCase());
  const isVolumeUnit = volumeUnits.includes(formData.usageUnit.toLowerCase());
  const needsUnitWeight = !isWeightUnit && !isVolumeUnit && formData.usageUnit;

  // Get icon component by category
  const getIconForCategory = (categoryName: string) => {
    // Map category names to icons
    if (categoryName?.toLowerCase().includes('embalagem')) return Package;
    if (categoryName?.toLowerCase().includes('produto')) return Tag;
    if (categoryName?.toLowerCase().includes('higiene')) return Wrench;
    if (categoryName?.toLowerCase().includes('infraestrutura')) return Building;
    return Package; // default
  };

  // Get dynamic categories and subcategories from taxonomy
  const materialCategories = getTermsByTaxonomy('material_category').filter(term => term.is_active && !term.parent_id);
  const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(term => term.is_active);
  
  // Get available subcategories for selected category
  const selectedCategoryTerm = materialCategories.find(cat => cat.name === formData.category);
  const availableSubcategories = selectedCategoryTerm 
    ? allSubcategories.filter(sub => sub.parent_id === selectedCategoryTerm.id)
    : allSubcategories.filter(() => false);

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
    
    // Find taxonomy term IDs for the selected category and subcategory
    const categoryTerm = materialCategories.find(cat => cat.name === formData.category);
    const subcategoryTerm = formData.subcategory 
      ? availableSubcategories.find(sub => sub.name === formData.subcategory)
      : undefined;

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
      categoryTermId: categoryTerm?.id,
      subcategoryTermId: subcategoryTerm?.id,
      materialType: formData.materialType,
      unitWeight: formData.unitWeight ? parseFloat(formData.unitWeight) : undefined,
      densityGPerMl: formData.densityGPerMl ? parseFloat(formData.densityGPerMl) : undefined,
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

  const selectedCategory = materialCategories.find(cat => cat.name === formData.category);
  
  // Reset subcategory when category changes
  const handleCategoryChange = (newCategory: string) => {
    setFormData({ 
      ...formData, 
      category: newCategory,
      subcategory: '' // Reset subcategory when category changes
    });
  };

  // Produtos intermediários e acabados só podem ter composição editada via BOM
  const isBOMProduct = material && ['intermediate_product', 'finished_product'].includes(material.materialType);
  const isEditingBOMProduct = Boolean(isBOMProduct && material);

  return (
    <Card className="shadow-elegant border-primary/20 w-full">
      <CardHeader className="pb-4 px-4 sm:px-6">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0">
              {(() => {
                const IconComponent = getIconForCategory(formData.category);
                return <IconComponent className="h-5 w-5" />;
              })()}
            </div>
            <CardTitle className="text-primary truncate">
              {material ? 'Editar Material' : 'Novo Material'}
            </CardTitle>
            {material && (
              <Badge variant="outline" className="ml-2 flex-shrink-0">
                {material.code}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {isEditingBOMProduct && (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <strong>Produto com BOM:</strong> Os campos de composição (unidades, conversão, peso) são gerenciados pela ficha técnica e não podem ser alterados aqui.
              </AlertDescription>
            </Alert>
          )}
          
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
            <Label htmlFor="category" className="flex items-center">
              Categoria do Material *
              <HelpTooltip content='Classifique corretamente o material. Exemplo: Categoria "Insumos" → Subcategoria "Condimentos e Temperos".' />
            </Label>
            <Select value={formData.category} onValueChange={handleCategoryChange} disabled={taxonomyLoading}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={taxonomyLoading ? "Carregando..." : "Selecione uma categoria"} />
              </SelectTrigger>
              <SelectContent className="bg-card border-border shadow-lg z-50 max-w-[calc(100vw-2rem)]">
                {materialCategories.map((category) => {
                  const IconComponent = getIconForCategory(category.name);
                  return (
                    <SelectItem key={category.id} value={category.name}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{category.name}</div>
                          {category.code && (
                            <div className="text-xs text-muted-foreground truncate">Código: {category.code}</div>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          <div className="space-y-3">
            <Label htmlFor="subcategory">Subcategoria (Opcional)</Label>
            <Select value={formData.subcategory || 'none'} onValueChange={(value) => setFormData({ ...formData, subcategory: value === 'none' ? '' : value })} disabled={taxonomyLoading || availableSubcategories.length === 0}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={
                  taxonomyLoading ? "Carregando..." : 
                  availableSubcategories.length === 0 ? "Nenhuma subcategoria disponível" : 
                  "Selecione uma subcategoria"
                } />
              </SelectTrigger>
              <SelectContent className="bg-card border-border shadow-lg z-50 max-w-[calc(100vw-2rem)]">
                <SelectItem value="none">Nenhuma subcategoria</SelectItem>
                {availableSubcategories.map((subcategory) => (
                  <SelectItem key={subcategory.id} value={subcategory.name}>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{subcategory.name}</div>
                      {subcategory.code && (
                        <div className="text-xs text-muted-foreground truncate">Código: {subcategory.code}</div>
                      )}
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
              <Label htmlFor="purchaseUnit" className="flex items-center">
                Unidade de Compra *
                <HelpTooltip content="Unidade na qual o material é adquirido (ex: kg, pacote, caixa)." />
              </Label>
              <Select 
                value={formData.purchaseUnit} 
                onValueChange={(value) => setFormData({ ...formData, purchaseUnit: value })}
                disabled={isEditingBOMProduct}
              >
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Como você compra?" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border shadow-lg z-50">
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="usageUnit" className="flex items-center">
                Unidade de Uso *
                <HelpTooltip content="Unidade utilizada na produção/receita (ex: g, ml, unidade)." />
              </Label>
              <Select 
                value={formData.usageUnit} 
                onValueChange={(value) => setFormData({ ...formData, usageUnit: value })}
                disabled={isEditingBOMProduct}
              >
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Como você usa?" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border shadow-lg z-50">
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
              <Label htmlFor="conversionFactor" className="flex items-center">
                Fator de Conversão *
                <HelpTooltip content="Relação entre a unidade de compra e a unidade de uso. Exemplo: 1kg = 1000g → fator de conversão = 1000." />
              </Label>
              <Input
                id="conversionFactor"
                type="number"
                step="0.01"
                value={formData.conversionFactor}
                onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                placeholder="Ex: 1000 (1kg = 1000g)"
                required
                disabled={isEditingBOMProduct}
              />
              <p className="text-xs text-muted-foreground">
                Quantas unidades de uso em 1 unidade de compra
              </p>
            </div>
            
          </div>



          {/* Campo de Densidade para unidades volumétricas */}
          {isVolumeUnit && (
            <div className="space-y-2">
              <Label htmlFor="densityGPerMl" className="flex items-center">
                Densidade (g/mL) *
                <HelpTooltip content="Densidade em gramas por mililitro. Necessário para calcular o peso nas receitas. Exemplos: água = 1,00 | leite = 1,03 | óleo = 0,92" />
              </Label>
              <Input
                id="densityGPerMl"
                type="number"
                step="0.001"
                min="0"
                value={formData.densityGPerMl}
                onChange={(e) => setFormData({ ...formData, densityGPerMl: e.target.value })}
                placeholder="Ex: 1.03 (leite)"
                required
                disabled={isEditingBOMProduct}
              />
              <p className="text-xs text-muted-foreground">
                Exemplos: água = 1,00 | leite = 1,03 | óleo = 0,92 | mel = 1,42
              </p>
            </div>
          )}

          {/* Campo de Peso Unitário para unidades não-peso/não-volume */}
          {needsUnitWeight && (
            <div className="space-y-2">
              <Label htmlFor="unitWeight" className="flex items-center">
                Peso por {formData.usageUnit} (gramas) *
                <HelpTooltip content={`Peso em gramas de 1 ${formData.usageUnit}. Exemplo: 1 ovo médio = 50g`} />
              </Label>
              <Input
                id="unitWeight"
                type="number"
                step="0.1"
                value={formData.unitWeight}
                onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                placeholder="Ex: 50 (gramas por unidade)"
                required
                disabled={isEditingBOMProduct}
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

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button type="submit" className="bg-gradient-primary flex-1 w-full sm:w-auto">
              {material ? 'Atualizar Material' : 'Cadastrar Material'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};