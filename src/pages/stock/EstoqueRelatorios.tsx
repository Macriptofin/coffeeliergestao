import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, PackageX, TrendingDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ZeroStockItem {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  material_type: string;
  purchase_unit: string;
  usage_unit: string;
  price_per_purchase_unit: number;
  current_quantity: number;
  has_stock_record: boolean;
}

const EstoqueRelatorios = () => {
  const [activeTab, setActiveTab] = useState("zero-stock");
  const [zeroStockItems, setZeroStockItems] = useState<ZeroStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    loadZeroStockItems();
  }, []);

  const loadZeroStockItems = async () => {
    setLoading(true);
    try {
      // Buscar todos os materiais
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .eq('is_archived', false)
        .order('name');

      if (materialsError) throw materialsError;

      // Buscar registros de estoque
      const { data: stockItems, error: stockError } = await supabase
        .from('stock_items')
        .select('material_id, current_quantity');

      if (stockError) throw stockError;

      // Criar mapa de estoque
      const stockMap = new Map(
        stockItems?.map(item => [
          item.material_id, 
          parseFloat(item.current_quantity?.toString() || '0')
        ]) || []
      );

      // Filtrar materiais zerados ou sem registro
      const zeroItems: ZeroStockItem[] = materials
        ?.map(material => ({
          id: material.id,
          code: material.code || 'S/C',
          name: material.name,
          category: material.category,
          subcategory: material.subcategory,
          material_type: material.material_type,
          purchase_unit: material.purchase_unit,
          usage_unit: material.usage_unit,
          price_per_purchase_unit: parseFloat(material.price_per_purchase_unit?.toString() || '0'),
          current_quantity: stockMap.get(material.id) || 0,
          has_stock_record: stockMap.has(material.id)
        }))
        .filter(item => item.current_quantity === 0) || [];

      setZeroStockItems(zeroItems);
    } catch (error) {
      console.error('Erro ao carregar itens zerados:', error);
      toast.error('Erro ao carregar relatório');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const filteredItems = getFilteredItems();
    
    if (filteredItems.length === 0) {
      toast.error('Não há itens para exportar');
      return;
    }

    // Criar CSV
    const headers = [
      'Código',
      'Nome',
      'Categoria',
      'Subcategoria',
      'Tipo',
      'Unidade Compra',
      'Unidade Uso',
      'Preço Unitário',
      'Qtd Atual',
      'Status Estoque'
    ].join(';');

    const rows = filteredItems.map(item => [
      item.code,
      item.name,
      item.category,
      item.subcategory || '',
      getMaterialTypeLabel(item.material_type),
      item.purchase_unit,
      item.usage_unit,
      item.price_per_purchase_unit.toFixed(2),
      item.current_quantity.toFixed(2),
      item.has_stock_record ? 'Zerado' : 'Sem Registro'
    ].join(';'));

    const csv = [headers, ...rows].join('\n');
    
    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `itens_zerados_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Relatório exportado com sucesso!');
  };

  const getMaterialTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'ingredient': 'Insumo',
      'packaging': 'Embalagem',
      'intermediate_product': 'Produto Intermediário',
      'finished_product': 'Produto Acabado',
      'composite_product': 'Produto Composto'
    };
    return labels[type] || type;
  };

  const getFilteredItems = () => {
    return zeroStockItems.filter(item => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (filterType !== 'all' && item.material_type !== filterType) return false;
      return true;
    });
  };

  const filteredItems = getFilteredItems();
  const categories = [...new Set(zeroStockItems.map(item => item.category))];
  const types = [...new Set(zeroStockItems.map(item => item.material_type))];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Relatórios de Estoque</h1>
        <p className="text-muted-foreground">
          Análises, inventários e relatórios de valorização de estoque
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="zero-stock" className="flex items-center gap-2">
            <PackageX className="h-4 w-4" />
            Itens Zerados
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4" />
            Valorização
          </TabsTrigger>
          <TabsTrigger value="turnover" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Giro de Estoque
          </TabsTrigger>
        </TabsList>

        <TabsContent value="zero-stock">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PackageX className="h-5 w-5" />
                    Materiais com Estoque Zerado
                  </CardTitle>
                  <CardDescription>
                    Materiais sem registro de estoque ou com quantidade zerada
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/estoque/inventario-ajustes')}
                  >
                    Ir para Inventário
                  </Button>
                  <Button onClick={exportToCSV} disabled={loading || filteredItems.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Categoria</label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Tipo de Material</label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {types.map(type => (
                        <SelectItem key={type} value={type}>
                          {getMaterialTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{filteredItems.length}</div>
                    <p className="text-xs text-muted-foreground">Itens Zerados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {filteredItems.filter(i => !i.has_stock_record).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Sem Registro</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {filteredItems.filter(i => i.has_stock_record).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Com Registro Zerado</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum item zerado encontrado
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.code}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{item.category}</div>
                              {item.subcategory && (
                                <div className="text-xs text-muted-foreground">
                                  {item.subcategory}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getMaterialTypeLabel(item.material_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.purchase_unit} → {item.usage_unit}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {item.price_per_purchase_unit.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={item.has_stock_record ? "secondary" : "destructive"}>
                              {item.has_stock_record ? 'Zerado' : 'Sem Registro'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="valuation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5" />
                Relatório de Valorização de Estoque
              </CardTitle>
              <CardDescription>
                Em desenvolvimento - Valorização total e análise de custos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Este relatório estará disponível em breve
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="turnover">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Análise de Giro de Estoque
              </CardTitle>
              <CardDescription>
                Em desenvolvimento - Análise de movimentação e rotatividade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Este relatório estará disponível em breve
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EstoqueRelatorios;
