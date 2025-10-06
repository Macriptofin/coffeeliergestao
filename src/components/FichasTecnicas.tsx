import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Search, Filter, Package, Edit, Archive, ArchiveRestore, Eye, ArrowLeft, Printer } from 'lucide-react';
import { TechnicalSheetActions } from '@/components/TechnicalSheetActions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TechnicalSheetWizard } from '@/components/TechnicalSheetWizard';

interface TechnicalSheet {
  id: string;
  name: string;
  product_type: 'finished_product' | 'intermediate_product' | 'composite_product';
  category: string;
  subcategory?: string;
  yield_quantity?: number;
  yield_unit?: string;
  items_count: number;
  cost?: number;
  material_id: string;
  material_code?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

const FichasTecnicas = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [technicalSheets, setTechnicalSheets] = useState<TechnicalSheet[]>([]);
  const [filteredSheets, setFilteredSheets] = useState<TechnicalSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  
  // Wizard states
  const [showWizard, setShowWizard] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | undefined>();

  useEffect(() => {
    // Handle routing
    if (location.pathname.includes('/producao/fichas/novo')) {
      setShowWizard(true);
      setEditingSheetId(undefined);
    } else if (id) {
      setShowWizard(true);
      setEditingSheetId(id);
    } else {
      setShowWizard(false);
      setEditingSheetId(undefined);
    }
    
    loadTechnicalSheets();
  }, [id, location.pathname]);

  useEffect(() => {
    applyFilters();
  }, [technicalSheets, searchTerm, typeFilter, categoryFilter, showArchived]);

  const loadTechnicalSheets = async () => {
    try {
      setLoading(true);
      
      const sheets: TechnicalSheet[] = [];

      // Load recipe BOMs (finished and intermediate products)
      const { data: recipeBOMs, error: recipeError } = await supabase
        .from('recipes_bom')
        .select(`
          id,
          yield_quantity,
          yield_unit,
          is_archived,
          created_at,
          updated_at,
          materials!recipes_bom_finished_material_id_fkey(
            id,
            name,
            code,
            category,
            subcategory,
            material_type
          ),
          recipe_bom_items(id)
        `)
        .order('created_at', { ascending: false });

      if (recipeError) throw recipeError;

      for (const bom of recipeBOMs || []) {
        const productType = bom.materials?.material_type === 'finished_product' 
          ? 'finished_product' 
          : 'intermediate_product';

        sheets.push({
          id: bom.id,
          name: bom.materials?.name || 'Sem nome',
          product_type: productType,
          category: bom.materials?.category || '',
          subcategory: bom.materials?.subcategory,
          yield_quantity: bom.yield_quantity,
          yield_unit: bom.yield_unit,
          items_count: bom.recipe_bom_items?.length || 0,
          material_id: bom.materials?.id || '',
          material_code: bom.materials?.code,
          is_archived: bom.is_archived || false,
          created_at: bom.created_at,
          updated_at: bom.updated_at
        });
      }

      // Load composite BOMs
      const { data: compositeBOMs, error: compositeError } = await supabase
        .from('composites_bom')
        .select(`
          id,
          is_archived,
          created_at,
          updated_at,
          materials!composites_bom_composite_material_id_fkey(
            id,
            name,
            code,
            category,
            subcategory,
            material_type
          ),
          composite_bom_items(id)
        `)
        .order('created_at', { ascending: false });

      if (compositeError) throw compositeError;

      for (const bom of compositeBOMs || []) {
        sheets.push({
          id: bom.id,
          name: bom.materials?.name || 'Sem nome',
          product_type: 'composite_product',
          category: bom.materials?.category || '',
          subcategory: bom.materials?.subcategory,
          items_count: bom.composite_bom_items?.length || 0,
          material_id: bom.materials?.id || '',
          material_code: bom.materials?.code,
          is_archived: bom.is_archived || false,
          created_at: bom.created_at,
          updated_at: bom.updated_at
        });
      }

      setTechnicalSheets(sheets);
    } catch (error) {
      console.error('Erro ao carregar fichas técnicas:', error);
      toast.error('Erro ao carregar fichas técnicas');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = technicalSheets;

    // Archive filter (mostrar ou não arquivadas)
    if (!showArchived) {
      filtered = filtered.filter(sheet => !sheet.is_archived);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(sheet =>
        sheet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sheet.material_code?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(sheet => {
        switch (typeFilter) {
          case 'finished':
            return sheet.product_type === 'finished_product';
          case 'intermediate':
            return sheet.product_type === 'intermediate_product';
          case 'composite':
            return sheet.product_type === 'composite_product';
          default:
            return true;
        }
      });
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(sheet => sheet.category === categoryFilter);
    }

    setFilteredSheets(filtered);
  };

  const handleNewTechnicalSheet = () => {
    navigate('/producao/fichas/novo');
  };

  const handleEditTechnicalSheet = (sheetId: string) => {
    navigate(`/producao/fichas/${sheetId}`);
  };

  const handleArchiveTechnicalSheet = async (sheet: TechnicalSheet, shouldArchive: boolean) => {
    const action = shouldArchive ? 'arquivar' : 'desarquivar';
    if (!confirm(`Confirma ${action} a ficha técnica "${sheet.name}"? O material vinculado também será ${shouldArchive ? 'arquivado' : 'desarquivado'}.`)) return;

    try {
      let result;
      
      if (sheet.product_type === 'composite_product') {
        const { data, error } = await supabase.rpc('archive_composite_bom', {
          p_bom_id: sheet.id,
          p_should_archive: shouldArchive
        });
        
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase.rpc('archive_recipe_bom', {
          p_bom_id: sheet.id,
          p_should_archive: shouldArchive
        });
        
        if (error) throw error;
        result = data;
      }

      if (result?.success) {
        toast.success(`Ficha técnica ${shouldArchive ? 'arquivada' : 'desarquivada'} com sucesso!`);
        loadTechnicalSheets();
      } else {
        throw new Error(result?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error(`Erro ao ${action} ficha técnica:`, error);
      toast.error(`Erro ao ${action} ficha técnica: ${error.message}`);
    }
  };

  const handleWizardSuccess = () => {
    setShowWizard(false);
    setEditingSheetId(undefined);
    navigate('/producao/fichas-tecnicas');
    loadTechnicalSheets();
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setEditingSheetId(undefined);
    navigate('/producao/fichas-tecnicas');
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'finished_product': return 'Produto Acabado';
      case 'intermediate_product': return 'Produto Intermediário';
      case 'composite_product': return 'Produto Composto';
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'finished_product': return 'default';
      case 'intermediate_product': return 'secondary';
      case 'composite_product': return 'outline';
      default: return 'outline';
    }
  };

  // Get unique categories for filter
  const categories = Array.from(
    new Set(technicalSheets.map(sheet => sheet.category).filter(Boolean))
  ).sort();

  if (showWizard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <TechnicalSheetWizard
          technicalSheetId={editingSheetId}
          onSuccess={handleWizardSuccess}
          onCancel={handleWizardCancel}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fichas Técnicas</h1>
          <p className="text-muted-foreground">
            Gerencie as estruturas de materiais (BOM) dos seus produtos
          </p>
        </div>
        
        <Button onClick={handleNewTechnicalSheet} className="bg-gradient-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Nova Ficha Técnica
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="finished">Produto Acabado</SelectItem>
                  <SelectItem value="intermediate">Produto Intermediário</SelectItem>
                  <SelectItem value="composite">Produto Composto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredSheets.length} fichas encontradas
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-4 border-t">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="cursor-pointer">
              Mostrar fichas arquivadas
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Technical Sheets List */}
      {filteredSheets.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {technicalSheets.length === 0 
                  ? 'Nenhuma ficha técnica criada'
                  : 'Nenhuma ficha técnica encontrada'
                }
              </h3>
              <p className="text-muted-foreground mb-4">
                {technicalSheets.length === 0
                  ? 'Crie sua primeira ficha técnica para começar a gerenciar estruturas de materiais'
                  : 'Tente ajustar os filtros para encontrar as fichas técnicas desejadas'
                }
              </p>
              {technicalSheets.length === 0 && (
                <Button onClick={handleNewTechnicalSheet}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Ficha Técnica
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSheets.map((sheet) => (
            <Card key={sheet.id} className="shadow-soft hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{sheet.name}</CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      {sheet.material_code && (
                        <Badge variant="outline" className="text-xs">
                          {sheet.material_code}
                        </Badge>
                      )}
                      <Badge variant={getTypeBadgeVariant(sheet.product_type)}>
                        {getTypeLabel(sheet.product_type)}
                      </Badge>
                    </div>
                    {sheet.category && (
                      <p className="text-sm text-muted-foreground">{sheet.category}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Itens:</span>
                      <span className="ml-2 font-medium">{sheet.items_count}</span>
                    </div>
                    {sheet.yield_quantity && (
                      <div>
                        <span className="text-muted-foreground">Rendimento:</span>
                        <span className="ml-2 font-medium">
                          {sheet.yield_quantity} {sheet.yield_unit || 'un'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTechnicalSheet(sheet.id)}
                      className="flex-1"
                      disabled={sheet.is_archived}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveTechnicalSheet(sheet, !sheet.is_archived)}
                      className="px-3"
                      title={sheet.is_archived ? 'Desarquivar' : 'Arquivar'}
                    >
                      {sheet.is_archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  <TechnicalSheetActions 
                    sheetId={sheet.id}
                    sheetName={sheet.name}
                    productType={sheet.product_type}
                  />
                  
                  {sheet.is_archived && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Archive className="h-3 w-3" />
                      Arquivada
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FichasTecnicas;