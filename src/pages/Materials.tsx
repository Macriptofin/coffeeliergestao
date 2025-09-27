import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Search, Download, Edit } from "lucide-react";
import { MaterialForm } from "@/components/MaterialForm";
import { SimplifiedMaterialsTable } from "@/components/SimplifiedMaterialsTable";
import { MaterialEditor } from "@/components/MaterialEditor";
import { MaterialsActions } from "@/components/MaterialsActions";
import { InstructionalBanner } from "@/components/ui/instructional-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Material } from "@/types";
import { materialCategories, getSubcategoriesByCategory } from "@/lib/material-categories";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useIsMobile } from "@/hooks/use-mobile";

const Materials = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showMaterialEditor, setShowMaterialEditor] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
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
        .order('name');
      
      if (error) {
        console.error('❌ Erro na consulta:', error);
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
      setShowMaterialEditor(false);
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
    if (isMobile) {
      navigate(`/estoque/materiais/${material.id}/editar`);
    } else {
      setShowMaterialEditor(true);
    }
  };

  const cancelMaterialForm = () => {
    setEditingMaterial(null);
    setShowMaterialForm(false);
    setShowMaterialEditor(false);
  };

  const handleEditSelected = () => {
    if (selectedMaterials.length === 1) {
      const material = materials.find(m => m.id === selectedMaterials[0]);
      if (material) {
        startEditingMaterial(material);
      }
    }
  };

  const getNavigationContext = () => {
    if (!editingMaterial) return { prev: false, next: false };
    
    const currentIndex = filteredMaterials.findIndex(m => m.id === editingMaterial.id);
    return {
      prev: currentIndex > 0,
      next: currentIndex < filteredMaterials.length - 1
    };
  };

  const handleNavigateMaterial = (direction: 'prev' | 'next') => {
    if (!editingMaterial) return;

    const currentIndex = filteredMaterials.findIndex(m => m.id === editingMaterial.id);
    let newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < filteredMaterials.length) {
      const newMaterial = filteredMaterials[newIndex];
      setEditingMaterial(newMaterial);
    }
  };

  const handleManualClick = () => {
    // Placeholder para futura documentação
    toast.info("Manual completo em desenvolvimento. Em breve estará disponível!");
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
      <div className="px-6 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando materiais...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gradient-subtle">
        {/* Fixed Header Content */}
        <div className="bg-gradient-subtle border-b sticky top-0 z-30 pt-4">
          <div className="px-6 py-6">
            {/* Page Header */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Gestão de Materiais
              </h1>
            </div>

            {/* Instructional Banner */}
            <InstructionalBanner
              title="Gestão de Materiais"
              description={[
                "Aqui você encontra todos os materiais cadastrados no sistema.",
                "Antes de criar um novo material, utilize os filtros ou a busca para verificar se ele já existe, evitando duplicidades.",
                "Cada material deve estar corretamente classificado em Categoria e Subcategoria.",
                "Para dúvidas, consulte o manual completo."
              ]}
              onManualClick={handleManualClick}
              className="mb-6"
            />

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Button 
                onClick={() => setShowMaterialForm(true)} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                + Novo Material
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleEditSelected}
                disabled={selectedMaterials.length !== 1}
                className="border-primary/30 text-primary hover:bg-primary/5"
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar Material
              </Button>
              
              <Button 
                variant="outline" 
                onClick={exportMaterialsToCSV}
                className="border-border hover:bg-accent"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex flex-1 gap-4 w-full">
                  {/* Search */}
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, código, descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Category Filter */}
                  <div className="min-w-0 w-48">
                    <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesWithCounts.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            <div className="flex items-center gap-2">
                              <span>{category.label}</span>
                              <Badge variant="outline" className="text-xs">
                                {category.count}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subcategory Filter */}
                  {selectedCategory !== "all" && (
                    <div className="min-w-0 w-48">
                      <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Subcategoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {subcategoriesWithCounts.map((subcategory) => (
                            <SelectItem key={subcategory.value} value={subcategory.value}>
                              <div className="flex items-center gap-2">
                                <span>{subcategory.label}</span>
                                <Badge variant="outline" className="text-xs">
                                  {subcategory.count}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Supplier Filter */}
                  <div className="min-w-0 w-48">
                    <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Fornecedores</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier} value={supplier}>
                            {supplier}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <MaterialsActions 
                selectedCount={selectedMaterials.length}
                onBulkDelete={handleBulkDelete}
                onClearSelection={() => setSelectedMaterials([])}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="px-6 py-4">
            <ErrorBoundary>
              <SimplifiedMaterialsTable
                materials={filteredMaterials}
                selectedMaterials={selectedMaterials}
                onSelectMaterial={handleSelectMaterial}
                onSelectAll={handleSelectAll}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Material Form Modal */}
        {showMaterialForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <MaterialForm
                material={editingMaterial}
                existingMaterials={materials}
                onSubmit={handleMaterialSubmit}
                onCancel={cancelMaterialForm}
              />
            </div>
          </div>
        )}

        {/* Material Editor Modal/Page */}
        <MaterialEditor
          material={editingMaterial}
          materials={filteredMaterials}
          isOpen={showMaterialEditor}
          onClose={cancelMaterialForm}
          onSave={updateMaterial}
          onNavigate={handleNavigateMaterial}
          canNavigate={getNavigationContext()}
        />
      </div>
    </ErrorBoundary>
  );
};

export default Materials;