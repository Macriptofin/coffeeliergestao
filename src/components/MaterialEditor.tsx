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
    category: material?.category || 'Insumo',
    subcategory: material?.subcategory || '',
    materialType: material?.materialType || 'ingredient' as Material['materialType'],
    unitWeight: material?.unitWeight?.toString() || '',
    densityGPerMl: material?.densityGPerMl?.toString() || '',
    ncm: (material as any)?.ncm || '',
    cfopPadrao: (material as any)?.cfop_padrao || '',
    cstCsosn: (material as any)?.cst_csosn || '',
    origem: (material as any)?.origem?.toString() || '0',
  });

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const weightUnits = ['kg', 'g'];
  const volumeUnits = ['ml', 'l'];
  const isWeightUnit = weightUnits.includes(formData.usageUnit?.toLowerCase() || '');
  const isVolumeUnit = volumeUnits.includes(formData.usageUnit?.toLowerCase() || '');
  const needsUnitWeight = !isWeightUnit && !isVolumeUnit && formData.usageUnit;

const { loading: taxonomyLoading, getTermsByTaxonomy } = useTaxonomy();

const materialCategories = getTermsByTaxonomy('material_category').filter(t => t.is_active && !t.parent_id);
const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(t => t.is_active);

const selectedCategoryTerm = materialCategories.find(cat => cat.name === formData.category);
const availableSubcategories = selectedCategoryTerm
  ? allSubcategories.filter(sub => sub.parent_id === selectedCategoryTerm.id)
  : [];


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
        densityGPerMl: material.densityGPerMl?.toString() || '',
        ncm: (material as any)?.ncm || '',
        cfopPadrao: (material as any)?.cfop_padrao || '',
        cstCsosn: (material as any)?.cst_csosn || '',
        origem: (material as any)?.origem?.toString() || '0',
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
        formData.unitWeight !== (material.unitWeight?.toString() || '') ||
        formData.densityGPerMl !== (material.densityGPerMl?.toString() || '') ||
        formData.ncm !== ((material as any)?.ncm || '') ||
        formData.cfopPadrao !== ((material as any)?.cfop_padrao || '') ||
        formData.cstCsosn !== ((material as any)?.cst_csosn || '') ||
        formData.origem !== ((material as any)?.origem?.toString() || '0');
      
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
      densityGPerMl: formData.densityGPerMl ? parseFloat(formData.densityGPerMl) : undefined,
      ncm: formData.ncm || undefined,
      cfop_padrao: formData.cfopPadrao || undefined,
      cst_csosn: formData.cstCsosn || undefined,
      origem: formData.origem ? parseInt(formData.origem) : 0,
    } as any;

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
            <TabsTrigger value="fiscal" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
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
                <Label className="flex items-center">
                  Categoria do Material *
                  <HelpTooltip content='Classifique corretamente o material. Exemplo: Categoria "Insumos" → Subcategoria "Condimentos e Temperos".' />
                </Label>
                <Select value={formData.category} onValueChange={handleCategoryChange} disabled={taxonomyLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {materialCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{category.name}</div>
                            {category.code && (
                              <div className="text-xs text-muted-foreground">Código: {category.code}</div>
                            )}
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

              {/* Campo de Densidade para unidades volumétricas */}
              {isVolumeUnit && (
                <div className="space-y-2">
                  <Label className="flex items-center">
                    Densidade (g/mL) *
                    <HelpTooltip content="Densidade em gramas por mililitro. Necessário para calcular o peso nas receitas. Exemplos: água = 1,00 | leite = 1,03 | óleo = 0,92" />
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.densityGPerMl}
                    onChange={(e) => setFormData({ ...formData, densityGPerMl: e.target.value })}
                    placeholder="Ex: 1.03 (leite)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplos: água = 1,00 | leite = 1,03 | óleo = 0,92 | mel = 1,42
                  </p>
                </div>
              )}

              {/* Campo de Peso Unitário para unidades não-peso/não-volume */}
              {needsUnitWeight && (
                <div className="space-y-2">
                  <Label className="flex items-center">
                    Peso por {formData.usageUnit} (gramas) *
                    <HelpTooltip content={`Peso em gramas de 1 ${formData.usageUnit}. Exemplo: 1 ovo médio = 50g`} />
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.unitWeight}
                    onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                    placeholder="Ex: 50 (gramas por unidade)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Peso em gramas de 1 {formData.usageUnit}
                  </p>
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

            <TabsContent value="fiscal" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Informações Fiscais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Campos necessários para emissão de Nota Fiscal Eletrônica (NF-e). 
                      Consulte seu contador para preenchimento correto.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label className="flex items-center">
                      NCM (Nomenclatura Comum do Mercosul)
                      <HelpTooltip content="Código de 8 dígitos que classifica fiscalmente o produto. Ex: 19059090 para produtos de padaria." />
                    </Label>
                    <Input
                      value={formData.ncm}
                      onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                      placeholder="Ex: 19059090"
                      maxLength={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center">
                      CFOP Padrão
                      <HelpTooltip content="Código Fiscal de Operações e Prestações. Define a natureza da operação. Ex: 5102 para venda dentro do estado." />
                    </Label>
                    <Input
                      value={formData.cfopPadrao}
                      onChange={(e) => setFormData({ ...formData, cfopPadrao: e.target.value })}
                      placeholder="Ex: 5102"
                      maxLength={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center">
                      CST/CSOSN
                      <HelpTooltip content="Código de Situação Tributária (CST) ou Código de Situação da Operação no Simples Nacional (CSOSN). Ex: 102 para empresas do Simples." />
                    </Label>
                    <Input
                      value={formData.cstCsosn}
                      onChange={(e) => setFormData({ ...formData, cstCsosn: e.target.value })}
                      placeholder="Ex: 102"
                      maxLength={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center">
                      Origem da Mercadoria *
                      <HelpTooltip content="Código que indica a origem do produto: 0=Nacional, 1=Estrangeira importação direta, 2=Estrangeira adquirida no mercado interno, etc." />
                    </Label>
                    <Select 
                      value={formData.origem} 
                      onValueChange={(value) => setFormData({ ...formData, origem: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="0">0 - Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8</SelectItem>
                        <SelectItem value="1">1 - Estrangeira - Importação direta, exceto a indicada no código 6</SelectItem>
                        <SelectItem value="2">2 - Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7</SelectItem>
                        <SelectItem value="3">3 - Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%</SelectItem>
                        <SelectItem value="4">4 - Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos</SelectItem>
                        <SelectItem value="5">5 - Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%</SelectItem>
                        <SelectItem value="6">6 - Estrangeira - Importação direta, sem similar nacional, constante em lista de Resolução CAMEX e gás natural</SelectItem>
                        <SelectItem value="7">7 - Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CAMEX e gás natural</SelectItem>
                        <SelectItem value="8">8 - Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      💡 <strong>Dica:</strong> Esses campos são essenciais para emitir NF-e. 
                      Consulte sempre seu contador ou a tabela SEFAZ do seu estado.
                    </p>
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