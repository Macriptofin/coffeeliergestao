import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Search, Grid3X3, List, SortAsc } from "lucide-react";
import { MaterialForm } from "@/components/MaterialForm";
import { MaterialsList } from "@/components/MaterialsList";
import { MaterialsTable } from "@/components/MaterialsTable";
import { MaterialsActions } from "@/components/MaterialsActions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface Material {
  id: string;
  name: string;
  description?: string;
  purchaseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  pricePerPurchaseUnit: number;
  supplier?: string;
  allowedBrands?: string[];
  category: 'Insumo' | 'Embalagem' | 'Produto Acabado' | 'Produto Composto';
  code: string;
  materialType: 'ingredient' | 'packaging' | 'finished_product' | 'composite_product';
  unitWeight?: number;
}

const Materials = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const categories = [
    { value: "all", label: "Todas as Categorias", color: "default" },
    { value: "Insumo", label: "Insumos", color: "blue" },
    { value: "Embalagem", label: "Embalagens", color: "green" },
    { value: "Produto Acabado", label: "Produtos Acabados", color: "purple" },
    { value: "Produto Composto", label: "Produtos Compostos", color: "orange" }
  ];

  const suppliers = [...new Set(materials.map(m => m.supplier).filter(Boolean))].sort();

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    filterMaterials();
  }, [materials, selectedCategory, searchTerm, supplierFilter]);

  const filterMaterials = () => {
    let filtered = materials;
    
    // Filtrar por categoria
    if (selectedCategory !== "all") {
      filtered = filtered.filter(material => material.category === selectedCategory);
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

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('code');
      
      if (error) throw error;
      
      const formattedMaterials = data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || undefined,
        purchaseUnit: item.purchase_unit,
        usageUnit: item.usage_unit,
        conversionFactor: parseFloat(item.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit.toString()),
        supplier: item.supplier || undefined,
        allowedBrands: item.allowed_brands || undefined,
        category: item.category as Material['category'],
        code: item.code,
        materialType: item.material_type as Material['materialType'],
        unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined
      }));
      
      setMaterials(formattedMaterials);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const addMaterial = async (material: Omit<Material, 'id' | 'code'>) => {
    try {
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
          material_type: material.materialType,
          unit_weight: material.unitWeight
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newMaterial: Material = {
        id: data.id,
        name: data.name,
        description: data.description || undefined,
        purchaseUnit: data.purchase_unit,
        usageUnit: data.usage_unit,
        conversionFactor: parseFloat(data.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(data.price_per_purchase_unit.toString()),
        supplier: data.supplier || undefined,
        allowedBrands: data.allowed_brands || undefined,
        category: data.category as Material['category'],
        code: data.code,
        materialType: data.material_type as Material['materialType'],
        unitWeight: data.unit_weight ? parseFloat(data.unit_weight.toString()) : undefined
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
          material_type: updatedMaterial.materialType,
          unit_weight: updatedMaterial.unitWeight
        })
        .eq('id', updatedMaterial.id);
      
      if (error) throw error;
      
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const selectedCategoryData = categories.find(cat => cat.value === selectedCategory);

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
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 h-10 flex items-center">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value} className="min-h-[40px]">
                  <div className="flex items-center gap-2 py-2">
                    <Badge variant={category.color as any} className="text-xs">
                      {category.label}
                    </Badge>
                    {category.value === "all" && `(${materials.length})`}
                    {category.value !== "all" && `(${materials.filter(m => m.category === category.value).length})`}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          {(selectedCategory !== "all" || supplierFilter !== "all") && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSelectedCategory("all");
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
        <MaterialsList 
          materials={filteredMaterials} 
          onEdit={startEditingMaterial}
          onDelete={deleteMaterial}
        />
      ) : (
        <MaterialsTable 
          materials={filteredMaterials} 
          onEdit={startEditingMaterial}
          onDelete={deleteMaterial}
          selectedMaterials={selectedMaterials}
          onSelectMaterial={handleSelectMaterial}
          onSelectAll={handleSelectAll}
        />
      )}
    </div>
  );
};

export default Materials;