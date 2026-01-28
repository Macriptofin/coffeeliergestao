import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTaxonomy } from '@/hooks/useConfig';

interface Material {
  id: string;
  name: string;
  usage_unit: string;
  material_type: string;
}

interface BOMItem {
  material_id: string;
  quantity: number;
  unit: string;
  is_packaging?: boolean;
}

interface TechnicalSheetFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const TechnicalSheetForm: React.FC<TechnicalSheetFormProps> = ({ onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const { terms, loading: taxonomyLoading, getTermsByTaxonomy } = useTaxonomy();
  
  // Product basic info
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  
  // 3-level hierarchy state
  const [typeTermId, setTypeTermId] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  
  // Legacy product type for database
  const [productType, setProductType] = useState<'finished_product' | 'intermediate_product' | 'composite_product'>('finished_product');
  
  const [purchaseUnit, setPurchaseUnit] = useState('un');
  const [usageUnit, setUsageUnit] = useState('un');
  const [conversionFactor, setConversionFactor] = useState(1);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const [supplier, setSupplier] = useState('');
  
  // BOM specific fields
  const [yieldQuantity, setYieldQuantity] = useState(1);
  const [generalWaste, setGeneralWaste] = useState(0);
  const [notes, setNotes] = useState('');
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);

  // Get taxonomy data for 3-level hierarchy
  const materialTypesFromTaxonomy = getTermsByTaxonomy('material_type').filter(term => term.is_active);
  const allCategories = getTermsByTaxonomy('material_category').filter(term => term.is_active);
  const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(term => term.is_active);
  
  // Filter categories based on selected type
  const availableCategories = typeTermId 
    ? allCategories.filter(cat => cat.parent_id === typeTermId)
    : [];
  
  // Filter subcategories based on selected category
  const selectedCategoryTerm = allCategories.find(cat => cat.name === category);
  const availableSubcategories = selectedCategoryTerm 
    ? allSubcategories.filter(sub => sub.parent_id === selectedCategoryTerm.id)
    : [];

  // Map type term to product type
  const getProductTypeFromTypeTerm = (termId: string): 'finished_product' | 'intermediate_product' | 'composite_product' => {
    const typeTerm = materialTypesFromTaxonomy.find(t => t.id === termId);
    if (!typeTerm) return 'finished_product';
    
    const nameToType: Record<string, 'finished_product' | 'intermediate_product' | 'composite_product'> = {
      'Produto Acabado': 'finished_product',
      'Produto Intermediário': 'intermediate_product',
      'Produto Composto': 'composite_product'
    };
    return nameToType[typeTerm.name] || 'finished_product';
  };

  // Handle type change - cascading reset
  const handleTypeChange = (newTypeTermId: string) => {
    setTypeTermId(newTypeTermId);
    setCategory('');
    setSubcategory('');
    setProductType(getProductTypeFromTypeTerm(newTypeTermId));
  };

  // Handle category change - reset subcategory
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    setSubcategory('');
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, usage_unit, material_type')
        .in('material_type', ['ingredient', 'packaging', 'intermediate_product', 'finished_product'])
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais disponíveis');
    }
  };

  const addBOMItem = () => {
    setBomItems([...bomItems, {
      material_id: '',
      quantity: 0,
      unit: 'g'
    }]);
  };

  const updateBOMItem = (index: number, field: keyof BOMItem, value: any) => {
    const newItems = [...bomItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setBomItems(newItems);
  };

  const removeBOMItem = (index: number) => {
    setBomItems(bomItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productName.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }

    if (!typeTermId) {
      toast.error('Tipo de Material é obrigatório');
      return;
    }

    if (!category) {
      toast.error('Categoria é obrigatória');
      return;
    }

    if (bomItems.length === 0) {
      toast.error('Adicione pelo menos um item à ficha técnica');
      return;
    }

    const invalidItems = bomItems.filter(item => !item.material_id || item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast.error('Todos os itens devem ter material selecionado e quantidade maior que zero');
      return;
    }

    setLoading(true);

    try {
      // Para produtos intermediários/acabados: purchase_unit = usage_unit e conversion_factor = 1
      const isProducedProduct = productType === 'intermediate_product' || productType === 'finished_product';
      const finalPurchaseUnit = isProducedProduct ? usageUnit : purchaseUnit;
      const finalConversionFactor = isProducedProduct ? 1 : conversionFactor;

      // Get category term ID
      const categoryTerm = allCategories.find(cat => cat.name === category);
      const subcategoryTerm = subcategory 
        ? availableSubcategories.find(sub => sub.name === subcategory)
        : null;
      
      // 1. Create the product (material)
      const { data: materialData, error: materialError } = await supabase
        .from('materials')
        .insert({
          name: productName,
          description: productDescription,
          purchase_unit: finalPurchaseUnit,
          usage_unit: usageUnit,
          conversion_factor: finalConversionFactor,
          price_per_purchase_unit: pricePerUnit,
          supplier: supplier || null,
          category: category, // Use selected category
          subcategory: subcategory || null,
          category_term_id: categoryTerm?.id,
          subcategory_term_id: subcategoryTerm?.id,
          type_term_id: typeTermId,
          material_type: productType
        })
        .select()
        .single();

      if (materialError) throw materialError;

      // 2. Create the BOM based on product type
      if (productType === 'finished_product') {
        // Create recipe BOM
        const { data: bomData, error: bomError } = await supabase
          .from('recipes_bom')
          .insert({
            finished_material_id: materialData.id,
            yield_quantity: yieldQuantity,
            yield_unit: usageUnit,
            waste_percent: generalWaste,
            notes: notes
          })
          .select()
          .single();

        if (bomError) throw bomError;

        // Create BOM items
        const bomItemsData = bomItems.map((item, index) => ({
          recipe_id: bomData.id,
          material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          position: index + 1,
          is_packaging: item.is_packaging || false
        }));

        const { error: itemsError } = await supabase
          .from('recipe_bom_items')
          .insert(bomItemsData);

        if (itemsError) throw itemsError;

      } else if (productType === 'composite_product') {
        // Create composite BOM
        const { data: bomData, error: bomError } = await supabase
          .from('composites_bom')
          .insert({
            composite_material_id: materialData.id,
            notes: notes
          })
          .select()
          .single();

        if (bomError) throw bomError;

        // Create BOM items
        const bomItemsData = bomItems.map((item, index) => ({
          composite_id: bomData.id,
          component_material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          position: index + 1
        }));

        const { error: itemsError } = await supabase
          .from('composite_bom_items')
          .insert(bomItemsData);

        if (itemsError) throw itemsError;
      }

      toast.success('Ficha técnica criada com sucesso!');
      onSuccess();

    } catch (error) {
      console.error('Erro ao criar ficha técnica:', error);
      toast.error('Erro ao criar ficha técnica');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Nova Ficha Técnica</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo de Material - Primeiro nível da hierarquia */}
          <div className="space-y-2">
            <Label htmlFor="type-term">Tipo de Material *</Label>
            <Select value={typeTermId} onValueChange={handleTypeChange} disabled={taxonomyLoading}>
              <SelectTrigger>
                <SelectValue placeholder={taxonomyLoading ? "Carregando..." : "Selecione o tipo de material"} />
              </SelectTrigger>
              <SelectContent>
                {materialTypesFromTaxonomy.map(type => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria - Segundo nível */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoria *</Label>
            <Select value={category} onValueChange={handleCategoryChange} disabled={!typeTermId || availableCategories.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!typeTermId ? "Selecione um tipo primeiro" : "Selecione a categoria"} />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria - Terceiro nível */}
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategoria (Opcional)</Label>
            <Select value={subcategory} onValueChange={setSubcategory} disabled={!category || availableSubcategories.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!category ? "Selecione uma categoria primeiro" : "Selecione a subcategoria"} />
              </SelectTrigger>
              <SelectContent>
                {availableSubcategories.map(sub => (
                  <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Basic Product Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Nome do Produto *</Label>
              <Input
                id="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Bolo de Chocolate 500g"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Descrição detalhada do produto"
              rows={3}
            />
          </div>

          {/* Units and Pricing */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-unit">Unidade de Compra</Label>
              <Input
                id="purchase-unit"
                value={purchaseUnit}
                onChange={(e) => setPurchaseUnit(e.target.value)}
                placeholder="kg, un, pacote"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage-unit">Unidade de Uso</Label>
              <Input
                id="usage-unit"
                value={usageUnit}
                onChange={(e) => setUsageUnit(e.target.value)}
                placeholder="g, ml, un"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conversion">Fator Conversão</Label>
              <Input
                id="conversion"
                type="number"
                step="0.01"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço/Unidade</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* BOM Specific Fields */}
          {productType === 'finished_product' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yield">Rendimento</Label>
                <Input
                  id="yield"
                  type="number"
                  step="0.01"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(parseFloat(e.target.value) || 1)}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waste">Desperdício Geral (%)</Label>
                <Input
                  id="waste"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={generalWaste}
                  onChange={(e) => setGeneralWaste(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* BOM Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Ingredientes/Componentes</Label>
              <Button type="button" onClick={addBOMItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </div>

            {bomItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
              </div>
            ) : (
              <div className="space-y-3">
                {bomItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <Select value={item.material_id} onValueChange={(value) => updateBOMItem(index, 'material_id', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o material" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((material) => (
                            <SelectItem key={material.id} value={material.id}>
                              {material.name} ({material.usage_unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="w-24">
                      <Input
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateBOMItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="Qtd"
                      />
                    </div>
                    
                    <div className="w-20">
                      <Input
                        value={item.unit}
                        onChange={(e) => updateBOMItem(index, 'unit', e.target.value)}
                        placeholder="Un"
                      />
                    </div>

                    {productType === 'finished_product' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={item.is_packaging || false}
                          onChange={(e) => updateBOMItem(index, 'is_packaging', e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Embalagem</span>
                      </div>
                    )}
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBOMItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a ficha técnica, preparo, etc."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Ficha Técnica'}
        </Button>
      </div>
    </form>
  );
};

export default TechnicalSheetForm;