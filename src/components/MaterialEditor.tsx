import { useState, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  X,
  Save,
  Leaf,
  ArrowLeft,
  ArrowRight,
  Package,
  Warehouse,
  Truck,
  FileText,
  Paperclip,
  History,
  AlertTriangle,
  ExternalLink,
  ChefHat,
  Plus,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Pencil
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NumericInput } from "@/components/ui/numeric-input";
import type { Material } from "@/types";
import { useTaxonomy } from "@/hooks/useConfig";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { RecipeBOMForm } from "@/components/bom/RecipeBOMForm";

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
  const [editingBOM, setEditingBOM] = useState(false);
  const [bomData, setBomData] = useState<any>(null);
  const [bomLoading, setBomLoading] = useState(false);
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
    ncm: material?.ncm || '',
    cfop: material?.cfop || '',
    cst: material?.cst || '',
    origem: material?.origem?.toString() || '0',
    // Precificação (exibida/editada em PERCENTUAL; convertida p/ fração no save)
    targetMarginPct: material?.targetMarginPct != null ? (material.targetMarginPct * 100).toString() : '',
    overheadPct: material?.overheadPct != null ? (material.overheadPct * 100).toString() : '',
    overheadValue: material?.overheadValue != null ? material.overheadValue.toString() : '',
    practicedPrice: material?.practicedPrice != null ? material.practicedPrice.toString() : '',
  });

  // Breakdown calculado pelo banco (compute_product_pricing) — base p/ preview ao vivo
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const [restrictionTagIds, setRestrictionTagIds] = useState<string[]>(material?.restrictionTagIds ?? []);

  const toggleRestriction = (termId: string) => {
    setRestrictionTagIds(prev =>
      prev.includes(termId) ? prev.filter(id => id !== termId) : [...prev, termId]
    );
  };

  // Track which material has been initialized to prevent formData reset on taxonomy re-renders
  const initializedMaterialId = useRef<string | null>(null);

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
const restrictionTerms = getTermsByTaxonomy('material_restriction')
  .filter(t => t.is_active)
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));

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
const getLegacyMaterialType = (typeTermId: string, categoryName?: string): Material['materialType'] => {
  // Override por categoria: Equipamentos sempre mapeia para 'equipment'
  if (categoryName === 'Equipamentos') return 'equipment';
  const typeTerm = materialTypesFromTaxonomy.find(t => t.id === typeTermId);
  if (!typeTerm) return 'ingredient';

  const nameToType: Record<string, Material['materialType']> = {
    'Insumo': 'ingredient',
    'Embalagem': 'packaging',
    'Produto Intermediário': 'intermediate_product',
    'Produto Acabado': 'finished_product',
    'Produto Composto': 'composite_product',
    'Produto de Revenda': 'resale_product',
    'Material de Limpeza': 'supply',
    'Material de Consumo': 'supply',
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
    const typeMapping: Partial<Record<Material['materialType'], string>> = {
      'ingredient': 'Insumo',
      'packaging': 'Embalagem',
      'finished_product': 'Produto Acabado',
      'intermediate_product': 'Produto Intermediário',
      'composite_product': 'Produto Composto',
      'resale_product': 'Produto de Revenda',
      'supply': 'Material de Consumo',
    };
    
    const typeName = typeMapping[mat.materialType];
    const typeTerm = materialTypesFromTaxonomy.find(t => t.name === typeName);
    return typeTerm?.id || '';
  };

  // Update form data when material changes (guarded by material.id to prevent
  // reset on every taxonomy re-render — materialTypesFromTaxonomy creates a
  // new array reference on each render via .filter(), which would otherwise
  // reset all user edits immediately after any setFormData call)
  useEffect(() => {
    if (material && materialTypesFromTaxonomy.length > 0 && initializedMaterialId.current !== material.id) {
      initializedMaterialId.current = material.id;
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
        ncm: material.ncm || '',
        cfop: material.cfop || '',
        cst: material.cst || '',
        origem: material.origem?.toString() || '0',
        targetMarginPct: material.targetMarginPct != null ? (material.targetMarginPct * 100).toString() : '',
        overheadPct: material.overheadPct != null ? (material.overheadPct * 100).toString() : '',
        overheadValue: material.overheadValue != null ? material.overheadValue.toString() : '',
        practicedPrice: material.practicedPrice != null ? material.practicedPrice.toString() : '',
      });
      setRestrictionTagIds(material.restrictionTagIds ?? []);
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
        formData.tracksInventory !== (material.tracksInventory !== false) ||
        formData.ncm !== (material.ncm || '') ||
        formData.cfop !== (material.cfop || '') ||
        formData.cst !== (material.cst || '') ||
        formData.origem !== (material.origem?.toString() || '0') ||
        formData.targetMarginPct !== (material.targetMarginPct != null ? (material.targetMarginPct * 100).toString() : '') ||
        formData.overheadPct !== (material.overheadPct != null ? (material.overheadPct * 100).toString() : '') ||
        formData.overheadValue !== (material.overheadValue != null ? material.overheadValue.toString() : '') ||
        formData.practicedPrice !== (material.practicedPrice != null ? material.practicedPrice.toString() : '');

      const initialTags = material.restrictionTagIds ?? [];
      const tagsChanged =
        restrictionTagIds.length !== initialTags.length ||
        restrictionTagIds.some(id => !initialTags.includes(id));

      setHasUnsavedChanges(hasChanges || tagsChanged);
    }
  }, [formData, restrictionTagIds, material, materialTypesFromTaxonomy]);

  // Load BOM data for produced materials
  useEffect(() => {
    if (material && ['intermediate_product', 'finished_product'].includes(material.materialType)) {
      loadBOMData();
    }
  }, [material?.id]);

  // Load pricing breakdown (custo direto + herdados) ao abrir o editor
  useEffect(() => {
    const loadPricing = async () => {
      const priceable = material && ['finished_product', 'composite_product', 'resale_product'].includes(material.materialType);
      if (!material?.id || !isOpen || !priceable) return;
      setPricingLoading(true);
      try {
        const { data, error } = await (supabase.rpc as any)('compute_product_pricing', { p_material_id: material.id });
        if (error) throw error;
        setPricing(data);
      } catch (err) {
        console.error('Erro ao calcular precificação:', err);
        setPricing(null);
      } finally {
        setPricingLoading(false);
      }
    };
    loadPricing();
  }, [material?.id, isOpen]);

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

    // Get legacy materialType from type term (com override de categoria Equipamentos)
    const legacyMaterialType = getLegacyMaterialType(formData.typeTermId, formData.category);
    
    // Find taxonomy term IDs for the selected category and subcategory
    const categoryTerm = allCategories.find(cat => cat.name === formData.category);
    const subcategoryTerm = formData.subcategory 
      ? availableSubcategories.find(sub => sub.name === formData.subcategory)
      : undefined;

    // Produtos acabados devem ser vendáveis por padrão (a menos que já esteja explicitamente false)
    const isSellableValue = legacyMaterialType === 'finished_product'
      ? (material.isSellable === false ? false : true)
      : (material.isSellable || false);

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
      isSellable: isSellableValue,
      ncm: formData.ncm || undefined,
      cfop: formData.cfop || undefined,
      cst: formData.cst || undefined,
      origem: formData.origem ? parseInt(formData.origem) : undefined,
      restrictionTagIds,
      // Precificação: percentual → fração; vazio → undefined (salva null = herda)
      targetMarginPct: formData.targetMarginPct.trim() !== '' ? parseFloat(formData.targetMarginPct) / 100 : undefined,
      overheadPct: formData.overheadPct.trim() !== '' ? parseFloat(formData.overheadPct) / 100 : undefined,
      overheadValue: formData.overheadValue.trim() !== '' ? parseFloat(formData.overheadValue) : undefined,
      practicedPrice: formData.practicedPrice.trim() !== '' ? parseFloat(formData.practicedPrice) : undefined,
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

  const isProducedMaterial = material && ['intermediate_product', 'finished_product'].includes(material.materialType);

  // Precificação só para tipos vendáveis (acabado/composto/revenda). Reage ao tipo
  // selecionado no form. Insumos/intermediários/embalagem etc. só têm custo.
  const formLegacyType = getLegacyMaterialType(formData.typeTermId, formData.category);
  const isPriceable = ['finished_product', 'composite_product', 'resale_product'].includes(formLegacyType);

  const loadBOMData = async () => {
    if (!material) return;
    setBomLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes_bom')
        .select(`
          id, yield_quantity, yield_unit, cached_total_cost, cached_unit_cost,
          cost_status, missing_cost_items, cost_last_calculated_at,
          recipe_bom_items (id, material_id, quantity, unit, waste_percent, is_packaging)
        `)
        .eq('finished_material_id', material.id)
        .eq('is_archived', false)
        .maybeSingle();
      if (error) throw error;
      setBomData(data);
    } catch (err) {
      console.error('Erro ao carregar BOM:', err);
      setBomData(null);
    } finally {
      setBomLoading(false);
    }
  };

  // ── Preview ao vivo da precificação ──────────────────────────────────────
  // Valores efetivos = override do form (se preenchido) OU herdado do compute do banco.
  const directCost = pricing?.direct_cost != null ? Number(pricing.direct_cost) : 0;
  const inheritedOhPct = pricing?.overhead_pct != null ? Number(pricing.overhead_pct) : 0;
  const inheritedOhVal = pricing?.overhead_value != null ? Number(pricing.overhead_value) : 0;
  const inheritedMargin = pricing?.margin_pct != null ? Number(pricing.margin_pct) : 0;
  const marginSource: string | undefined = pricing?.margin_source;

  const effOhPct = formData.overheadPct.trim() !== '' ? parseFloat(formData.overheadPct) / 100 : inheritedOhPct;
  const effOhVal = formData.overheadValue.trim() !== '' ? parseFloat(formData.overheadValue) : inheritedOhVal;
  const effMargin = formData.targetMarginPct.trim() !== '' ? parseFloat(formData.targetMarginPct) / 100 : inheritedMargin;
  const usingInheritedMargin = formData.targetMarginPct.trim() === '';

  const totalCost = directCost * (1 + (isNaN(effOhPct) ? 0 : effOhPct)) + (isNaN(effOhVal) ? 0 : effOhVal);
  const previewSuggested = effMargin < 1 ? totalCost / (1 - effMargin) : 0;

  const practicedNum = formData.practicedPrice.trim() !== '' ? parseFloat(formData.practicedPrice) : null;
  const realizedMargin = practicedNum != null && practicedNum > 0
    ? (practicedNum - totalCost) / practicedNum
    : null;

  const marginSourceLabel = (src?: string) =>
    src === 'produto' ? 'produto' : src === 'categoria' ? 'categoria' : src === 'global' ? 'global' : '';

  if (!material) return null;

  const EditorContent = () => (
    <div className="flex flex-col h-[90vh]">
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
      <div className="flex-1 overflow-auto min-h-0">
        {/* Quando editando BOM, sai das tabs para ter scroll próprio */}
        {editingBOM && isProducedMaterial ? (
          <div className="p-6">
            <RecipeBOMForm
              finishedMaterial={{
                id: material.id,
                name: material.name,
                code: material.code,
                usage_unit: material.usageUnit,
                material_type: material.materialType,
              }}
              onSuccess={() => {
                setEditingBOM(false);
                loadBOMData();
              }}
              onCancel={() => setEditingBOM(false)}
            />
          </div>
        ) : (
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
            {isPriceable && (
              <TabsTrigger value="pricing" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <DollarSign className="h-4 w-4" />
                Precificação
              </TabsTrigger>
            )}
            {isProducedMaterial && (
              <TabsTrigger value="bom" className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                <ChefHat className="h-4 w-4" />
                Ficha Técnica
                {bomData && <Badge variant="secondary" className="ml-1 text-xs">✓</Badge>}
              </TabsTrigger>
            )}
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

              {restrictionTerms.length > 0 && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Leaf className="h-4 w-4" />
                    Restrições & Características
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {restrictionTerms.map((term) => (
                      <label
                        key={term.id}
                        htmlFor={`restriction-${term.id}`}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          id={`restriction-${term.id}`}
                          checked={restrictionTagIds.includes(term.id)}
                          onCheckedChange={() => toggleRestriction(term.id)}
                        />
                        <span>{term.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
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

            <TabsContent value="fiscal" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Informações Fiscais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ncm">NCM</Label>
                      <Input
                        id="ncm"
                        value={formData.ncm}
                        onChange={(e) => setFormData({ ...formData, ncm: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                        placeholder="00000000"
                        maxLength={8}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">Nomenclatura Comum do Mercosul (8 dígitos)</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cfop">CFOP</Label>
                      <Input
                        id="cfop"
                        value={formData.cfop}
                        onChange={(e) => setFormData({ ...formData, cfop: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        placeholder="1102"
                        maxLength={4}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">Código Fiscal de Operações e Prestações</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cst">CST</Label>
                      <Input
                        id="cst"
                        value={formData.cst}
                        onChange={(e) => setFormData({ ...formData, cst: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                        placeholder="000"
                        maxLength={3}
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">Código de Situação Tributária</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Origem da Mercadoria</Label>
                    <Select
                      value={formData.origem}
                      onValueChange={(v) => setFormData({ ...formData, origem: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 — Nacional</SelectItem>
                        <SelectItem value="1">1 — Estrangeira (importação direta)</SelectItem>
                        <SelectItem value="2">2 — Estrangeira (adquirida no mercado interno)</SelectItem>
                        <SelectItem value="3">3 — Nacional com mais de 40% de conteúdo importado</SelectItem>
                        <SelectItem value="4">4 — Nacional produção conforme processos básicos</SelectItem>
                        <SelectItem value="5">5 — Nacional com até 40% de conteúdo importado</SelectItem>
                        <SelectItem value="6">6 — Estrangeira (importação direta) sem similar nacional</SelectItem>
                        <SelectItem value="7">7 — Estrangeira (mercado interno) sem similar nacional</SelectItem>
                        <SelectItem value="8">8 — Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Precificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {pricingLoading ? (
                    <p className="text-sm text-muted-foreground">Calculando...</p>
                  ) : (
                    <>
                      {/* Custo direto + preço sugerido */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Custo direto</p>
                          <p className="text-lg font-semibold">{formatCurrency(directCost)}</p>
                        </div>
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <p className="text-xs text-muted-foreground">Preço sugerido (ao vivo)</p>
                          <p className="text-lg font-semibold text-primary">{formatCurrency(previewSuggested)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Custo total: {formatCurrency(totalCost)}
                          </p>
                        </div>
                      </div>

                      {/* Margem alvo */}
                      <div className="space-y-2">
                        <Label className="flex items-center">
                          Margem alvo (%)
                          <HelpTooltip content="Margem desejada sobre o preço de venda. Deixe vazio para herdar da categoria ou do parâmetro global." />
                        </Label>
                        <NumericInput
                          step="0.1"
                          value={formData.targetMarginPct}
                          onChange={(e) => setFormData({ ...formData, targetMarginPct: e.target.value })}
                          placeholder={
                            marginSource
                              ? `Herda: ${(inheritedMargin * 100).toFixed(1)}% (${marginSourceLabel(marginSource)})`
                              : 'Ex: 40'
                          }
                        />
                        {usingInheritedMargin && marginSource && (
                          <p className="text-xs text-muted-foreground">
                            Usando margem herdada de <strong>{marginSourceLabel(marginSource)}</strong>: {(inheritedMargin * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>

                      {/* Overhead */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center">
                            Overhead (%)
                            <HelpTooltip content="Custos indiretos como percentual do custo direto. Vazio = herda." />
                          </Label>
                          <NumericInput
                            step="0.1"
                            value={formData.overheadPct}
                            onChange={(e) => setFormData({ ...formData, overheadPct: e.target.value })}
                            placeholder={inheritedOhPct ? `Herda: ${(inheritedOhPct * 100).toFixed(1)}%` : 'Ex: 10'}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center">
                            Overhead (R$/un)
                            <HelpTooltip content="Custo indireto fixo por unidade, em reais. Vazio = herda." />
                          </Label>
                          <NumericInput
                            step="0.01"
                            value={formData.overheadValue}
                            onChange={(e) => setFormData({ ...formData, overheadValue: e.target.value })}
                            placeholder={inheritedOhVal ? `Herda: ${formatCurrency(inheritedOhVal)}` : 'Ex: 0,50'}
                          />
                        </div>
                      </div>

                      {/* Preço praticado + margem realizada */}
                      <div className="space-y-2">
                        <Label className="flex items-center">
                          Preço praticado (R$)
                          <HelpTooltip content="Preço de venda efetivamente cobrado. Usado para calcular a margem realizada." />
                        </Label>
                        <NumericInput
                          step="0.01"
                          value={formData.practicedPrice}
                          onChange={(e) => setFormData({ ...formData, practicedPrice: e.target.value })}
                          placeholder="Ex: 12,90"
                        />
                        {realizedMargin != null && (
                          <p className="text-sm">
                            Margem realizada:{' '}
                            <strong
                              className={
                                realizedMargin < 0
                                  ? 'text-red-600'
                                  : realizedMargin >= effMargin
                                  ? 'text-green-600'
                                  : 'text-amber-600'
                              }
                            >
                              {(realizedMargin * 100).toFixed(1)}%
                            </strong>
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {isProducedMaterial && (
              <TabsContent value="bom" className="mt-0">
                {/* Apenas o resumo aqui — o formulário de edição é renderizado fora das tabs */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5" />
                      Ficha Técnica
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bomLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : bomData ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          {bomData.cost_status === 'complete' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                          )}
                          <span className="text-sm font-medium">
                            {bomData.cost_status === 'complete'
                              ? 'Custos completos'
                              : bomData.cost_status === 'partial'
                              ? 'Custos parciais'
                              : 'Custos pendentes'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-xs text-muted-foreground">Rendimento</p>
                            <p className="font-semibold">{bomData.yield_quantity} {bomData.yield_unit}</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-xs text-muted-foreground">CMV Unitário</p>
                            <p className="font-semibold text-green-700">
                              {bomData.cached_unit_cost != null
                                ? `R$ ${Number(bomData.cached_unit_cost).toFixed(4)}`
                                : '—'}
                            </p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg text-center">
                            <p className="text-xs text-muted-foreground">Componentes</p>
                            <p className="font-semibold">{bomData.recipe_bom_items?.length ?? 0}</p>
                          </div>
                        </div>
                        <Button onClick={() => setEditingBOM(true)} variant="outline" className="w-full">
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar Ficha Técnica
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-10 space-y-4">
                        <ChefHat className="h-12 w-12 text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground">Este material ainda não tem ficha técnica cadastrada.</p>
                        <Button onClick={() => setEditingBOM(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Ficha Técnica
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </div>
        </Tabs>
        )} {/* fecha o bloco condicional editingBOM ? ... : (Tabs) */}
      </div>

      {/* Sticky Footer — hidden when editing BOM (form has its own buttons) */}
      {!editingBOM && (
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
      )}
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