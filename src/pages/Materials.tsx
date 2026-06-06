import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Search, Download, Edit, Settings } from "lucide-react";
import { MaterialForm } from "@/components/MaterialForm";
import { SimplifiedMaterialsTable } from "@/components/SimplifiedMaterialsTable";
import { MaterialEditor } from "@/components/MaterialEditor";
import { MaterialsActions } from "@/components/MaterialsActions";
import { InstructionalBanner } from "@/components/ui/instructional-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Material } from "@/types";
import { useTaxonomy } from "@/hooks/useConfig";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useIsMobile } from "@/hooks/use-mobile";

type GeneratedMaterialsExport = {
  filename: string;
  blob: Blob;
  totalRows: number;
  generatedAt: string;
};

const Materials = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { terms, getTermsByTaxonomy } = useTaxonomy();
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
  const [generatedExport, setGeneratedExport] = useState<GeneratedMaterialsExport | null>(null);

  // Get dynamic categories from taxonomy (all active, parent_id links to type — don't filter it out)
  const materialCategories = getTermsByTaxonomy('material_category').filter(term => term.is_active);
  
  // Get categories with counts
  const categoriesWithCounts = [
    { value: "all", label: "Todas as Categorias", color: "default", count: materials.length },
    ...materialCategories.map(cat => ({
      value: cat.name,
      label: cat.name,
      color: 'default',
      count: materials.filter(m => m.category === cat.name).length
    }))
  ];

  // Get subcategories for selected category
  const selectedCategoryTerm = materialCategories.find(cat => cat.name === selectedCategory);
  const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(term => term.is_active);
  const availableSubcategories = selectedCategoryTerm 
    ? allSubcategories.filter(sub => sub.parent_id === selectedCategoryTerm.id)
    : [];

  const subcategoriesWithCounts = [
    { value: "all", label: "Todas as Subcategorias", count: materials.filter(m => m.category === selectedCategory).length },
    ...availableSubcategories.map(sub => ({
      value: sub.name,
      label: sub.name,
      count: materials.filter(m => m.category === selectedCategory && m.subcategory === sub.name).length
    }))
  ];

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    filterMaterials();
  }, [materials, selectedCategory, selectedSubcategory, searchTerm]);

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

  const triggerCsvDownload = (blob: Blob, filename: string) => {
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    window.setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }

      URL.revokeObjectURL(fileUrl);
    }, 0);
  };

  const openGeneratedCsv = (blob: Blob) => {
    const fileUrl = URL.createObjectURL(blob);
    const openedWindow = window.open(fileUrl, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      toast.error('O navegador bloqueou a nova aba. Use o botão "Baixar arquivo" para salvar o CSV.');
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 2000);
      return;
    }

    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
  };

  const saveGeneratedCsv = async (blob: Blob, filename: string) => {
    const pickerWindow = window as Window & {
      showSaveFilePicker?: (options?: {
        suggestedName?: string;
        types?: Array<{
          description: string;
          accept: Record<string, string[]>;
        }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    };

    if (pickerWindow.showSaveFilePicker) {
      try {
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Arquivo CSV',
              accept: {
                'text/csv': ['.csv'],
              },
            },
          ],
        });

        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();

        toast.success('CSV salvo com sucesso!');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        console.warn('Falha ao salvar com seletor nativo, usando download padrão:', error);
      }
    }

    triggerCsvDownload(blob, filename);
  };

  const clearGeneratedExport = () => {
    setGeneratedExport(null);
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
          allowed_brands,
          category,
          subcategory,
          type_term_id,
          category_term_id,
          subcategory_term_id,
          code,
          material_type,
          unit_weight,
          is_sellable,
          ncm,
          cfop,
          cst,
          origem
        `)
        .eq('is_archived', false)
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
            supplier: undefined,
            allowedBrands: item.allowed_brands || undefined,
            category: item.category || 'Alimentos & Ingredientes',
            subcategory: item.subcategory || undefined,
            typeTermId: item.type_term_id || undefined,
            categoryTermId: item.category_term_id || undefined,
            subcategoryTermId: item.subcategory_term_id || undefined,
            code: item.code || `MAT-${Date.now()}-${index}`,
            materialType: (item.material_type || 'ingredient') as Material['materialType'],
            unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined,
            isSellable: Boolean(item.is_sellable),
            ncm: item.ncm || undefined,
            cfop: item.cfop || undefined,
            cst: item.cst || undefined,
            origem: item.origem != null ? item.origem : undefined,
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
            category: 'Alimentos & Ingredientes',
            subcategory: undefined,
            code: `ERR-${Date.now()}-${index}`,
            materialType: 'ingredient' as Material['materialType'],
            unitWeight: undefined,
            isSellable: false,
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
          allowed_brands: material.allowedBrands,
          category: material.category,
          subcategory: material.subcategory,
          type_term_id: material.typeTermId,
          category_term_id: material.categoryTermId,
          subcategory_term_id: material.subcategoryTermId,
          material_type: material.materialType,
          unit_weight: material.unitWeight,
          is_sellable: material.isSellable || false,
          ncm: material.ncm,
          cfop: material.cfop,
          cst: material.cst,
          origem: material.origem,
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
        allowedBrands: data.allowed_brands || undefined,
        category: data.category || 'Alimentos & Ingredientes',
        subcategory: data.subcategory || undefined,
        typeTermId: data.type_term_id || undefined,
        categoryTermId: data.category_term_id || undefined,
        subcategoryTermId: data.subcategory_term_id || undefined,
        code: data.code || '',
        materialType: (data.material_type || 'ingredient') as Material['materialType'],
        unitWeight: data.unit_weight ? parseFloat(data.unit_weight.toString()) : undefined,
        isSellable: data.is_sellable || false,
        ncm: data.ncm || undefined,
        cfop: data.cfop || undefined,
        cst: data.cst || undefined,
        origem: data.origem != null ? data.origem : undefined,
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
          allowed_brands: updatedMaterial.allowedBrands,
          category: updatedMaterial.category,
          subcategory: updatedMaterial.subcategory,
          type_term_id: updatedMaterial.typeTermId,
          category_term_id: updatedMaterial.categoryTermId,
          subcategory_term_id: updatedMaterial.subcategoryTermId,
          material_type: updatedMaterial.materialType,
          unit_weight: updatedMaterial.unitWeight,
          is_sellable: updatedMaterial.isSellable || false,
          ncm: updatedMaterial.ncm,
          cfop: updatedMaterial.cfop,
          cst: updatedMaterial.cst,
          origem: updatedMaterial.origem,
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
      navigate(`/materiais/${material.id}/editar`);
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

  const handleBulkArchive = async () => {
    try {
      const { error } = await supabase
        .from('materials')
        .update({ is_archived: true })
        .in('id', selectedMaterials);
      
      if (error) throw error;
      
      // Reload materials to reflect changes
      await loadMaterials();
      setSelectedMaterials([]);
      toast.success(`${selectedMaterials.length} ${selectedMaterials.length === 1 ? 'material arquivado' : 'materiais arquivados'} com sucesso!`);
    } catch (error) {
      console.error('Erro ao arquivar materiais:', error);
      toast.error('Erro ao arquivar materiais');
    }
  };

  const exportMaterialsToCSV = async () => {
    try {
      // Fetch full data from DB including stock info
      const { data: dbMaterials, error } = await supabase
        .from('materials')
        .select(`
          id, name, description, code, material_type, category, subcategory,
          purchase_unit, usage_unit, conversion_factor, price_per_purchase_unit,
          allowed_brands, unit_weight, is_sellable, is_archived,
          ncm, cfop, cst, origem, created_at, updated_at,
          stock_items(current_quantity, minimum_quantity, average_price, total_value)
        `)
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;

      const rows = dbMaterials || [];

      const headers = [
        'Código', 'Nome', 'Descrição', 'Tipo Material', 'Categoria', 'Subcategoria',
        'Un. Compra', 'Un. Uso', 'Fator Conversão', 'Preço Un. Compra',
        'Marcas Permitidas', 'Peso Unitário', 'Vendível',
        'NCM', 'CFOP', 'CST', 'Origem',
        'Qtd Estoque', 'Estoque Mínimo', 'Preço Médio', 'Valor Total',
        'Criado em', 'Atualizado em'
      ];

      const origemLabel = (v: any) => {
        if (v === 0) return '0 - Nacional';
        if (v === 1) return '1 - Estrangeira (direta)';
        if (v === 2) return '2 - Estrangeira (mercado interno)';
        return '';
      };

      const csvRows = rows.map(m => {
        const stock = (m.stock_items as any)?.[0];
        return [
          m.code || '',
          m.name || '',
          m.description || '',
          m.material_type || '',
          m.category || '',
          m.subcategory || '',
          m.purchase_unit || '',
          m.usage_unit || '',
          m.conversion_factor ?? '',
          m.price_per_purchase_unit ?? '',
          (m.allowed_brands || []).join('; '),
          m.unit_weight ?? '',
          m.is_sellable ? 'Sim' : 'Não',
          (m as any).ncm || '',
          (m as any).cfop || '',
          (m as any).cst || '',
          origemLabel((m as any).origem),
          stock?.current_quantity ?? '',
          stock?.minimum_quantity ?? '',
          stock?.average_price ?? '',
          stock?.total_value ?? '',
          m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : '',
          m.updated_at ? new Date(m.updated_at).toLocaleDateString('pt-BR') : '',
        ];
      });

      const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
      const csvContent = [headers, ...csvRows].map(row => row.map(escape).join(',')).join('\n');

      // BOM + Blob for proper UTF-8 with accents
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = `materiais_completo_${new Date().toISOString().split('T')[0]}.csv`;

      setGeneratedExport({
        filename,
        blob,
        totalRows: rows.length,
        generatedAt: new Date().toLocaleString('pt-BR'),
      });

      triggerCsvDownload(blob, filename);

      toast.success(`CSV com ${rows.length} materiais pronto para download!`, {
        description: 'Se o download automático não iniciar, use o botão “Baixar arquivo” exibido na tela para escolher onde salvar o CSV.',
        duration: 8000,
      });
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar CSV dos materiais');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando materiais...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="space-y-5">
          {/* Page Header + Actions */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Cadastro de Materiais</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {materials.length} {materials.length === 1 ? 'material cadastrado' : 'materiais cadastrados'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowMaterialForm(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Material
              </Button>

              <Button
                variant="outline"
                onClick={handleEditSelected}
                disabled={selectedMaterials.length !== 1}
                className="border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-50"
                title={
                  selectedMaterials.length === 0
                    ? 'Selecione um material na tabela para editar'
                    : selectedMaterials.length > 1
                    ? 'Selecione apenas um material para editar'
                    : undefined
                }
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>

              <Button
                variant="outline"
                onClick={exportMaterialsToCSV}
                className="border-border hover:bg-accent"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/config#estoque')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            </div>
          </div>

          {/* Instructional Banner — collapsible, starts collapsed */}
          <InstructionalBanner
            title="Como usar o Cadastro de Materiais"
            description={[
              "Aqui você encontra todos os materiais cadastrados no sistema.",
              "Antes de criar um novo material, utilize os filtros ou a busca para verificar se ele já existe, evitando duplicidades.",
              "Cada material deve estar corretamente classificado em Categoria e Subcategoria.",
              "Para dúvidas, consulte o manual completo.",
            ]}
            onManualClick={handleManualClick}
            collapsible
            defaultCollapsed
          />

          {generatedExport && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Arquivo pronto: {generatedExport.filename}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {generatedExport.totalRows} materiais preparados em {generatedExport.generatedAt}. Se o download automático não iniciar, clique em Baixar arquivo para escolher a pasta onde deseja salvar o CSV.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => saveGeneratedCsv(generatedExport.blob, generatedExport.filename)}
                    className="border-border hover:bg-accent"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar arquivo
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => openGeneratedCsv(generatedExport.blob)}
                  >
                    Abrir CSV
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={clearGeneratedExport}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-card rounded-lg border shadow-sm p-4">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, código, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesWithCounts.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{category.label}</span>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {category.count}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Subcategory Filter */}
                <Select
                  value={selectedSubcategory}
                  onValueChange={setSelectedSubcategory}
                  disabled={selectedCategory === "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategoriesWithCounts.map((subcategory) => (
                      <SelectItem key={subcategory.value} value={subcategory.value}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{subcategory.label}</span>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {subcategory.count}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Result count */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  {filteredMaterials.length === materials.length
                    ? `${materials.length} materiais`
                    : `${filteredMaterials.length} de ${materials.length} materiais`}
                  {selectedMaterials.length > 0 && (
                    <span className="ml-2 text-primary font-medium">· {selectedMaterials.length} selecionado{selectedMaterials.length !== 1 ? 's' : ''}</span>
                  )}
                </span>
                {(selectedCategory !== "all" || selectedSubcategory !== "all" || searchTerm) && (
                  <button
                    onClick={() => { setSelectedCategory("all"); setSelectedSubcategory("all"); setSearchTerm(""); }}
                    className="text-primary hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <MaterialsActions 
              selectedCount={selectedMaterials.length}
              selectedMaterials={filteredMaterials.filter(m => selectedMaterials.includes(m.id))}
              onBulkDelete={handleBulkDelete}
              onBulkArchive={handleBulkArchive}
              onClearSelection={() => setSelectedMaterials([])}
              onRefresh={loadMaterials}
            />
          </div>

          {/* Materials Table */}
          <ErrorBoundary>
            <SimplifiedMaterialsTable
              materials={filteredMaterials}
              selectedMaterials={selectedMaterials}
              onSelectMaterial={handleSelectMaterial}
              onSelectAll={handleSelectAll}
            />
          </ErrorBoundary>
        </div>

        {/* Material Form Modal */}
        {showMaterialForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-background rounded-lg w-full max-w-2xl my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
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