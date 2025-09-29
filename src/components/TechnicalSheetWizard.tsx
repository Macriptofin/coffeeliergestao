import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Calculator, AlertTriangle, Save, Package } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

interface Material {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  material_type: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: number;
  price_per_purchase_unit: number;
  unit_weight?: number;
}

interface BOMItem {
  id?: string;
  material_id: string;
  material?: Material;
  quantity: number;
  unit: string;
  waste_percent?: number;
  is_packaging?: boolean;
  position: number;
  notes?: string;
  item_weight?: number; // peso do item individual (quantity * peso unitário)
}

interface TechnicalSheet {
  id?: string;
  name: string;
  result_material_id?: string;
  result_material?: Material;
  product_type: 'finished_product' | 'intermediate_product' | 'composite_product';
  category: string;
  subcategory?: string;
  yield_quantity: number;
  yield_unit: string;
  waste_percent?: number;
  notes?: string;
  items: BOMItem[];
}

interface TechnicalSheetWizardProps {
  technicalSheetId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TechnicalSheetWizard: React.FC<TechnicalSheetWizardProps> = ({
  technicalSheetId,
  onSuccess,
  onCancel
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [taxonomyTerms, setTaxonomyTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [formData, setFormData] = useState<TechnicalSheet>({
    name: '',
    product_type: 'finished_product',
    category: '',
    yield_quantity: 1,
    yield_unit: 'un',
    items: []
  });

  const [costEstimate, setCostEstimate] = useState({
    totalCost: 0,
    unitCost: 0,
    totalWeight: 0,
    unitWeight: 0,
    alerts: [] as string[]
  });

  useEffect(() => {
    loadInitialData();
    if (technicalSheetId) {
      loadTechnicalSheet();
    }
  }, [technicalSheetId]);

  const loadInitialData = async () => {
    try {
      const [materialsRes, taxonomyRes] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase.from('taxonomy_terms').select(`
          id, code, name, parent_id,
          taxonomy_definitions!inner(key)
        `).in('taxonomy_definitions.key', ['material_category', 'material_subcategory'])
      ]);

      if (materialsRes.error) throw materialsRes.error;
      if (taxonomyRes.error) throw taxonomyRes.error;

      setMaterials(materialsRes.data);
      setTaxonomyTerms(taxonomyRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
      toast.error('Erro ao carregar dados');
    }
  };

  const loadTechnicalSheet = async () => {
    if (!technicalSheetId) return;

    try {
      setLoading(true);
      
      // First try to load as recipe BOM
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes_bom')
        .select(`
          *,
          materials!recipes_bom_finished_material_id_fkey(*),
          recipe_bom_items(
            *,
            materials!recipe_bom_items_material_id_fkey(*)
          )
        `)
        .eq('id', technicalSheetId)
        .single();

      if (recipeData && !recipeError) {
        // It's a recipe BOM
        const productType: 'finished_product' | 'intermediate_product' = 
          recipeData.materials?.category === 'Produto Acabado' 
            ? 'finished_product' 
            : 'intermediate_product';

        setFormData({
          id: recipeData.id,
          name: recipeData.materials?.name || '',
          result_material_id: recipeData.finished_material_id,
          result_material: recipeData.materials,
          product_type: productType,
          category: recipeData.materials?.category || '',
          subcategory: recipeData.materials?.subcategory,
          yield_quantity: recipeData.yield_quantity,
          yield_unit: recipeData.yield_unit || 'un',
          waste_percent: recipeData.waste_percent,
          notes: recipeData.notes,
          items: recipeData.recipe_bom_items?.map((item: any, index: number) => ({
            id: item.id,
            material_id: item.material_id,
            material: item.materials,
            quantity: item.quantity,
            unit: item.unit,
            waste_percent: item.waste_percent,
            is_packaging: item.is_packaging,
            position: item.position || index + 1,
            notes: item.notes
          })) || []
        });
        return;
      }

      // Try to load as composite BOM
      const { data: compositeData, error: compositeError } = await supabase
        .from('composites_bom')
        .select(`
          *,
          materials!composites_bom_composite_material_id_fkey(*),
          composite_bom_items(
            *,
            materials!composite_bom_items_component_material_id_fkey(*)
          )
        `)
        .eq('id', technicalSheetId)
        .single();

      if (compositeData && !compositeError) {
        // It's a composite BOM
        setFormData({
          id: compositeData.id,
          name: compositeData.materials?.name || '',
          result_material_id: compositeData.composite_material_id,
          result_material: compositeData.materials,
          product_type: 'composite_product',
          category: compositeData.materials?.category || '',
          subcategory: compositeData.materials?.subcategory,
          yield_quantity: 1,
          yield_unit: 'un',
          notes: compositeData.notes,
          items: compositeData.composite_bom_items?.map((item: any, index: number) => ({
            id: item.id,
            material_id: item.component_material_id,
            material: item.materials,
            quantity: item.quantity,
            unit: item.unit,
            position: item.position || index + 1
          })) || []
        });
      } else {
        throw new Error('Ficha técnica não encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar ficha técnica:', error);
      toast.error('Erro ao carregar ficha técnica');
    } finally {
      setLoading(false);
    }
  };

  const calculateCosts = async () => {
    if (formData.items.length === 0) return;

    setCalculating(true);
    try {
      let totalCost = 0;
      let totalWeight = 0;
      const alerts: string[] = [];

      // Update items with individual weights and calculate totals
      const updatedItems = [...formData.items];

      for (let i = 0; i < formData.items.length; i++) {
        const item = formData.items[i];
        if (!item.material) continue;

        // Get stock data for cost calculation
        const { data: stockData } = await supabase
          .from('stock_items')
          .select('average_price')
          .eq('material_id', item.material_id)
          .single();

        let itemUnitCost = 0;
        
        if (stockData?.average_price) {
          itemUnitCost = stockData.average_price;
        } else if (item.material.price_per_purchase_unit > 0) {
          // Convert from purchase unit to usage unit
          itemUnitCost = item.material.price_per_purchase_unit / 
            (item.material.conversion_factor || 1);
        } else {
          alerts.push(`${item.material.name}: sem custo disponível`);
        }

        // Calculate item weight
        let itemWeight = 0;
        if (item.material.unit_weight && item.material.unit_weight > 0) {
          // Material has unit weight defined (for non-weight units like "un")
          itemWeight = item.quantity * item.material.unit_weight;
        } else if (item.unit === 'kg') {
          itemWeight = item.quantity * 1000; // Convert kg to grams
        } else if (item.unit === 'g') {
          itemWeight = item.quantity;
        } else {
          // For other units, try to infer from usage unit
          if (item.material.usage_unit === 'kg') {
            itemWeight = item.quantity * 1000;
          } else if (item.material.usage_unit === 'g') {
            itemWeight = item.quantity;
          }
        }

        // Apply waste to weight calculation
        const wasteMultiplier = 1 + ((item.waste_percent || 0) / 100);
        itemWeight = itemWeight * wasteMultiplier;
        
        // Update item weight
        updatedItems[i] = { ...updatedItems[i], item_weight: itemWeight };

        // Calculate item total cost considering waste
        const itemTotalCost = (item.quantity * itemUnitCost) * wasteMultiplier;
        totalCost += itemTotalCost;
        totalWeight += itemWeight;
      }

      // Update formData with calculated weights
      setFormData(prev => ({ ...prev, items: updatedItems }));

      // Calculate unit cost and weight based on yield
      const unitCost = formData.yield_quantity > 0 ? totalCost / formData.yield_quantity : 0;
      const unitWeight = formData.yield_quantity > 0 ? totalWeight / formData.yield_quantity : 0;

      setCostEstimate({
        totalCost,
        unitCost,
        totalWeight,
        unitWeight,
        alerts
      });
    } catch (error) {
      console.error('Erro ao calcular custos:', error);
      toast.error('Erro ao calcular custos');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (formData.items.length > 0) {
      calculateCosts();
    }
  }, [formData.items, formData.yield_quantity]);

  const addBOMItem = () => {
    const newItem: BOMItem = {
      material_id: '',
      quantity: 1,
      unit: '',
      position: formData.items.length + 1
    };
    
    if (formData.product_type !== 'composite_product') {
      newItem.is_packaging = false;
      newItem.waste_percent = 0;
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const updateBOMItem = (index: number, field: keyof BOMItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Update material reference and default unit
          if (field === 'material_id') {
            const material = materials.find(m => m.id === value);
            updatedItem.material = material;
            updatedItem.unit = material?.usage_unit || '';
            
            // Automatically set is_packaging based on material type
            if (formData.product_type !== 'composite_product') {
              updatedItem.is_packaging = material?.material_type === 'packaging';
            }
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const removeBOMItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('Nome da ficha técnica é obrigatório');
      return false;
    }

    if (!formData.category) {
      toast.error('Categoria é obrigatória');
      return false;
    }

    if (formData.yield_quantity <= 0) {
      toast.error('Rendimento deve ser maior que zero');
      return false;
    }

    if (formData.items.length === 0) {
      toast.error('Adicione pelo menos um item à BOM');
      return false;
    }

    for (const item of formData.items) {
      if (!item.material_id) {
        toast.error('Todos os itens devem ter um material selecionado');
        return false;
      }
      
      if (item.quantity <= 0) {
        toast.error('Todas as quantidades devem ser maiores que zero');
        return false;
      }

      // Check for self-reference
      if (item.material_id === formData.result_material_id) {
        toast.error('Um material não pode referenciar a si mesmo na BOM');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      let resultMaterialId = formData.result_material_id;

      // Create or update result material if needed
      if (!resultMaterialId) {
        const categoryMapping: Record<string, string> = {
          'finished_product': 'Produto Acabado',
          'intermediate_product': 'Produto Intermediário', 
          'composite_product': 'Produto Composto'
        };

        // Get category and subcategory term IDs for proper taxonomy reference
        const categoryTerm = taxonomyTerms.find(term => 
          term.taxonomy_definitions.key === 'material_category' && 
          term.name === categoryMapping[formData.product_type]
        );
        
        const subcategoryTerm = formData.subcategory ? taxonomyTerms.find(term =>
          term.taxonomy_definitions.key === 'material_subcategory' &&
          term.name === formData.subcategory
        ) : null;

        const { data: newMaterial, error: materialError } = await supabase
          .from('materials')
          .insert({
            name: formData.name,
            category: categoryMapping[formData.product_type],
            subcategory: formData.subcategory,
            category_term_id: categoryTerm?.id,
            subcategory_term_id: subcategoryTerm?.id,
            material_type: formData.product_type,
            purchase_unit: formData.yield_unit,
            usage_unit: formData.yield_unit,
            conversion_factor: 1,
            price_per_purchase_unit: costEstimate.unitCost || 0,
            unit_weight: costEstimate.unitWeight || null,
            is_sellable: formData.product_type === 'finished_product',
            is_system_generated: true
          })
          .select()
          .single();

        if (materialError) throw materialError;
        resultMaterialId = newMaterial.id;
        
        // Create initial stock entry
        await supabase
          .from('stock_items')
          .insert({
            material_id: resultMaterialId,
            current_quantity: 0,
            minimum_quantity: 0,
            average_price: costEstimate.unitCost || 0,
            total_value: 0
          });
      }

      if (formData.product_type === 'composite_product') {
        // Save as composite BOM
        let bomId = formData.id;

        if (!bomId) {
          const { data: bomData, error: bomError } = await supabase
            .from('composites_bom')
            .insert({
              composite_material_id: resultMaterialId,
              notes: formData.notes
            })
            .select()
            .single();

          if (bomError) throw bomError;
          bomId = bomData.id;
        } else {
          await supabase
            .from('composites_bom')
            .update({
              notes: formData.notes
            })
            .eq('id', bomId);

          // Delete existing items
          await supabase
            .from('composite_bom_items')
            .delete()
            .eq('composite_id', bomId);
        }

        // Insert new items
        const itemsToInsert = formData.items.map((item, index) => ({
          composite_id: bomId,
          component_material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          position: index + 1
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('composite_bom_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      } else {
        // Save as recipe BOM
        let bomId = formData.id;

        if (!bomId) {
          const { data: bomData, error: bomError } = await supabase
            .from('recipes_bom')
            .insert({
              finished_material_id: resultMaterialId,
              yield_quantity: formData.yield_quantity,
              yield_unit: formData.yield_unit,
              waste_percent: formData.waste_percent,
              notes: formData.notes
            })
            .select()
            .single();

          if (bomError) throw bomError;
          bomId = bomData.id;
        } else {
          await supabase
            .from('recipes_bom')
            .update({
              yield_quantity: formData.yield_quantity,
              yield_unit: formData.yield_unit,
              waste_percent: formData.waste_percent,
              notes: formData.notes
            })
            .eq('id', bomId);

          // Delete existing items
          await supabase
            .from('recipe_bom_items')
            .delete()
            .eq('recipe_id', bomId);
        }

        // Insert new items
        const itemsToInsert = formData.items.map((item, index) => ({
          recipe_id: bomId,
          material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          waste_percent: item.waste_percent || 0,
          is_packaging: item.is_packaging || false,
          position: index + 1,
          notes: item.notes
        }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from('recipe_bom_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }

      toast.success('Ficha técnica salva com sucesso!');
      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar ficha técnica:', error);
      toast.error('Erro ao salvar ficha técnica');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableMaterials = () => {
    if (formData.product_type === 'composite_product') {
      // For composites, allow all types including finished products
      return materials;
    } else {
      // For finished/intermediate, exclude finished products but allow intermediate
      return materials.filter(m => 
        m.material_type === 'ingredient' ||
        m.material_type === 'packaging' ||
        m.material_type === 'intermediate_product'
      );
    }
  };

  const materialOptions = getAvailableMaterials().map(material => ({
    value: material.id,
    label: `${material.code ? material.code + ' - ' : ''}${material.name}`,
    searchText: `${material.code || ''} ${material.name}`.toLowerCase()
  }));

  const categoryOptions = taxonomyTerms
    .filter(term => term.taxonomy_definitions.key === 'material_category')
    .map(term => ({
      value: term.name,
      label: term.name
    }));

  // Map product type to category automatically
  const getProductTypeCategory = (productType: string) => {
    switch (productType) {
      case 'finished_product':
        return 'Produto Acabado';
      case 'intermediate_product':
        return 'Produto Intermediário';
      case 'composite_product':
        return 'Produto Composto';
      default:
        return 'Produto Acabado';
    }
  };

  // Filter subcategories based on product type
  const getFilteredSubcategories = (productType: string) => {
    const categoryMap: { [key: string]: string[] } = {
      'finished_product': ['FIN_SAL', 'FIN_DOC', 'FIN_BEB', 'FIN_PAO', 'FIN_OUT'],
      'intermediate_product': ['INT_MAS', 'INT_REC', 'INT_CAL', 'INT_BEB'],
      'composite_product': ['COM_KIT', 'COM_MES_CB', 'COM_MES_CQ', 'COM_COMBO']
    };

    const allowedCodes = categoryMap[productType] || [];
    
    return taxonomyTerms
      .filter(term => 
        term.taxonomy_definitions?.key === 'material_subcategory' && 
        allowedCodes.includes(term.code)
      )
      .map(term => ({
        value: term.name,
        label: term.name
      }));
  };

  const subcategoryOptions = getFilteredSubcategories(formData.product_type);

  // Update category automatically when product type changes
  useEffect(() => {
    const newCategory = getProductTypeCategory(formData.product_type);
    if (formData.category !== newCategory) {
      setFormData(prev => ({ 
        ...prev, 
        category: newCategory,
        subcategory: '' // Clear subcategory when category changes
      }));
    }
  }, [formData.product_type]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {formData.id ? 'Editar' : 'Nova'} Ficha Técnica
          </h2>
          <p className="text-muted-foreground">
            Configure a estrutura de materiais e rendimento
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Ficha Técnica
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header Section */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Ficha Técnica *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Bolo de Chocolate Premium"
                />
              </div>

              <div>
                <Label>Tipo do Produto *</Label>
                <RadioGroup
                  value={formData.product_type}
                  onValueChange={(value: any) => setFormData(prev => ({ 
                    ...prev, 
                    product_type: value,
                    // Clear items when switching types due to different rules
                    items: []
                  }))}
                  className="flex gap-6 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="finished_product" id="finished" />
                    <Label htmlFor="finished">Produto Acabado</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="intermediate_product" id="intermediate" />
                    <Label htmlFor="intermediate">Produto Intermediário</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="composite_product" id="composite" />
                    <Label htmlFor="composite">Produto Composto</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Subcategoria</Label>
                <Select
                  value={formData.subcategory || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, subcategory: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategoryOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          </CardContent>
        </Card>

        {/* Yield Section - Only for non-composite products */}
        {formData.product_type !== 'composite_product' && (
          <Card>
            <CardHeader>
              <CardTitle>Rendimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="yield_quantity">Quantidade de Rendimento *</Label>
                    <Input
                      id="yield_quantity"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.yield_quantity}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        yield_quantity: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="yield_unit">Unidade *</Label>
                    <Input
                      id="yield_unit"
                      value={formData.yield_unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, yield_unit: e.target.value }))}
                      placeholder="Ex: un, kg, L"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="waste_percent">Perda Geral (%)</Label>
                  <Input
                    id="waste_percent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.waste_percent || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      waste_percent: parseFloat(e.target.value) || undefined 
                    }))}
                    placeholder="0"
                  />
                </div>
            </CardContent>
          </Card>
        )}

        {/* BOM Items Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Itens da BOM</CardTitle>
              <Button onClick={addBOMItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum item adicionado à BOM</p>
                  <p className="text-sm">Clique em "Adicionar Item" para começar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-13 gap-4 items-end">
                      <div className="col-span-4">
                        <Label>Material *</Label>
                        <Combobox
                          options={materialOptions}
                          value={item.material_id}
                          onSelect={(value) => updateBOMItem(index, 'material_id', value)}
                          placeholder="Buscar material..."
                        />
                      </div>

                      <div className="col-span-2">
                        <Label>Quantidade *</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateBOMItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="col-span-1">
                        <Label>Unidade</Label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateBOMItem(index, 'unit', e.target.value)}
                          placeholder="un"
                        />
                      </div>

                      <div className="col-span-1">
                        <Label>Peso (g)</Label>
                        <Input
                          value={item.item_weight ? item.item_weight.toFixed(1) : '0'}
                          readOnly
                          className="bg-muted"
                        />
                      </div>

                      {formData.product_type !== 'composite_product' && (
                        <div className="col-span-1">
                          <Label>Perda %</Label>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={item.waste_percent || ''}
                            onChange={(e) => updateBOMItem(index, 'waste_percent', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      )}

                      <div className={formData.product_type === 'composite_product' ? "col-span-2" : "col-span-1"}>
                        <Label>Observações</Label>
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateBOMItem(index, 'notes', e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>

                      <div className="col-span-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeBOMItem(index)}
                          className="w-full"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                  ))}
                </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Section */}
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações gerais sobre a ficha técnica..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Cost Panel - moved to bottom */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Estimativa de Custos
              </CardTitle>
              {calculating && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Custo Total:</span>
                <span className="font-medium">
                  R$ {costEstimate.totalCost.toFixed(2)}
                </span>
              </div>
              
              {formData.product_type !== 'composite_product' && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Custo Unitário:</span>
                  <span className="font-medium text-primary">
                    R$ {costEstimate.unitCost.toFixed(2)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Peso Total:</span>
                <span className="font-medium">
                  {costEstimate.totalWeight >= 1000 
                    ? `${(costEstimate.totalWeight / 1000).toFixed(2)} kg`
                    : `${costEstimate.totalWeight.toFixed(1)} g`
                  }
                </span>
              </div>
              
              {formData.product_type !== 'composite_product' && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Peso Unitário:</span>
                  <span className="font-medium text-primary">
                    {costEstimate.unitWeight >= 1000 
                      ? `${(costEstimate.unitWeight / 1000).toFixed(2)} kg`
                      : `${costEstimate.unitWeight.toFixed(1)} g`
                    }
                  </span>
                </div>
              )}
            </div>

            {costEstimate.alerts.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Alertas</span>
                </div>
                {costEstimate.alerts.map((alert, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {alert}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};