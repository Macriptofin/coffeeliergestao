import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Search, Grid3X3, List, SortAsc, Download, Package } from "lucide-react";
import { MaterialForm } from "@/components/MaterialForm";
import { MaterialsList } from "@/components/MaterialsList";
import { SafeMaterialsTable } from "@/components/SafeMaterialsTable";
import { SafeMaterialForm } from "@/components/SafeMaterialForm";
import { MaterialsActions } from "@/components/MaterialsActions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Material } from "@/types";
import { materialCategories, getSubcategoriesByCategory } from "@/lib/material-categories";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Materials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  // Get categories with counts
  const categoriesWithCounts = [
    { value: "all", label: "Todas as Categorias", color: "default", count: materials.length },
    ...materialCategories.map(cat => ({
      value: cat.value,
      label: cat.label,
      color: cat.color,
      count: materials.filter(m => m.category === cat.value).length
    }))
  ];

  // Get subcategories for selected category
  const availableSubcategories = selectedCategory !== "all" 
    ? getSubcategoriesByCategory(selectedCategory)
    : [];

  const subcategoriesWithCounts = [
    { value: "all", label: "Todas as Subcategorias", count: materials.filter(m => m.category === selectedCategory).length },
    ...availableSubcategories.map(sub => ({
      value: sub.value,
      label: sub.label,
      count: materials.filter(m => m.category === selectedCategory && m.subcategory === sub.value).length
    }))
  ];

  const suppliers = [...new Set(materials.map(m => m.supplier).filter(Boolean))].sort();

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    filterMaterials();
  }, [materials, selectedCategory, selectedSubcategory, searchTerm, supplierFilter]);

  const filterMaterials = () => {
    let filtered = materials;
    
    // Filtrar por categoria
    if (selectedCategory !== "all") {
      filtered = filtered.filter(material => material.category === selectedCategory);
    }
    
    // Filtrar por subcategoria
    if (selectedSubcategory !== "all" && selectedCategory !== "all") {
      filtered = filtered.filter(material => material.subcategory === selectedSubcategory);
    }
    
    // Filtrar por fornecedor
    if (supplierFilter !== "all") {
      filtered = filtered.filter(material => material.supplier === supplierFilter);
    }
    
    // Filtrar por termo de pesquisa
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(material => 
        material.name.toLowerCase().includes(search) ||
        material.code.toLowerCase().includes(search) ||
        material.description?.toLowerCase().includes(search) ||
        material.supplier?.toLowerCase().includes(search) ||
        material.allowedBrands?.some(brand => brand.toLowerCase().includes(search))
      );
    }
    
    setFilteredMaterials(filtered);
  };

  // Reset subcategory when category changes
  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory);
    setSelectedSubcategory("all");
  };

  const loadMaterials = async () => {
    try {
      console.log('🔄 Iniciando carregamento de materiais...');
      
      // Primeiro, testar uma query simples
      const { data: testData, error: testError } = await supabase
        .from('materials')
        .select('id, name')
        .limit(1);
      
      if (testError) {
        console.error('❌ Erro no teste de conexão:', testError);
        throw new Error(`Erro de conexão: ${testError.message}`);
      }
      
      console.log('✅ Teste de conexão OK, carregando dados completos...');
      
      const { data, error } = await supabase
        .from('materials')
        .select(`
          id,
          name,
          description,
          purchase_unit,
          usage_unit,
          conversion_factor,
          price_per_purchase_unit,
          supplier,
          allowed_brands,
          category,
          subcategory,
          code,
          material_type,
          unit_weight,
          is_sellable
        `)
        .order('code');
      
      if (error) {
        console.error('❌ Erro na consulta completa:', error);
        throw error;
      }
      
      console.log('📊 Dados recebidos:', data?.length, 'materiais');
      
      if (!data || data.length === 0) {
        console.log('📭 Nenhum material encontrado');
        setMaterials([]);
        return;
      }
      
      const formattedMaterials = data.map((item, index) => {
        try {
          console.log(`🔧 Processando item ${index + 1}:`, item.name);
          
          const formatted = {
            id: item.id || '',
            name: item.name || 'Material sem nome',
            description: item.description || undefined,
            purchaseUnit: item.purchase_unit || 'unidade',
            usageUnit: item.usage_unit || 'unidade',
            conversionFactor: parseFloat(item.conversion_factor?.toString() || '1'),
            pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit?.toString() || '0'),
            supplier: item.supplier || undefined,
            allowedBrands: item.allowed_brands || undefined,
            category: item.category || 'Insumo',
            subcategory: item.subcategory || undefined,
            code: item.code || `MAT-${Date.now()}-${index}`,
            materialType: (item.material_type || 'ingredient') as Material['materialType'],
            unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined,
            isSellable: Boolean(item.is_sellable)
          };
          
          return formatted;
        } catch (itemError) {
          console.error(`❌ Erro ao processar item ${index + 1}:`, itemError, item);
          // Retorna um material válido mesmo com erro
          return {
            id: item.id || `error-${Date.now()}-${index}`,
            name: item.name || 'Material com erro',
            description: undefined,
            purchaseUnit: 'unidade',
            usageUnit: 'unidade',
            conversionFactor: 1,
            pricePerPurchaseUnit: 0,
            supplier: undefined,
            allowedBrands: undefined,
            category: 'Insumo',
            subcategory: undefined,
            code: `ERR-${Date.now()}-${index}`,
            materialType: 'ingredient' as Material['materialType'],
            unitWeight: undefined,
            isSellable: false
          };
        }
      });
      
      console.log('✅ Materiais formatados com sucesso:', formattedMaterials.length);
      setMaterials(formattedMaterials);
      
    } catch (error) {
      console.error('💥 Erro crítico ao carregar materiais:', error);
      
      // Em caso de erro, definir lista vazia para evitar crash
      setMaterials([]);
      
      if (error instanceof Error) {
        toast.error(`Erro ao carregar materiais: ${error.message}`);
      } else {
        toast.error('Erro desconhecido ao carregar materiais');  
      }
    } finally {
      console.log('🏁 Finalizando carregamento de materiais');
      setLoading(false);
    }
  };

  const addMaterial = async (material: Omit<Material, 'id' | 'code'>) => {
    try {
      console.log('Adicionando material:', material);
      const { data, error } = await supabase
        .from('materials')
        .insert({
          name: material.name,
          description: material.description,
          purchase_unit: material.purchaseUnit,
          usage_unit: material.usageUnit,
          conversion_factor: material.conversionFactor,
          price_per_purchase_unit: material.pricePerPurchaseUnit,
          supplier: material.supplier,
          allowed_brands: material.allowedBrands,
          category: material.category,
          subcategory: material.subcategory,
          material_type: material.materialType,
          unit_weight: material.unitWeight,
          is_sellable: material.isSellable || false
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao inserir material:', error);
        throw error;
      }
      
      const newMaterial: Material = {
        id: data.id,
        name: data.name,
        description: data.description || undefined,
        purchaseUnit: data.purchase_unit,
        usageUnit: data.usage_unit,
        conversionFactor: parseFloat(data.conversion_factor?.toString() || '1'),
        pricePerPurchaseUnit: parseFloat(data.price_per_purchase_unit?.toString() || '0'),
        supplier: data.supplier || undefined,
        allowedBrands: data.allowed_brands || undefined,
        category: data.category || 'Insumo',
        subcategory: data.subcategory || undefined,
        code: data.code || '',
        materialType: (data.material_type || 'ingredient') as Material['materialType'],
        unitWeight: data.unit_weight ? parseFloat(data.unit_weight.toString()) : undefined,
        isSellable: data.is_sellable || false
      };
      
      setMaterials([...materials, newMaterial]);
      setShowMaterialForm(false);
      toast.success('Material cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar material:', error);
      toast.error('Erro ao cadastrar material');
    }
  };

  const updateMaterial = async (updatedMaterial: Material) => {
    try {
      console.log('Atualizando material:', updatedMaterial);
      const { error } = await supabase
        .from('materials')
        .update({
          name: updatedMaterial.name,
          description: updatedMaterial.description,
          purchase_unit: updatedMaterial.purchaseUnit,
          usage_unit: updatedMaterial.usageUnit,
          conversion_factor: updatedMaterial.conversionFactor,
          price_per_purchase_unit: updatedMaterial.pricePerPurchaseUnit,
          supplier: updatedMaterial.supplier,
          allowed_brands: updatedMaterial.allowedBrands,
          category: updatedMaterial.category,
          subcategory: updatedMaterial.subcategory,
          material_type: updatedMaterial.materialType,
          unit_weight: updatedMaterial.unitWeight,
          is_sellable: updatedMaterial.isSellable || false
        })
        .eq('id', updatedMaterial.id);
      
      if (error) {
        console.error('Erro ao atualizar material:', error);
        throw error;
      }
      
      setMaterials(materials.map(mat => 
        mat.id === updatedMaterial.id ? updatedMaterial : mat
      ));
      setEditingMaterial(null);
      setShowMaterialForm(false);
      toast.success('Material atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar material:', error);
      toast.error('Erro ao atualizar material');
    }
  };

  const deleteMaterial = async (materialId: string) => {
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', materialId);
      
      if (error) throw error;
      
      setMaterials(materials.filter(mat => mat.id !== materialId));
      toast.success('Material excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir material:', error);
      toast.error('Erro ao excluir material');
    }
  };

  const handleMaterialSubmit = (materialData: Omit<Material, 'id' | 'code'>) => {
    if (editingMaterial) {
      updateMaterial({ ...materialData, id: editingMaterial.id, code: editingMaterial.code });
    } else {
      addMaterial(materialData);
    }
  };

  const startEditingMaterial = (material: Material) => {
    setEditingMaterial(material);
    setShowMaterialForm(true);
  };

  const cancelMaterialForm = () => {
    setEditingMaterial(null);
    setShowMaterialForm(false);
  };

  const handleSelectMaterial = (materialId: string, selected: boolean) => {
    if (selected) {
      setSelectedMaterials([...selectedMaterials, materialId]);
    } else {
      setSelectedMaterials(selectedMaterials.filter(id => id !== materialId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedMaterials(filteredMaterials.map(m => m.id));
    } else {
      setSelectedMaterials([]);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .in('id', selectedMaterials);
      
      if (error) throw error;
      
      setMaterials(materials.filter(mat => !selectedMaterials.includes(mat.id)));
      setSelectedMaterials([]);
      toast.success(`${selectedMaterials.length} materiais excluídos com sucesso!`);
    } catch (error) {
      console.error('Erro ao excluir materiais:', error);
      toast.error('Erro ao excluir materiais');
    }
  };

  const exportMaterialsToCSV = () => {
    try {
      // Prepare CSV data
      const csvData = [];
      csvData.push([
        'Código',
        'Nome',
        'Descrição',
        'Categoria',
        'Subcategoria',
        'Tipo',
        'Unidade de Compra',
        'Unidade de Uso',
        'Fator de Conversão',
        'Preço por Unidade de Compra',
        'Fornecedor',
        'Marcas Permitidas',
        'Peso Unitário',
        'Vendível'
      ]);
      
      // Add material data
      filteredMaterials.forEach(material => {
        csvData.push([
          material.code || '',
          material.name,
          material.description || '',
          material.category,
          material.subcategory || '',
          material.materialType,
          material.purchaseUnit,
          material.usageUnit,
          material.conversionFactor.toString(),
          material.pricePerPurchaseUnit.toString(),
          material.supplier || '',
          material.allowedBrands?.join('; ') || '',
          material.unitWeight?.toString() || '',
          material.isSellable ? 'Sim' : 'Não'
        ]);
      });
      
      // Convert to CSV string
      const csvContent = csvData.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `materiais_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`CSV com ${filteredMaterials.length} materiais exportado com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar CSV dos materiais');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando materiais...</p>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar estado de erro se não conseguiu carregar materiais
  if (!loading && materials.length === 0 && !showMaterialForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Gestão de Materiais</h1>
            <p className="text-muted-foreground">Cadastre e gerencie todos os materiais da sua confeitaria</p>
          </div>
          <Button 
            onClick={() => setShowMaterialForm(true)}
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Material
          </Button>
        </div>
        
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhum material encontrado</h3>
          <p className="text-muted-foreground mb-4">Clique em "Novo Material" para começar ou recarregue a página</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recarregar Página
          </Button>
        </div>
        
        {/* Formulário de Material */}
        {showMaterialForm && (
          <ErrorBoundary>
            <SafeMaterialForm
              material={editingMaterial}
              existingMaterials={materials}
              onSubmit={handleMaterialSubmit}
              onCancel={cancelMaterialForm}
            />
          </ErrorBoundary>
        )}
      </div>
    );
  }

  const selectedCategoryData = categoriesWithCounts.find(cat => cat.value === selectedCategory);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestão de Materiais</h1>
          <p className="text-muted-foreground">Cadastre e gerencie todos os materiais da sua confeitaria</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportMaterialsToCSV}
            variant="outline"
            disabled={loading || filteredMaterials.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button 
            onClick={() => setShowMaterialForm(true)}
            className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Material
          </Button>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pesquisar por nome, código, descrição, fornecedor ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
      </div>

      {/* Controles de Visualização e Filtros */}
      <div className="mb-6 space-y-4">
        {/* Alternância de Visualização */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as 'cards' | 'table')}>
              <ToggleGroupItem value="table" aria-label="Visualização em lista">
                <List className="h-4 w-4 mr-2" />
                Lista
              </ToggleGroupItem>
              <ToggleGroupItem value="cards" aria-label="Visualização em blocos">
                <Grid3X3 className="h-4 w-4 mr-2" />
                Blocos
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Badge variant="outline" className="ml-2">
              {filteredMaterials.length} de {materials.length} materiais
            </Badge>
          </div>
        </div>

        {/* Filtros Avançados */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtros:</span>
          </div>
          
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-48 h-10 flex items-center">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {categoriesWithCounts.map((category) => (
                <SelectItem key={category.value} value={category.value} className="min-h-[40px]">
                  <div className="flex items-center gap-2 py-2">
                    <Badge variant={category.color as any} className="text-xs">
                      {category.label}
                    </Badge>
                    <span>({category.count})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Subcategory Filter */}
          {availableSubcategories.length > 0 && selectedCategory !== "all" && (
            <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
              <SelectTrigger className="w-48 h-10 flex items-center">
                <SelectValue placeholder="Subcategoria" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {subcategoriesWithCounts.map((subcategory) => (
                  <SelectItem key={subcategory.value} value={subcategory.value} className="min-h-[40px]">
                    <div className="flex items-center gap-2 py-2">
                      <span className="text-sm">{subcategory.label}</span>
                      <span className="text-xs text-muted-foreground">({subcategory.count})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-48 h-10 flex items-center">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all" className="min-h-[40px]">
                <div className="py-2">
                  Todos os Fornecedores ({materials.length})
                </div>
              </SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier} value={supplier} className="min-h-[40px]">
                  <div className="py-2">
                    {supplier} ({materials.filter(m => m.supplier === supplier).length})
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedCategory !== "all" || selectedSubcategory !== "all" || supplierFilter !== "all") && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSelectedCategory("all");
                setSelectedSubcategory("all");
                setSupplierFilter("all");
              }}
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Ações em Massa */}
      {viewMode === 'table' && (
        <div className="mb-4">
          <MaterialsActions 
            selectedCount={selectedMaterials.length}
            onBulkDelete={handleBulkDelete}
            onClearSelection={() => setSelectedMaterials([])}
          />
        </div>
      )}

      {showMaterialForm && (
        <div className="mb-8">
          <MaterialForm 
            material={editingMaterial}
            existingMaterials={materials}
            onSubmit={handleMaterialSubmit}
            onCancel={cancelMaterialForm}
          />
        </div>
      )}

      {viewMode === 'cards' ? (
        <ErrorBoundary>
          <MaterialsList 
            materials={filteredMaterials} 
            onEdit={startEditingMaterial}
            onDelete={deleteMaterial}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <SafeMaterialsTable 
            materials={filteredMaterials} 
            onEdit={startEditingMaterial}
            onDelete={deleteMaterial}
            selectedMaterials={selectedMaterials}
            onSelectMaterial={handleSelectMaterial}
            onSelectAll={handleSelectAll}
          />
        </ErrorBoundary>
      )}

      {/* Formulário de Material */}
      {showMaterialForm && (
        <ErrorBoundary>
          <SafeMaterialForm
            material={editingMaterial}
            existingMaterials={materials}
            onSubmit={handleMaterialSubmit}
            onCancel={cancelMaterialForm}
          />
        </ErrorBoundary>
      )}
      {/* Formulário de Material */}
      {showMaterialForm && (
        <ErrorBoundary>
          <MaterialForm
            material={editingMaterial}
            existingMaterials={materials}
            onSubmit={handleMaterialSubmit}
            onCancel={cancelMaterialForm}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Materials;