import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  X,
  Save,
  ArrowLeft,
  ArrowRight,
  Package,
  Warehouse,
  Truck,
  FileText,
  Paperclip,
  History,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Material } from "@/types";
import { useTaxonomy } from "@/hooks/useConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { HelpTooltip } from "@/components/ui/help-tooltip";

interface MaterialEditorProps {
  material?: Material;
  materials: Material[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (material: Material) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigate?: { prev: boolean; next: boolean };
}

export const MaterialEditor = ({ 
  material, 
  materials,
  isOpen, 
  onClose, 
  onSave, 
  onNavigate,
  canNavigate 
}: MaterialEditorProps) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isMobile = useIsMobile();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [formData, setFormData] = useState({
    name: material?.name || '',
    description: material?.description || '',
    purchaseUnit: material?.purchaseUnit || '',
    usageUnit: material?.usageUnit || '',
    conversionFactor: material?.conversionFactor?.toString() || '',
    supplier: material?.supplier || '',
    allowedBrands: material?.allowedBrands?.join(', ') || '',
    typeTermId: '', // Will be set in useEffect based on material data
    category: material?.category || '',
    subcategory: material?.subcategory || '',
    materialType: material?.materialType || 'ingredient' as Material['materialType'],
    unitWeight: material?.unitWeight?.toString() || '',
    tracksInventory: material?.tracksInventory !== false, // default true
  });

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const weightUnits = ['kg', 'g'];
  const isWeightUnit = weightUnits.includes(formData.usageUnit);
  const needsUnitWeight = !isWeightUnit && formData.usageUnit;

const { loading: taxonomyLoading, getTermsByTaxonomy } = useTaxonomy();

// Get material types from taxonomy (first level)
const materialTypesFromTaxonomy = getTermsByTaxonomy('material_type').filter(term => term.is_active);

// Get all categories and subcategories
const allCategories = getTermsByTaxonomy('material_category').filter(t => t.is_active);
const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(t => t.is_active);

// Filter categories based on selected type
// Categories have parent_id pointing to the material_type term
const availableCategories = formData.typeTermId 
  ? allCategories.filter(cat => cat.parent_id === formData.typeTermId)
  : allCategories; // Show all categories if no type selected (for backward compatibility)

// Get available subcategories for selected category
const selectedCategoryTerm = allCategories.find(cat => cat.name === formData.category);
const availableSubcategories = selectedCategoryTerm
  ? allSubcategories.filter(sub => sub.parent_id === selectedCategoryTerm.id)
  : [];

// Map type term to legacy materialType for database
const getLegacyMaterialType = (typeTermId: string): Material['materialType'] => {
  const typeTerm = materialTypesFromTaxonomy.find(t => t.id === typeTermId);
  if (!typeTerm) return 'ingredient';
  
  const nameToType: Record<string, Material['materialType']> = {
    'Insumo': 'ingredient',
    'Embalagem': 'packaging',
    'Produto Acabado': 'finished_product',
    'Produto Intermediário': 'intermediate_product',
    'Produto Composto': 'composite_product',
    'Produto de Revenda': 'ingredient', // fallback
    'Material de Limpeza': 'ingredient', // fallback
    'Material de Consumo': 'ingredient', // fallback
  };
  return nameToType[typeTerm.name] || 'ingredient';
};

  // Helper function to get type term ID from material
  // Uses the stored typeTermId if available, otherwise falls back to materialType mapping
  const getTypeTermIdFromMaterial = (mat: Material): string => {
    // First check if material has typeTermId directly (from database)
    if (mat.typeTermId) {
      return mat.typeTermId;
    }
    
    // Fallback: try to find type term based on materialType
    const typeMapping: Record<Material['materialType'], string> = {
      'ingredient': 'Insumo',
      'packaging': 'Embalagem',
      'finished_product': 'Produto Acabado',
      'intermediate_product': 'Produto Intermediário',
      'composite_product': 'Produto Composto',
    };
    
    const typeName = typeMapping[mat.materialType];
    const typeTerm = materialTypesFromTaxonomy.find(t => t.name === typeName);
    return typeTerm?.id || '';
  };

  // Update form data when material changes
  useEffect(() => {
    if (material && materialTypesFromTaxonomy.length > 0) {
      const typeTermId = getTypeTermIdFromMaterial(material);
      setFormData({
        name: material.name,
        description: material.description || '',
        purchaseUnit: material.purchaseUnit,
        usageUnit: material.usageUnit,
        conversionFactor: material.conversionFactor.toString(),
        supplier: material.supplier || '',
        allowedBrands: material.allowedBrands?.join(', ') || '',
        typeTermId: typeTermId,
        category: material.category,
        subcategory: material.subcategory || '',
        materialType: material.materialType,
        unitWeight: material.unitWeight?.toString() || '',
        tracksInventory: material.tracksInventory !== false,
      });
    }
  }, [material, materialTypesFromTaxonomy]);

  // Track changes
  useEffect(() => {
    if (material && materialTypesFromTaxonomy.length > 0) {
      const initialTypeTermId = getTypeTermIdFromMaterial(material);
      const hasChanges = 
        formData.name !== material.name ||
        formData.description !== (material.description || '') ||
        formData.purchaseUnit !== material.purchaseUnit ||
        formData.usageUnit !== material.usageUnit ||
        formData.conversionFactor !== material.conversionFactor.toString() ||
        formData.supplier !== (material.supplier || '') ||
        formData.allowedBrands !== (material.allowedBrands?.join(', ') || '') ||
        formData.typeTermId !== initialTypeTermId ||
        formData.category !== material.category ||
        formData.subcategory !== (material.subcategory || '') ||
        formData.materialType !== material.materialType ||
        formData.unitWeight !== (material.unitWeight?.toString() || '') ||
        formData.tracksInventory !== (material.tracksInventory !== false);
      
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, material, materialTypesFromTaxonomy]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, hasUnsavedChanges]);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm('Você tem alterações não salvas. Deseja realmente sair?');
      if (!confirmClose) return;
    }
    
    setHasUnsavedChanges(false);
    setDuplicateError('');
    onClose();
    
    if (isMobile && id) {
      navigate('/ingredientes');
    }
  };

  const handleSave = async () => {
    if (!material || !formData.name || !formData.purchaseUnit || !formData.usageUnit || !formData.conversionFactor) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Check for duplicates
    if (formData.name.toLowerCase() !== material.name.toLowerCase()) {
      const duplicateMaterial = materials.find(mat => 
        mat.name.toLowerCase() === formData.name.toLowerCase() && 
        mat.id !== material.id
      );

      if (duplicateMaterial) {
        setDuplicateError(`Já existe um material cadastrado com o nome "${duplicateMaterial.name}"`);
        return;
      }
    }

    setDuplicateError('');

    // Get legacy materialType from type term
    const legacyMaterialType = getLegacyMaterialType(formData.typeTermId);
    
    // Find taxonomy term IDs for the selected category and subcategory
    const categoryTerm = allCategories.find(cat => cat.name === formData.category);
    const subcategoryTerm = formData.subcategory 
      ? availableSubcategories.find(sub => sub.name === formData.subcategory)
      : undefined;

    const updatedMaterial: Material = {
      ...material,
      name: formData.name,
      description: formData.description || undefined,
      purchaseUnit: formData.purchaseUnit,
      usageUnit: formData.usageUnit,
      conversionFactor: parseFloat(formData.conversionFactor),
      supplier: formData.supplier || undefined,
      allowedBrands: formData.allowedBrands ? formData.allowedBrands.split(',').map(b => b.trim()).filter(b => b) : undefined,
      category: formData.category,
      subcategory: formData.subcategory || undefined,
      typeTermId: formData.typeTermId || undefined,
      categoryTermId: categoryTerm?.id,
      subcategoryTermId: subcategoryTerm?.id,
      materialType: legacyMaterialType,
      unitWeight: formData.unitWeight ? parseFloat(formData.unitWeight) : undefined,
      tracksInventory: formData.tracksInventory,
    };

    onSave(updatedMaterial);
    setHasUnsavedChanges(false);
  };

  // Reset category and subcategory when type changes
  const handleTypeChange = (newTypeTermId: string) => {
    setFormData({ 
      ...formData, 
      typeTermId: newTypeTermId,
      category: '', // Reset category when type changes
      subcategory: '' // Reset subcategory when type changes
    });
  };

  const handleCategoryChange = (newCategory: string) => {
    setFormData({ 
      ...formData, 
      category: newCategory,
      subcategory: '' // Reset subcategory when category changes
    });
  };

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value });
    if (duplicateError) {
      setDuplicateError('');
    }
  };

  if (!material) return null;

  const EditorContent = () => (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-background border-b z-10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {material.code}
                </Badge>
                <h2 className="text-lg font-semibold">{material.name}</h2>
              </div>
              <p className="text-sm text-muted-foreground">Editor de Material</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onNavigate && canNavigate && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('prev')}
                  disabled={!canNavigate.prev}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('next')}
                  disabled={!canNavigate.next}
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0">
            <TabsTrigger value="general" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Package className="h-4 w-4" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Warehouse className="h-4 w-4" />
              Estoque
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Truck className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="fiscal" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" disabled>
              <FileText className="h-4 w-4" />
              Fiscal
            </TabsTrigger>
            <TabsTrigger value="attachments" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" disabled>
              <Paperclip className="h-4 w-4" />
              Anexos
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none" disabled>
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <div className="p-6">
            <TabsContent value="general" className="mt-0 space-y-6">
              {duplicateError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {duplicateError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Tipo de Material - Primeiro nível da hierarquia */}
              <div className="space-y-3">
                <Label className="flex items-center">
                  Tipo de Material *
                  <HelpTooltip content='Selecione o tipo principal do material. Isso determina as categorias e subcategorias disponíveis.' />
                </Label>
                <Select value={formData.typeTermId} onValueChange={handleTypeChange} disabled={taxonomyLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={taxonomyLoading ? "Carregando..." : "Selecione o tipo de material"} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    {materialTypesFromTaxonomy.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div>
                          <div className="font-medium">{type.name}</div>
                          {type.code && (
                            <div className="text-xs text-muted-foreground">Código: {type.code}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria - Segundo nível da hierarquia */}
              <div className="space-y-3">
                <Label className="flex items-center">
                  Categoria *
                  <HelpTooltip content='Classifique corretamente o material. As categorias disponíveis dependem do Tipo selecionado.' />
                </Label>
                <Select 
                  value={formData.category} 
                  onValueChange={handleCategoryChange} 
                  disabled={taxonomyLoading || !formData.typeTermId || availableCategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      taxonomyLoading ? "Carregando..." : 
                      !formData.typeTermId ? "Selecione um tipo primeiro" :
                      availableCategories.length === 0 ? "Nenhuma categoria disponível" :
                      "Selecione uma categoria"
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    {availableCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        <div>
                          <div className="font-medium">{category.name}</div>
                          {category.code && (
                            <div className="text-xs text-muted-foreground">Código: {category.code}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategoria - Terceiro nível da hierarquia */}
              <div className="space-y-3">
                <Label>Subcategoria (Opcional)</Label>
                <Select 
                  value={formData.subcategory || 'none'} 
                  onValueChange={(value) => setFormData({ ...formData, subcategory: value === 'none' ? '' : value })}
                  disabled={taxonomyLoading || !formData.category || availableSubcategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      taxonomyLoading ? "Carregando..." : 
                      !formData.category ? "Selecione uma categoria primeiro" :
                      availableSubcategories.length === 0 ? "Nenhuma subcategoria disponível" : 
                      "Selecione uma subcategoria"
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    <SelectItem value="none">Nenhuma subcategoria</SelectItem>
                    {availableSubcategories.map((subcategory) => (
                      <SelectItem key={subcategory.id} value={subcategory.name}>
                        <div>
                          <div className="font-medium">{subcategory.name}</div>
                          {subcategory.code && (
                            <div className="text-xs text-muted-foreground">Código: {subcategory.code}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label>Nome do Material *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Farinha de trigo, Caixa de papelão, Brigadeiro"
                  className={duplicateError ? "border-red-300 focus:border-red-500" : ""}
                />
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label>Descrição Detalhada</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva as características, propriedades e especificações técnicas do material..."
                  className="min-h-20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center">
                    Unidade de Compra *
                    <HelpTooltip content="Unidade na qual o material é adquirido (ex: kg, pacote, caixa)." />
                  </Label>
                  <Select value={formData.purchaseUnit} onValueChange={(value) => setFormData({ ...formData, purchaseUnit: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Como você compra?" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {units.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center">
                    Unidade de Uso *
                    <HelpTooltip content="Unidade utilizada na produção/receita (ex: g, ml, unidade)." />
                  </Label>
                  <Select value={formData.usageUnit} onValueChange={(value) => setFormData({ ...formData, usageUnit: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Como você usa?" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {units.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center">
                  Fator de Conversão *
                  <HelpTooltip content="Relação entre a unidade de compra e a unidade de uso. Exemplo: 1kg = 1000g → fator de conversão = 1000." />
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.conversionFactor}
                  onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                  placeholder="Ex: 1000 (1kg = 1000g)"
                />
                <p className="text-xs text-muted-foreground">
                  Quantas unidades de uso em 1 unidade de compra
                </p>
              </div>

              {needsUnitWeight && (
                <div className="space-y-2">
                  <Label>Peso por {formData.usageUnit} (gramas) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.unitWeight}
                    onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                    placeholder="Ex: 50 (gramas por unidade)"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Marcas Permitidas (Opcional)</Label>
                <Input
                  value={formData.allowedBrands}
                  onChange={(e) => setFormData({ ...formData, allowedBrands: e.target.value })}
                  placeholder="Ex: Fleischmann, Fermipan, Itaiquara (separar por vírgulas)"
                />
              </div>
            </TabsContent>

            <TabsContent value="stock" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    Informações de Estoque
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantidade Atual</Label>
                      <Input value="0" disabled />
                      <p className="text-xs text-muted-foreground">Somente leitura</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Estoque Mínimo</Label>
                      <Input value="0" disabled />
                      <p className="text-xs text-muted-foreground">Somente leitura</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Preço Médio</Label>
                      <Input value="R$ 0,00" disabled />
                      <p className="text-xs text-muted-foreground">Somente leitura</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Movimenta Estoque</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Desative para materiais de uso e consumo (combustível, descartáveis).
                        A NF será registrada como despesa sem gerar entrada no estoque.
                      </p>
                    </div>
                    <Switch
                      checked={formData.tracksInventory}
                      onCheckedChange={(checked) => setFormData({ ...formData, tracksInventory: checked })}
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir em Controle de Estoque
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="suppliers" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Fornecedores
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fornecedor Principal (Opcional)</Label>
                    <Input
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      placeholder="Ex: Distribuidora ABC"
                    />
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Funcionalidades avançadas de fornecedores serão implementadas em breve.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 bg-background border-t px-6 py-4">
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={!hasUnsavedChanges}>
            Salvar e Continuar
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return EditorContent();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Editor de Material</DialogTitle>
        </VisuallyHidden>
        {EditorContent()}
      </DialogContent>
    </Dialog>
  );
};