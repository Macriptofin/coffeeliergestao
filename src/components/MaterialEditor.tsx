import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import type { Material } from "@/types";
import { materialCategories, getSubcategoriesByCategory } from "@/lib/material-categories";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
    category: material?.category || 'Insumo',
    subcategory: material?.subcategory || '',
    materialType: material?.materialType || 'ingredient' as Material['materialType'],
    unitWeight: material?.unitWeight?.toString() || '',
  });

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const weightUnits = ['kg', 'g'];
  const isWeightUnit = weightUnits.includes(formData.usageUnit);
  const needsUnitWeight = !isWeightUnit && formData.usageUnit;

  const availableSubcategories = getSubcategoriesByCategory(formData.category);

  const materialTypes = [
    { value: 'ingredient' as const, label: 'Ingrediente' },
    { value: 'packaging' as const, label: 'Embalagem' },
    { value: 'intermediate_product' as const, label: 'Produto Intermediário (Receita-base)' },
    { value: 'finished_product' as const, label: 'Produto Acabado' },
    { value: 'composite_product' as const, label: 'Produto Composto' }
  ];

  // Update form data when material changes
  useEffect(() => {
    if (material) {
      setFormData({
        name: material.name,
        description: material.description || '',
        purchaseUnit: material.purchaseUnit,
        usageUnit: material.usageUnit,
        conversionFactor: material.conversionFactor.toString(),
        supplier: material.supplier || '',
        allowedBrands: material.allowedBrands?.join(', ') || '',
        category: material.category,
        subcategory: material.subcategory || '',
        materialType: material.materialType,
        unitWeight: material.unitWeight?.toString() || '',
      });
    }
  }, [material]);

  // Track changes
  useEffect(() => {
    if (material) {
      const hasChanges = 
        formData.name !== material.name ||
        formData.description !== (material.description || '') ||
        formData.purchaseUnit !== material.purchaseUnit ||
        formData.usageUnit !== material.usageUnit ||
        formData.conversionFactor !== material.conversionFactor.toString() ||
        formData.supplier !== (material.supplier || '') ||
        formData.allowedBrands !== (material.allowedBrands?.join(', ') || '') ||
        formData.category !== material.category ||
        formData.subcategory !== (material.subcategory || '') ||
        formData.materialType !== material.materialType ||
        formData.unitWeight !== (material.unitWeight?.toString() || '');
      
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, material]);

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
      materialType: formData.materialType,
      unitWeight: formData.unitWeight ? parseFloat(formData.unitWeight) : undefined,
    };

    onSave(updatedMaterial);
    setHasUnsavedChanges(false);
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

              {/* Categoria */}
              <div className="space-y-3">
                <Label>Categoria do Material *</Label>
                <Select value={formData.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {materialCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-3">
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

              {/* Subcategoria */}
              {availableSubcategories.length > 0 && (
                <div className="space-y-3">
                  <Label>Subcategoria (Opcional)</Label>
                  <Select value={formData.subcategory || 'none'} onValueChange={(value) => setFormData({ ...formData, subcategory: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma subcategoria" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="none">Nenhuma subcategoria</SelectItem>
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
                  <Label>Unidade de Compra *</Label>
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
                  <Label>Unidade de Uso *</Label>
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
                <Label>Fator de Conversão *</Label>
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
    return <EditorContent />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
        <EditorContent />
      </DialogContent>
    </Dialog>
  );
};