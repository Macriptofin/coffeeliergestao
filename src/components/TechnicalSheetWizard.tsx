import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// RadioGroup removed - using Select for type selection now
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Calculator, AlertTriangle, Save, Package, RefreshCw, Info } from 'lucide-react';
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
  temp_id?: string; // ID temporário para controle de renderização
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
  typeTermId?: string; // New: ID from material_type taxonomy
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
  const [itemWeights, setItemWeights] = useState<number[]>([]);
  const [itemCosts, setItemCosts] = useState<number[]>([]);

  const [formData, setFormData] = useState<TechnicalSheet>({
    name: '',
    product_type: 'finished_product',
    typeTermId: '', // New: ID from material_type taxonomy
    category: '',
    subcategory: '',
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

  // Recalcular custos sempre que a ficha é carregada
  useEffect(() => {
    if (formData.items.length > 0 && technicalSheetId) {
      calculateCosts();
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
            temp_id: item.id || `loaded_${Date.now()}_${index}`, // Usar id existente ou criar temp_id
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
            temp_id: item.id || `loaded_${Date.now()}_${index}`, // Usar id existente ou criar temp_id
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

  const calculateCosts = async (forceRecalculate = false) => {
    if (formData.items.length === 0) return;

    setCalculating(true);
    try {
      let totalCost = 0;
      let totalWeight = 0;
      const alerts: string[] = [];

      // Cache preços por material - limpar cache quando forçar recálculo
      const priceCache = new Map<string, number>();

      // Informar usuário sobre recálculo manual
      if (forceRecalculate) {
        toast.info('Recalculando custos com preços atualizados...');
      }
      const weights: number[] = new Array(formData.items.length).fill(0);
      const costs: number[] = new Array(formData.items.length).fill(0);

      for (let i = 0; i < formData.items.length; i++) {
        const item = formData.items[i];
        
        // Se não tem material no item mas tem material_id, buscar dos materiais carregados
        let materialData = item.material;
        if (!materialData && item.material_id) {
          materialData = materials.find(m => m.id === item.material_id);
          console.log(`Item ${i}: material_id=${item.material_id}, found in materials array:`, !!materialData);
        }
        
        if (!materialData) {
          console.log(`Item ${i}: pulado - sem dados do material`);
          continue;
        }

        console.log(`Item ${i} (${materialData.name}):`, {
          material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          conversion_factor: materialData.conversion_factor,
          price_per_purchase_unit: materialData.price_per_purchase_unit
        });

        // Obter custo unitário (com cache)
        let itemUnitCost = 0;
        const cached = priceCache.get(item.material_id);
        if (cached !== undefined) {
          itemUnitCost = cached;
        } else {
          // Buscar preço do estoque
          const { data: stockData } = await supabase
            .from('stock_items')
            .select('average_price')
            .eq('material_id', item.material_id)
            .single();

          // average_price no estoque JÁ ESTÁ na unidade de USO (usage_unit)
          // Não precisa converter novamente!
          if (stockData?.average_price && stockData.average_price > 0) {
            itemUnitCost = stockData.average_price;
            priceCache.set(item.material_id, itemUnitCost);
            console.log(`  Custo do estoque: R$ ${stockData.average_price}/${materialData.usage_unit}`);
          } else if (materialData.price_per_purchase_unit > 0) {
            // Fallback: preço cadastrado está na unidade de COMPRA, converter para USO
            const factor = materialData.conversion_factor || 1;
            itemUnitCost = materialData.price_per_purchase_unit / factor;
            priceCache.set(item.material_id, itemUnitCost);
            console.log(`  Custo do cadastro: R$ ${materialData.price_per_purchase_unit}/${materialData.purchase_unit} ÷ ${factor} = R$ ${itemUnitCost}/${materialData.usage_unit}`);
          } else {
            console.log(`  SEM CUSTO DISPONÍVEL para ${materialData.name}`);
            alerts.push(`${materialData.name}: sem custo disponível`);
          }
        }

        // Calcular peso do item
        let itemWeight = 0;
        
        // Prioridade: usar unidade do item (não unit_weight para evitar erros)
        if (item.unit === 'kg') {
          itemWeight = item.quantity * 1000; // kg para gramas
        } else if (item.unit === 'g') {
          itemWeight = item.quantity;
        } else if (materialData.usage_unit === 'kg') {
          itemWeight = item.quantity * 1000;
        } else if (materialData.usage_unit === 'g') {
          itemWeight = item.quantity;
        } else if (materialData.unit_weight && materialData.unit_weight > 0) {
          // Fallback: usar unit_weight apenas para unidades não-peso (unidade, pacote, etc)
          itemWeight = item.quantity * materialData.unit_weight;
        }

        // Aplicar perda
        const wasteMultiplier = 1 + ((item.waste_percent || 0) / 100);
        itemWeight = itemWeight * wasteMultiplier;
        weights[i] = itemWeight;

        // Custo total do item considerando perda
        const itemTotalCost = (item.quantity * itemUnitCost) * wasteMultiplier;
        costs[i] = itemTotalCost;
        totalCost += itemTotalCost;
        totalWeight += itemWeight;
        
        console.log(`  Resultado: ${item.quantity} x R$ ${itemUnitCost} x ${wasteMultiplier} = R$ ${itemTotalCost.toFixed(2)}`);
      }

      // Atualiza pesos e custos dos itens sem tocar na lista de itens (evita re-render pesado)
      setItemWeights(weights);
      setItemCosts(costs);

      // Calcular custos/pesos unitários
      const unitCost = formData.yield_quantity > 0 ? totalCost / formData.yield_quantity : 0;
      const unitWeight = formData.yield_quantity > 0 ? totalWeight / formData.yield_quantity : 0;

      setCostEstimate({
        totalCost,
        unitCost,
        totalWeight,
        unitWeight,
        alerts
      });

      // Informar sucesso no recálculo manual
      if (forceRecalculate) {
        toast.success('Custos atualizados com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao calcular custos:', error);
      toast.error('Erro ao calcular custos');
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    if (formData.items.length > 0) {
      const t = setTimeout(() => {
        calculateCosts();
      }, 250);
      return () => clearTimeout(t);
    } else {
      // Lista vazia: zerar estimativas e arrays para evitar valores "fantasma"
      setItemWeights([]);
      setItemCosts([]);
      setCostEstimate({
        totalCost: 0,
        unitCost: 0,
        totalWeight: 0,
        unitWeight: 0,
        alerts: []
      });
    }
  }, [formData.items, formData.yield_quantity]);

  const addBOMItem = useCallback(() => {
    const newItem: BOMItem = {
      temp_id: `temp_${Date.now()}_${Math.random()}`, // ID único temporário
      material_id: '',
      quantity: 1,
      unit: '',
      position: 1
    };
    
    if (formData.product_type !== 'composite_product') {
      newItem.is_packaging = false;
      newItem.waste_percent = 0;
    }

    setFormData(prev => ({
      ...prev,
      items: [newItem, ...prev.items.map(item => ({ ...item, position: item.position + 1 }))]
    }));
  }, [formData.product_type]);

  const updateBOMItem = useCallback((index: number, field: keyof BOMItem, value: any) => {
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
  }, [materials, formData.product_type]);

  const removeBOMItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  }, []);

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('Nome da ficha técnica é obrigatório');
      return false;
    }

    if (!formData.typeTermId) {
      toast.error('Tipo de Material é obrigatório');
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
    const saveToast = toast.loading('Salvando ficha técnica...');
    
    try {
      let resultMaterialId = formData.result_material_id;

      // Create or update result material if needed
      if (!resultMaterialId) {
        // Get category and subcategory term IDs for proper taxonomy reference
        const categoryTerm = taxonomyTerms.find(term => 
          term.taxonomy_definitions?.key === 'material_category' && 
          term.name === formData.category
        );
        
        const subcategoryTerm = formData.subcategory ? taxonomyTerms.find(term =>
          term.taxonomy_definitions?.key === 'material_subcategory' &&
          term.name === formData.subcategory
        ) : null;

        // Mapeamento dos tipos de material
        const materialTypeMapping: Record<string, string> = {
          'finished_product': 'finished_product',
          'intermediate_product': 'intermediate_product',
          'composite_product': 'composite_product'
        };

        const materialData = {
          name: formData.name,
          category: formData.category, // Use user-selected category
          subcategory: formData.subcategory,
          category_term_id: categoryTerm?.id,
          subcategory_term_id: subcategoryTerm?.id,
          type_term_id: formData.typeTermId, // Store the type term reference
          material_type: materialTypeMapping[formData.product_type] || 'finished_product',
          purchase_unit: formData.yield_unit,
          usage_unit: formData.yield_unit,
          conversion_factor: 1,
          price_per_purchase_unit: costEstimate.unitCost || 0,
          unit_weight: costEstimate.unitWeight || null,
          is_sellable: formData.product_type === 'finished_product',
          is_system_generated: true
        };

        console.log('Creating material with data:', materialData);
        console.log('Product type from form:', formData.product_type);
        console.log('Mapped material type:', materialTypeMapping[formData.product_type]);

        const { data: newMaterial, error: materialError } = await supabase
          .from('materials')
          .insert(materialData)
          .select()
          .single();

        if (materialError) {
          console.error('Material creation error:', materialError);
          console.error('Failed material data:', materialData);
          throw materialError;
        }
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

      toast.dismiss(saveToast);
      toast.success('Ficha técnica salva com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar ficha técnica:', error);
      toast.dismiss(saveToast);
      
      // Capturar e exibir erros específicos do banco de dados
      const errorMessage = error?.message || '';
      
      if (errorMessage.includes('Ciclo de BOM detectado')) {
        toast.error('Ciclo de BOM detectado', {
          description: 'O material de saída não pode ser seu próprio componente através da cadeia de BOMs.',
          duration: 6000
        });
      } else if (errorMessage.includes('unidade incompatível') || errorMessage.includes('Unidade incompatível')) {
        toast.error('Unidade incompatível', {
          description: errorMessage,
          duration: 6000
        });
      } else if (errorMessage.includes('duplicate key')) {
        toast.error('Material duplicado', {
          description: 'Já existe um material com este nome.',
          duration: 5000
        });
      } else {
        toast.error('Erro ao salvar ficha técnica', {
          description: errorMessage.length > 100 ? 'Verifique os dados e tente novamente.' : errorMessage,
          duration: 5000
        });
      }
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

  // Get material types from taxonomy for the 3-level hierarchy
  const materialTypesFromTaxonomy = taxonomyTerms
    .filter(term => term.taxonomy_definitions?.key === 'material_type' && term.is_active !== false)
    .map(term => ({
      id: term.id,
      name: term.name,
      code: term.code
    }));

  // Get categories filtered by selected type term (categories have parent_id pointing to type)
  const availableCategoriesForType = formData.typeTermId 
    ? taxonomyTerms
        .filter(term => 
          term.taxonomy_definitions?.key === 'material_category' && 
          term.parent_id === formData.typeTermId &&
          term.is_active !== false
        )
        .map(term => ({
          value: term.name,
          label: term.name,
          id: term.id
        }))
    : [];

  // Get subcategories filtered by selected category
  const selectedCategoryTerm = taxonomyTerms.find(term => 
    term.taxonomy_definitions?.key === 'material_category' && 
    term.name === formData.category
  );
  
  const availableSubcategoriesForCategory = selectedCategoryTerm
    ? taxonomyTerms
        .filter(term => 
          term.taxonomy_definitions?.key === 'material_subcategory' && 
          term.parent_id === selectedCategoryTerm.id &&
          term.is_active !== false
        )
        .map(term => ({
          value: term.name,
          label: term.name
        }))
    : [];

  // Map type term to product_type and legacy category
  const getProductTypeFromTypeTerm = (typeTermId: string): 'finished_product' | 'intermediate_product' | 'composite_product' => {
    const typeTerm = materialTypesFromTaxonomy.find(t => t.id === typeTermId);
    if (!typeTerm) return 'finished_product';
    
    const nameToType: Record<string, 'finished_product' | 'intermediate_product' | 'composite_product'> = {
      'Produto Acabado': 'finished_product',
      'Produto Intermediário': 'intermediate_product',
      'Produto Composto': 'composite_product'
    };
    return nameToType[typeTerm.name] || 'finished_product';
  };

  // Handle type term change - cascading reset
  const handleTypeTermChange = (typeTermId: string) => {
    const newProductType = getProductTypeFromTypeTerm(typeTermId);
    setFormData(prev => ({
      ...prev,
      typeTermId,
      product_type: newProductType,
      category: '', // Reset category
      subcategory: '', // Reset subcategory
      items: [] // Clear items when switching product types
    }));
  };

  // Handle category change - reset subcategory
  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category,
      subcategory: '' // Reset subcategory
    }));
  };

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

              {/* Tipo de Material - Primeiro nível da hierarquia (3 níveis) */}
              <div>
                <Label>Tipo de Material *</Label>
                <Select
                  value={formData.typeTermId || ''}
                  onValueChange={handleTypeTermChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materialTypesFromTaxonomy.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione o tipo principal (Produto Acabado, Intermediário ou Composto)
                </p>
              </div>

              {/* Categoria - Segundo nível da hierarquia */}
              <div>
                <Label>Categoria *</Label>
                <Select
                  value={formData.category || ''}
                  onValueChange={handleCategoryChange}
                  disabled={!formData.typeTermId || availableCategoriesForType.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !formData.typeTermId 
                        ? "Selecione um tipo primeiro" 
                        : availableCategoriesForType.length === 0 
                          ? "Nenhuma categoria disponível" 
                          : "Selecione a categoria"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategoriesForType.map(option => (
                      <SelectItem key={option.id} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategoria - Terceiro nível da hierarquia */}
              <div>
                <Label>Subcategoria (Opcional)</Label>
                <Select
                  value={formData.subcategory || ''}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, subcategory: value }))}
                  disabled={!formData.category || availableSubcategoriesForCategory.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !formData.category 
                        ? "Selecione uma categoria primeiro" 
                        : availableSubcategoriesForCategory.length === 0 
                          ? "Nenhuma subcategoria disponível" 
                          : "Selecione a subcategoria"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubcategoriesForCategory.map(option => (
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
                    <Select 
                      value={formData.yield_unit} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, yield_unit: value }))}
                    >
                      <SelectTrigger id="yield_unit">
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unidade">unidade</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="mL">mL</SelectItem>
                        <SelectItem value="porção">porção</SelectItem>
                        <SelectItem value="fatia">fatia</SelectItem>
                        <SelectItem value="pacote">pacote</SelectItem>
                        <SelectItem value="caixa">caixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="waste_percent">Perda/Desperdício Geral (%)</Label>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Percentual de perda/desperdício aplicado ao total da receita (além das perdas individuais dos itens)
                  </p>
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
                  <Card key={item.temp_id || item.id || `item-${index}`} className="p-4">
                    <div className="space-y-3">
                      {/* Primeira linha: Material */}
                      <div>
                        <Label>Material *</Label>
                        <Combobox
                          options={materialOptions}
                          value={item.material_id}
                          onSelect={(value) => updateBOMItem(index, 'material_id', value)}
                          placeholder="Buscar material..."
                        />
                      </div>

                      {/* Segunda linha: Quantidade, Unidade, Peso, Custo, Perda%, Observações e Ações */}
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-2">
                          <Label className="text-xs">Quantidade *</Label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateBOMItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-8"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs">Unidade</Label>
                          <Input
                            value={item.unit}
                            onChange={(e) => updateBOMItem(index, 'unit', e.target.value)}
                            placeholder="un"
                            className="h-8"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs">Peso (g)</Label>
                          <Input
                            value={(itemWeights[index] ?? 0).toFixed(1)}
                            readOnly
                            className="bg-muted h-8 text-xs"
                          />
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs">Custo Total</Label>
                          <Input
                            value={`R$ ${(itemCosts[index] ?? 0).toFixed(2)}`}
                            readOnly
                            className="bg-muted h-8 text-xs font-medium"
                          />
                        </div>

                        {formData.product_type !== 'composite_product' && (
                          <div className="col-span-1">
                            <Label className="text-xs">Perda %</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.waste_percent || ''}
                              onChange={(e) => updateBOMItem(index, 'waste_percent', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="h-8"
                            />
                          </div>
                        )}

                        <div className={formData.product_type === 'composite_product' ? "col-span-2" : "col-span-2"}>
                          <Label className="text-xs">Observações</Label>
                          <Input
                            value={item.notes || ''}
                            onChange={(e) => updateBOMItem(index, 'notes', e.target.value)}
                            placeholder="Opcional"
                            className="h-8"
                          />
                        </div>

                        <div className="col-span-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeBOMItem(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
              <div className="flex items-center gap-2">
                {calculating && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => calculateCosts(true)}
                  disabled={calculating || formData.items.length === 0}
                  title="Recalcular custos com preços atualizados"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Recalcular
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md mb-4 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Custos calculados com hierarquia: BOM → Estoque → Última Compra → Cadastro
              </p>
            </div>

            {/* Destaque dos custos principais em duas colunas */}
            {formData.product_type !== 'composite_product' ? (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-xs text-orange-700 dark:text-orange-300 mb-1">Custo Total da BOM:</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    R$ {costEstimate.totalCost.toFixed(2)}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Soma de todos os ingredientes
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-xs text-green-700 dark:text-green-300 mb-1">Custo por Unidade:</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    R$ {costEstimate.unitCost.toFixed(4)}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Por {formData.yield_unit} (total: {formData.yield_quantity})
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800 mb-4">
                <div className="text-xs text-orange-700 dark:text-orange-300 mb-1">Custo Total do Composto:</div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  R$ {costEstimate.totalCost.toFixed(2)}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  Soma de todos os componentes
                </div>
              </div>
            )}

            {/* Informações de peso */}
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-sm text-muted-foreground">Peso Total:</span>
              <span className="font-medium">
                {costEstimate.totalWeight >= 1000 
                  ? `${(costEstimate.totalWeight / 1000).toFixed(2)} kg`
                  : `${costEstimate.totalWeight.toFixed(1)} g`
                }
              </span>
            </div>
            
            {formData.product_type !== 'composite_product' && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Peso Unitário:</span>
                <span className="font-medium">
                  {costEstimate.unitWeight >= 1000 
                    ? `${(costEstimate.unitWeight / 1000).toFixed(2)} kg`
                    : `${costEstimate.unitWeight.toFixed(1)} g`
                  }
                </span>
              </div>
            )}

            {/* Importante: explicação sobre gravação */}
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-blue-800 dark:text-blue-200">Importante:</p>
                  <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-0.5">
                    <li><strong>Custo Unitário:</strong> preço médio por {formData.yield_unit}</li>
                    <li>Será gravado como <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">average_price</code> no estoque</li>
                    <li>Campo <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">cost_source = 'production'</code></li>
                  </ul>
                </div>
              </div>
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