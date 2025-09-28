import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Wrench, Plus, Search, Edit, Eye, Trash2 } from 'lucide-react';
import { RecipeBOMForm } from '@/components/bom/RecipeBOMForm';
import { CompositeBOMForm } from '@/components/bom/CompositeBOMForm';
import { ProductionExecutor } from '@/components/bom/ProductionExecutor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BOMMaterial {
  id: string;
  name: string;
  code: string;
  material_type: string;
  category: string;
  usage_unit?: string;
}

interface BOMSummary {
  material: BOMMaterial;
  has_bom: boolean;
  items_count: number;
}

const BOMManagement = () => {
  const [finishedProducts, setFinishedProducts] = useState<BOMSummary[]>([]);
  const [compositeProducts, setCompositeProducts] = useState<BOMSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecipeBOMForm, setShowRecipeBOMForm] = useState(false);
  const [showCompositeBOMForm, setShowCompositeBOMForm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<BOMMaterial | null>(null);
  const [activeTab, setActiveTab] = useState('finished');
  const [selectedFinished, setSelectedFinished] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadFinishedProducts(), loadCompositeProducts()]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadFinishedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          id, name, code, material_type, category, usage_unit, is_sellable,
          recipes_bom (
            id,
            recipe_bom_items (id)
          )
        `)
        .in('material_type', ['finished_product', 'intermediate_product'])
        .order('name');

      if (error) throw error;

      const summary: BOMSummary[] = data.map((material: any) => ({
        material: {
          id: material.id,
          name: material.name,
          code: material.code,
          material_type: material.material_type,
          category: material.category,
          usage_unit: material.usage_unit
        },
        has_bom: material.recipes_bom && material.recipes_bom.length > 0,
        items_count: material.recipes_bom?.[0]?.recipe_bom_items?.length || 0
      }));

      setFinishedProducts(summary);
    } catch (error) {
      console.error('Erro ao carregar produtos acabados:', error);
    }
  };

  const loadCompositeProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          id, name, code, material_type, category, usage_unit,
          composites_bom (
            id,
            composite_bom_items (id)
          )
        `)
        .eq('material_type', 'composite_product')
        .order('name');

      if (error) throw error;

      const summary: BOMSummary[] = data.map((material: any) => ({
        material: {
          id: material.id,
          name: material.name,
          code: material.code,
          material_type: material.material_type,
          category: material.category,
          usage_unit: material.usage_unit
        },
        has_bom: material.composites_bom && material.composites_bom.length > 0,
        items_count: material.composites_bom?.[0]?.composite_bom_items?.length || 0
      }));

      setCompositeProducts(summary);
    } catch (error) {
      console.error('Erro ao carregar produtos compostos:', error);
    }
  };

  const filterMaterials = (materials: BOMSummary[]) => {
    if (!searchTerm.trim()) return materials;
    
    const search = searchTerm.toLowerCase().trim();
    return materials.filter(item => 
      item.material.name.toLowerCase().includes(search) ||
      item.material.code.toLowerCase().includes(search)
    );
  };

  const handleEditBOM = (material: BOMMaterial, type: 'finished' | 'composite') => {
    setSelectedMaterial(material);
    if (type === 'finished') {
      setShowRecipeBOMForm(true);
    } else {
      setShowCompositeBOMForm(true);
    }
  };

  const handleFormSuccess = () => {
    loadData();
    setShowRecipeBOMForm(false);
    setShowCompositeBOMForm(false);
    setSelectedMaterial(null);
  };

  const handleFormCancel = () => {
    setShowRecipeBOMForm(false);
    setShowCompositeBOMForm(false);
    setSelectedMaterial(null);
  };

  // Seleção e exclusão de Fichas Técnicas (apenas produtos acabados/intermediários)
  const toggleSelectFinished = (id: string) => {
    setSelectedFinished(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isSelectedFinished = (id: string) => selectedFinished.has(id);

  const selectAllFinished = (ids: string[]) => {
    setSelectedFinished(new Set(ids));
  };

  const clearSelectionFinished = () => setSelectedFinished(new Set());

  const deleteBOMsForMaterials = async (materialIds: string[]) => {
    try {
      setDeleting(true);
      if (materialIds.length === 0) return;
      const { data: bomRows, error: bomErr } = await supabase
        .from('recipes_bom')
        .select('id, finished_material_id')
        .in('finished_material_id', materialIds);
      if (bomErr) throw bomErr;
      const bomIds = (bomRows || []).map(r => r.id);
      if (bomIds.length > 0) {
        const { error: delItemsErr } = await supabase
          .from('recipe_bom_items')
          .delete()
          .in('recipe_id', bomIds);
        if (delItemsErr) throw delItemsErr;
        const { error: delBomErr } = await supabase
          .from('recipes_bom')
          .delete()
          .in('id', bomIds);
        if (delBomErr) throw delBomErr;
      }
      toast.success('Fichas técnicas excluídas com sucesso');
      clearSelectionFinished();
      await loadFinishedProducts();
    } catch (err) {
      console.error('Erro ao excluir fichas técnicas:', err);
      toast.error('Falha ao excluir fichas técnicas');
    } finally {
      setDeleting(false);
    }
  };

  const deleteSingleBOM = (materialId: string) => deleteBOMsForMaterials([materialId]);
  const renderMaterialCard = (item: BOMSummary, type: 'finished' | 'composite') => (
    <Card key={item.material.id} className="shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {type === 'finished' && (
              <Checkbox
                checked={isSelectedFinished(item.material.id)}
                onCheckedChange={() => toggleSelectFinished(item.material.id)}
                aria-label="Selecionar ficha técnica"
              />
            )}
            <CardTitle className="text-lg">{item.material.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {item.material.code}
            </Badge>
            {item.material.material_type === 'intermediate_product' && (
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                Intermediário
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>{item.material.category}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {item.has_bom ? (
              <>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  BOM Configurada
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {item.items_count} {type === 'finished' ? 'ingredientes' : 'componentes'}
                </span>
              </>
            ) : (
              <Badge variant="secondary">
                BOM Não Configurada
              </Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={item.has_bom ? "outline" : "default"}
            onClick={() => handleEditBOM(item.material, type)}
            className="flex-1"
          >
            {item.has_bom ? (
              <>
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Configurar
              </>
            )}
          </Button>
          
          {item.has_bom && type === 'finished' && (
            <Button size="sm" variant="destructive" onClick={() => deleteSingleBOM(item.material.id)} disabled={deleting} className="flex-1">
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar Ficha
            </Button>
          )}

          {item.has_bom && (
            <Button size="sm" variant="ghost" aria-label="Visualizar">
              <Eye className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestão de BOM</h1>
          <p className="text-muted-foreground">Configure estruturas de produtos e execute produção/montagem</p>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Pesquisar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="finished" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produtos Acabados e Intermediários
          </TabsTrigger>
          <TabsTrigger value="composite" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Produtos Compostos
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Executar Produção
          </TabsTrigger>
        </TabsList>

        <TabsContent value="finished" className="mt-6">
          <div className="mb-4">
            <p className="text-muted-foreground">
        `Produtos que requerem receita e processo de produção (incluindo receitas-base)`
            </p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {selectedFinished.size} selecionada(s)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectAllFinished(filterMaterials(finishedProducts).map(i => i.material.id))}
                disabled={filterMaterials(finishedProducts).length === 0}
              >
                Selecionar todos
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteBOMsForMaterials(Array.from(selectedFinished))}
                disabled={deleting || selectedFinished.size === 0}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Excluir selecionadas
              </Button>
            </div>
          </div>

          {filterMaterials(finishedProducts).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto acabado ou intermediário cadastrado'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'Tente alterar os termos da pesquisa' : 'Cadastre produtos acabados ou intermediários na página de materiais primeiro'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => window.location.href = '/materials'}>
                      Ir para Materiais
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filterMaterials(finishedProducts).map(item => renderMaterialCard(item, 'finished'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="composite" className="mt-6">
          <div className="mb-4">
            <p className="text-muted-foreground">
              Configure composições para produtos compostos (kits, conjuntos, cestas)
            </p>
          </div>

          {filterMaterials(compositeProducts).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto composto cadastrado'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'Tente alterar os termos da pesquisa' : 'Cadastre produtos compostos na página de materiais primeiro'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => window.location.href = '/materials'}>
                      Ir para Materiais
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filterMaterials(compositeProducts).map(item => renderMaterialCard(item, 'composite'))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="production" className="mt-6">
          <div className="mb-4">
            <p className="text-muted-foreground">
              Execute produção de produtos acabados ou montagem de produtos compostos
            </p>
          </div>
          
          <ProductionExecutor onSuccess={loadData} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={showRecipeBOMForm} onOpenChange={setShowRecipeBOMForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BOM - Produto Acabado</DialogTitle>
          </DialogHeader>
          <RecipeBOMForm
            finishedMaterial={selectedMaterial ? {
              ...selectedMaterial,
              usage_unit: selectedMaterial.usage_unit || 'unidade'
            } : undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showCompositeBOMForm} onOpenChange={setShowCompositeBOMForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BOM - Produto Composto</DialogTitle>
          </DialogHeader>
          <CompositeBOMForm
            compositeMaterial={selectedMaterial ? {
              ...selectedMaterial,
              usage_unit: selectedMaterial.usage_unit || 'unidade'
            } : undefined}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BOMManagement;