import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Wrench, Plus, Search, Edit, Trash2, DollarSign, RefreshCw, Clock, Bell, History } from 'lucide-react';
import { BOMCostAlerts } from '@/components/BOMCostAlerts';
import { BOMCostHistory } from '@/components/BOMCostHistory';
import { RecipeBOMForm } from '@/components/bom/RecipeBOMForm';
import { CompositeBOMForm } from '@/components/bom/CompositeBOMForm';
import { ProductionExecutor } from '@/components/bom/ProductionExecutor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TechnicalSheetActions } from '@/components/TechnicalSheetActions';

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
  bom_id?: string;
  total_cost?: number;
  unit_cost?: number;
  yield_quantity?: number;
  yield_unit?: string;
  cost_calculated_at?: string;
  cost_status?: string;
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
  const [recalculating, setRecalculating] = useState(false);
  const [lastRecalculatedAt, setLastRecalculatedAt] = useState<Date | null>(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
            cached_total_cost,
            cached_unit_cost,
            yield_quantity,
            yield_unit,
            cost_status,
            cost_last_calculated_at,
            recipe_bom_items (id)
          )
        `)
        .in('material_type', ['finished_product', 'intermediate_product'])
        .order('name');

      if (error) throw error;

      const summary: BOMSummary[] = data.map((material: any) => {
        const bom = material.recipes_bom?.[0];
        
        return {
          material: {
            id: material.id,
            name: material.name,
            code: material.code,
            material_type: material.material_type,
            category: material.category,
            usage_unit: material.usage_unit
          },
          has_bom: bom != null,
          items_count: bom?.recipe_bom_items?.length || 0,
          bom_id: bom?.id,
          total_cost: bom?.cached_total_cost ? parseFloat(bom.cached_total_cost) : undefined,
          unit_cost: bom?.cached_unit_cost ? parseFloat(bom.cached_unit_cost) : undefined,
          yield_quantity: bom?.yield_quantity ? parseFloat(bom.yield_quantity) : undefined,
          yield_unit: bom?.yield_unit,
          cost_status: bom?.cost_status,
          cost_calculated_at: bom?.cost_last_calculated_at
        };
      });

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
            cached_total_cost,
            cost_last_calculated_at,
            composite_bom_items (id)
          )
        `)
        .eq('material_type', 'composite_product')
        .order('name');

      if (error) throw error;

      const summary: BOMSummary[] = data.map((material: any) => {
        const bom = material.composites_bom?.[0];
        
        return {
          material: {
            id: material.id,
            name: material.name,
            code: material.code,
            material_type: material.material_type,
            category: material.category,
            usage_unit: material.usage_unit
          },
          has_bom: bom != null,
          items_count: bom?.composite_bom_items?.length || 0,
          bom_id: bom?.id,
          total_cost: bom?.cached_total_cost ? parseFloat(bom.cached_total_cost) : undefined,
          cost_calculated_at: bom?.cost_last_calculated_at
        };
      });

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

  const handleRecalculateAllCosts = async () => {
    setRecalculating(true);
    try {
      toast.info('Recalculando custos de todas as BOMs...', { duration: 2000 });
      
      // Buscar todos os materiais para recalcular
      const { data: allMaterials } = await supabase
        .from('materials')
        .select('id')
        .in('material_type', ['raw_material', 'packaging', 'finished_product', 'intermediate_product', 'composite_product']);

      if (allMaterials) {
        // Recalcular para cada material (isso vai atualizar as BOMs que usam cada material)
        const recalcPromises = allMaterials.map(m => 
          supabase.rpc('refresh_bom_costs_for_material', { p_material_id: m.id })
        );
        
        await Promise.allSettled(recalcPromises);
      }
      
      // Recarregar dados com cache atualizado
      await Promise.all([loadFinishedProducts(), loadCompositeProducts()]);
      setLastRecalculatedAt(new Date());
      toast.success('Custos recalculados e atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao recalcular custos:', error);
      toast.error('Erro ao recalcular custos');
    } finally {
      setRecalculating(false);
    }
  };
  const renderMaterialRow = (item: BOMSummary, type: 'finished' | 'composite') => (
    <TableRow key={item.material.id}>
      {type === 'finished' && (
        <TableCell className="w-12">
          <Checkbox
            checked={isSelectedFinished(item.material.id)}
            onCheckedChange={() => toggleSelectFinished(item.material.id)}
            aria-label="Selecionar ficha técnica"
          />
        </TableCell>
      )}
      <TableCell className="font-medium">
        <div className="flex flex-col gap-1">
          <span>{item.material.name}</span>
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
      </TableCell>
      <TableCell className="text-center">
        {item.has_bom ? (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Configurada
          </Badge>
        ) : (
          <Badge variant="secondary">
            Não Configurada
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-center">
        {item.has_bom ? (
          <span className="text-sm">
            {item.items_count} {type === 'finished' ? 'ingredientes' : 'componentes'}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {item.has_bom ? (
          <div className="flex flex-col items-end gap-0.5">
            {/* CMV unitário — principal */}
            {item.unit_cost != null ? (
              <span className={`font-bold text-sm ${
                item.cost_status === 'complete' ? 'text-primary' :
                item.cost_status === 'partial' ? 'text-amber-600' :
                'text-muted-foreground'
              }`}>
                {item.unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  / {item.yield_unit || 'un'}
                </span>
              </span>
            ) : (
              <span className="text-xs text-amber-600">Sem preço médio</span>
            )}
            {/* Custo total da receita */}
            {item.total_cost != null && (
              <span className="text-xs text-muted-foreground">
                Total: {item.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
            {item.cost_calculated_at && (
              <span className="text-xs text-muted-foreground/60">
                {new Date(item.cost_calculated_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="sm"
            variant={item.has_bom ? "outline" : "default"}
            onClick={() => handleEditBOM(item.material, type)}
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
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => deleteSingleBOM(item.material.id)} 
              disabled={deleting}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}

          {item.has_bom && item.bom_id && (
            <TechnicalSheetActions 
              sheetId={item.bom_id}
              sheetName={item.material.name}
              productType={item.material.material_type as 'finished_product' | 'intermediate_product' | 'composite_product'}
            />
          )}
        </div>
      </TableCell>
    </TableRow>
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
          {lastRecalculatedAt && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Custos atualizados em {lastRecalculatedAt.toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAlerts(!showAlerts)}
            variant={showAlerts ? "default" : "outline"}
            size="sm"
          >
            <Bell className="h-4 w-4 mr-2" />
            Alertas
          </Button>
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant={showHistory ? "default" : "outline"}
            size="sm"
          >
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Button>
          <Button
            onClick={handleRecalculateAllCosts}
            disabled={recalculating}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculando...' : 'Recalcular Custos'}
          </Button>
        </div>
      </div>

      {showAlerts && (
        <div className="bg-muted/50 p-6 rounded-lg mb-6">
          <BOMCostAlerts />
        </div>
      )}

      {showHistory && (
        <div className="mb-6">
          <BOMCostHistory />
        </div>
      )}

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
                size="sm"
                onClick={() => { setSelectedMaterial(null); setShowRecipeBOMForm(true); }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nova Ficha Técnica
              </Button>
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Status BOM</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead className="text-right">CMV Unitário</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterMaterials(finishedProducts).map(item => renderMaterialRow(item, 'finished'))}
                </TableBody>
              </Table>
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Status BOM</TableHead>
                    <TableHead className="text-center">Componentes</TableHead>
                    <TableHead className="text-right">CMV Unitário</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterMaterials(compositeProducts).map(item => renderMaterialRow(item, 'composite'))}
                </TableBody>
              </Table>
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