import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, PackageX, TrendingDown, Download, AlertTriangle, DollarSign } from "lucide-react";
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
  material_id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  material_type: string;
  current_quantity: number;
  average_price?: number;
  has_stock_record: boolean;
}

interface BelowMinItem {
  material_id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  material_type: string;
  current_quantity: number;
  minimum_quantity: number;
  deficit_quantity: number;
  average_price?: number;
  estimated_cost?: number;
}

interface NoPriceItem {
  material_id: string;
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  material_type: string;
  current_quantity: number;
  price_per_purchase_unit?: number;
  total_value?: number;
}

const EstoqueRelatorios = () => {
  const [activeTab, setActiveTab] = useState("zero-stock");
  const [zeroStockItems, setZeroStockItems] = useState<ZeroStockItem[]>([]);
  const [belowMinItems, setBelowMinItems] = useState<BelowMinItem[]>([]);
  const [noPriceItems, setNoPriceItems] = useState<NoPriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const navigate = useNavigate();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Buscar itens zerados usando a view
      const { data: zeroData, error: zeroError } = await supabase
        .from('vw_stock_zero')
        .select('*')
        .order('name');

      if (zeroError) throw zeroError;
      setZeroStockItems(zeroData || []);

      // Buscar itens abaixo do mínimo usando a view
      const { data: belowMinData, error: belowMinError } = await supabase
        .from('vw_stock_below_min')
        .select('*')
        .order('deficit_quantity', { ascending: false });

      if (belowMinError) throw belowMinError;
      setBelowMinItems(belowMinData || []);

      // Buscar itens sem preço médio usando a view
      const { data: noPriceData, error: noPriceError } = await supabase
        .from('vw_stock_no_avg_price')
        .select('*')
        .order('current_quantity', { ascending: false });

      if (noPriceError) throw noPriceError;
      setNoPriceItems(noPriceData || []);

    } catch (error) {
      console.error('Erro ao carregar dados dos relatórios:', error);
      toast.error('Erro ao carregar relatórios');
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
      'ID Material',
      'Código',
      'Nome',
      'Categoria',
      'Subcategoria',
      'Tipo',
      'Qtd Atual',
      'Preço Médio',
      'Status Estoque'
    ].join(';');

    const rows = filteredItems.map(item => [
      item.material_id,
      item.code || 'S/C',
      item.name,
      item.category,
      item.subcategory || '',
      getMaterialTypeLabel(item.material_type),
      item.current_quantity.toFixed(2),
      (item.average_price || 0).toFixed(2),
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="zero-stock" className="flex items-center gap-2">
            <PackageX className="h-4 w-4" />
            Itens Zerados
          </TabsTrigger>
          <TabsTrigger value="below-min" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Abaixo do Mínimo
          </TabsTrigger>
          <TabsTrigger value="no-price" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Sem Preço Médio
          </TabsTrigger>
          <TabsTrigger value="valuation" className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4" />
            Valorização
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
                        <TableHead className="text-right">Qtd Atual</TableHead>
                        <TableHead className="text-right">Preço Médio</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map(item => (
                        <TableRow key={item.material_id}>
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
                            {item.current_quantity.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {(item.average_price || 0).toFixed(2)}
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
