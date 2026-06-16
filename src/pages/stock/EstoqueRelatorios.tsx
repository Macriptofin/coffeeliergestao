import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { todayLocalISO } from "@/lib/date-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, PackageX, TrendingDown, Download, AlertTriangle, DollarSign, ListChecks, TrendingUp, TriangleAlert } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  material_type: string;
  unit: string;
  current_quantity: number;
  average_price: number;
  total_value: number;
  last_movement_date?: string;
}

interface ValuationItem {
  material_id: string;
  code: string;
  name: string;
  category: string;
  purchase_unit: string;
  current_quantity: number;
  average_price: number;
  total_value: number;
  last_movement_date?: string;
}

interface PricePoint {
  date: string;
  dateLabel: string;
  price: number;
}

interface DeviationAlert {
  material_id: string;
  name: string;
  code: string;
  avg_price: number;
  last_price: number;
  deviation_pct: number;
  direction: "up" | "down";
}

interface ZeroStockReport {
  zeroStockItems: ZeroStockItem[];
  belowMinItems: BelowMinItem[];
  noPriceItems: NoPriceItem[];
}

interface ValuationData {
  items: ValuationItem[];
  lastPriceMap: Record<string, number>;
}

// Stable module-level empty defaults (avoid new array identity per render)
const EMPTY_ZERO_REPORT: ZeroStockReport = {
  zeroStockItems: [],
  belowMinItems: [],
  noPriceItems: [],
};
const EMPTY_VALUATION: ValuationData = { items: [], lastPriceMap: {} };
const EMPTY_PRICE_EVOLUTION: PricePoint[] = [];

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

// ─── Data fetchers (module-level — no TDZ) ───────────────────────────────────

async function fetchZeroStockReport(): Promise<ZeroStockReport> {
  // Itens zerados
  const { data: zeroData, error: zeroError } = await supabase
    .from('vw_stock_zero')
    .select('*')
    .order('name');
  if (zeroError) throw zeroError;

  // Itens abaixo do mínimo
  const { data: belowMinData, error: belowMinError } = await supabase
    .from('vw_stock_below_min')
    .select('*')
    .order('deficit_quantity', { ascending: false });
  if (belowMinError) throw belowMinError;

  // Itens sem preço médio
  const { data: noPriceData, error: noPriceError } = await supabase
    .from('vw_stock_no_avg_price')
    .select('*')
    .order('current_quantity', { ascending: false });
  if (noPriceError) throw noPriceError;

  const transformedNoPriceData: NoPriceItem[] = (noPriceData || []).map((item: NoPriceItem) => ({
    material_id: item.material_id,
    code: item.code || '',
    name: item.name,
    category: item.category || '',
    material_type: item.material_type,
    unit: item.unit || 'un',
    current_quantity: item.current_quantity || 0,
    average_price: item.average_price || 0,
    total_value: item.total_value || 0,
    last_movement_date: item.last_movement_date,
  }));

  return {
    zeroStockItems: (zeroData || []) as ZeroStockItem[],
    belowMinItems: (belowMinData || []) as BelowMinItem[],
    noPriceItems: transformedNoPriceData,
  };
}

async function fetchValuationData(): Promise<ValuationData> {
  // 1. Posição valorizada
  const { data: siData, error: siErr } = await supabase
    .from("stock_items")
    .select("material_id, current_quantity, average_price, total_value, last_movement_date")
    .gt("current_quantity", 0)
    .gt("average_price", 0)
    .order("total_value", { ascending: false });
  if (siErr) throw siErr;

  const materialIds = (siData || []).map(si => si.material_id);
  if (materialIds.length === 0) return { items: [], lastPriceMap: {} };

  const { data: matData, error: matErr } = await supabase
    .from("materials")
    .select("id, name, code, category, purchase_unit")
    .in("id", materialIds);
  if (matErr) throw matErr;

  const matMap: Record<string, { name: string; code: string; category: string; purchase_unit: string }> = {};
  (matData || []).forEach(m => { matMap[m.id] = m; });

  const items: ValuationItem[] = (siData || []).map(si => ({
    material_id: si.material_id,
    name: matMap[si.material_id]?.name || "—",
    code: matMap[si.material_id]?.code || "—",
    category: matMap[si.material_id]?.category || "—",
    purchase_unit: matMap[si.material_id]?.purchase_unit || "",
    current_quantity: Number(si.current_quantity) || 0,
    average_price: Number(si.average_price) || 0,
    total_value: Number(si.total_value) || Number(si.current_quantity) * Number(si.average_price) || 0,
    last_movement_date: si.last_movement_date,
  })).sort((a, b) => b.total_value - a.total_value);

  // 2. Last purchase price per material vs average_price
  const { data: mvData } = await supabase
    .from("stock_movements")
    .select("material_id, unit_price, movement_date")
    .in("movement_type", ["Entrada", "Compra"])
    .gt("unit_price", 0)
    .in("material_id", materialIds)
    .order("movement_date", { ascending: false })
    .limit(500);

  const lastPriceMap: Record<string, number> = {};
  (mvData || []).forEach(mv => {
    if (!lastPriceMap[mv.material_id]) {
      lastPriceMap[mv.material_id] = Number(mv.unit_price);
    }
  });

  return { items, lastPriceMap };
}

async function fetchPriceEvolution(materialId: string): Promise<PricePoint[]> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("movement_date, unit_price")
    .eq("material_id", materialId)
    .in("movement_type", ["Entrada", "Compra"])
    .gt("unit_price", 0)
    .order("movement_date", { ascending: true })
    .limit(100);
  if (error) throw error;

  return (data || []).map(mv => {
    const d = new Date(mv.movement_date);
    return {
      date: mv.movement_date,
      dateLabel: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }),
      price: Number(mv.unit_price),
    };
  });
}

const EstoqueRelatorios = () => {
  const [activeTab, setActiveTab] = useState("zero-stock");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [selectedNoPriceItems, setSelectedNoPriceItems] = useState<Set<string>>(new Set());
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [showAdjustPriceDialog, setShowAdjustPriceDialog] = useState(false);
  const [priceAdjustments, setPriceAdjustments] = useState<Record<string, string>>({});

  // Valorização — filtros/UI
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [deviationThreshold, setDeviationThreshold] = useState<number>(20);
  const [valuationFilter, setValuationFilter] = useState<string>("all");

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Server state via react-query ──────────────────────────────────────────
  const {
    data: zeroReport = EMPTY_ZERO_REPORT,
    isPending: loading,
    isError: zeroError,
  } = useQuery({
    queryKey: ["estoque-relatorios-zero"],
    queryFn: fetchZeroStockReport,
  });
  const { zeroStockItems, belowMinItems, noPriceItems } = zeroReport;

  const {
    data: valuation = EMPTY_VALUATION,
    isPending: valuationPending,
    isError: valuationError,
  } = useQuery({
    queryKey: ["estoque-relatorios-valuation"],
    queryFn: fetchValuationData,
    enabled: activeTab === "valuation",
  });
  const valuationItems = valuation.items;
  // react-query gives isPending=true while disabled; só é loading de fato na aba ativa
  const valuationLoading = activeTab === "valuation" && valuationPending;

  const {
    data: priceEvolution = EMPTY_PRICE_EVOLUTION,
    isPending: priceEvolutionPendingRaw,
  } = useQuery({
    queryKey: ["estoque-relatorios-price-evolution", selectedMaterialId],
    queryFn: () => fetchPriceEvolution(selectedMaterialId),
    enabled: !!selectedMaterialId,
  });
  const priceEvolutionLoading = !!selectedMaterialId && priceEvolutionPendingRaw;

  useEffect(() => {
    if (zeroError) toast.error('Erro ao carregar relatórios');
  }, [zeroError]);

  useEffect(() => {
    if (valuationError) toast.error('Erro ao carregar dados de valorização');
  }, [valuationError]);

  // Alertas de desvio — derivado client-side (recalcula ao mudar threshold)
  const deviationAlerts = useMemo<DeviationAlert[]>(() => {
    const { items, lastPriceMap } = valuation;
    return items
      .filter(it => lastPriceMap[it.material_id] !== undefined && it.average_price > 0)
      .map(it => {
        const lastPrice = lastPriceMap[it.material_id];
        const devPct = ((lastPrice - it.average_price) / it.average_price) * 100;
        return {
          material_id: it.material_id,
          name: it.name,
          code: it.code,
          avg_price: it.average_price,
          last_price: lastPrice,
          deviation_pct: devPct,
          direction: devPct >= 0 ? "up" : "down",
        } as DeviationAlert;
      })
      .filter(a => Math.abs(a.deviation_pct) >= deviationThreshold)
      .sort((a, b) => Math.abs(b.deviation_pct) - Math.abs(a.deviation_pct));
  }, [valuation, deviationThreshold]);

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
    link.setAttribute('download', `itens_zerados_${todayLocalISO()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Relatório exportado com sucesso!');
  };

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtPct = (v: number) =>
    (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

  const getFilteredItems = () => {
    return zeroStockItems.filter(item => {
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      if (filterType !== 'all' && item.material_type !== filterType) return false;
      return true;
    });
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSelectedMaterials(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredItems();
    if (selectedMaterials.size === filtered.length) {
      setSelectedMaterials(new Set());
    } else {
      setSelectedMaterials(new Set(filtered.map(item => item.material_id)));
    }
  };

  const createInventoryCycle = async () => {
    if (selectedMaterials.size === 0) {
      toast.error('Selecione ao menos um material');
      return;
    }

    setCreatingCycle(true);
    try {
      // Criar ciclo
      const cycleName = `Inventário - ${new Date().toLocaleDateString('pt-BR')}`;
      const { data: cycleId, error: cycleError } = await supabase.rpc('rpc_inventory_create_cycle', {
        p_name: cycleName,
        p_notes: `Gerado automaticamente a partir de ${selectedMaterials.size} material(is) zerado(s)`
      });

      if (cycleError) throw cycleError;

      // Adicionar materiais ao ciclo
      const { data: addedCount, error: addError } = await supabase.rpc('rpc_inventory_add_materials', {
        p_cycle_id: cycleId,
        p_material_ids: Array.from(selectedMaterials)
      });

      if (addError) throw addError;

      toast.success(`Ciclo criado com ${addedCount} materiais!`);
      
      // Navegar para o ciclo
      navigate(`/estoque/inventario-ajustes/ciclo/${cycleId}`);
    } catch (error) {
      console.error('Erro ao criar ciclo:', error);
      toast.error('Erro ao criar ciclo de inventário');
    } finally {
      setCreatingCycle(false);
    }
  };

  const toggleNoPriceSelection = (materialId: string) => {
    setSelectedNoPriceItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const toggleNoPriceSelectAll = () => {
    if (selectedNoPriceItems.size === noPriceItems.length) {
      setSelectedNoPriceItems(new Set());
    } else {
      setSelectedNoPriceItems(new Set(noPriceItems.map(item => item.material_id)));
    }
  };

  const handleAdjustPrices = () => {
    if (selectedNoPriceItems.size === 0) {
      toast.error('Selecione ao menos um material');
      return;
    }
    
    // Initialize price adjustments for selected items
    const initialPrices: Record<string, string> = {};
    noPriceItems
      .filter(item => selectedNoPriceItems.has(item.material_id))
      .forEach(item => {
        initialPrices[item.material_id] = '';
      });
    setPriceAdjustments(initialPrices);
    setShowAdjustPriceDialog(true);
  };

  const confirmPriceAdjustments = async () => {
    try {
      // Validate all prices
      const items = Object.entries(priceAdjustments)
        .filter(([_, price]) => price && price.trim() !== '')
        .map(([material_id, price]) => {
          const numPrice = parseFloat(price);
          if (isNaN(numPrice) || numPrice <= 0) {
            throw new Error(`Preço inválido: ${price}`);
          }
          return {
            material_id,
            new_avg_price: numPrice
          };
        });

      if (items.length === 0) {
        toast.error('Informe o preço médio para os itens selecionados');
        return;
      }

      // Call bulk RPC
      const { error } = await supabase.rpc('rpc_stock_set_average_price_bulk' as any, {
        p_items: items
      } as any);

      if (error) throw error;

      toast.success(`${items.length} ${items.length === 1 ? 'item atualizado' : 'itens atualizados'} com sucesso!`);

      setShowAdjustPriceDialog(false);
      setSelectedNoPriceItems(new Set());
      setPriceAdjustments({});
      queryClient.invalidateQueries({ queryKey: ["estoque-relatorios-zero"] });
      // Preço médio mudou → valorização também pode ter mudado
      queryClient.invalidateQueries({ queryKey: ["estoque-relatorios-valuation"] });
    } catch (error) {
      console.error('Erro ao ajustar preços:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao ajustar preços');
    }
  };

  const filteredItems = getFilteredItems();
  const categories = [...new Set(zeroStockItems.map(item => item.category))];
  const types = [...new Set(zeroStockItems.map(item => item.material_type))];

  return (
    <div className="max-w-7xl">
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
                    {selectedMaterials.size > 0 && (
                      <Badge variant="secondary">
                        {selectedMaterials.size} selecionado(s)
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Materiais sem registro de estoque ou com quantidade zerada
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedMaterials.size > 0 && (
                    <Button 
                      onClick={createInventoryCycle}
                      disabled={creatingCycle}
                    >
                      <ListChecks className="h-4 w-4 mr-2" />
                      {creatingCycle ? 'Criando...' : `Gerar Inventário (${selectedMaterials.size})`}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => navigate('/materiais/inventario-ajustes')}
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
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedMaterials.size === filteredItems.length && filteredItems.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
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
                        <TableRow 
                          key={item.material_id}
                          className={selectedMaterials.has(item.material_id) ? "bg-muted/50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedMaterials.has(item.material_id)}
                              onCheckedChange={() => toggleMaterialSelection(item.material_id)}
                            />
                          </TableCell>
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

        <TabsContent value="below-min">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Materiais Abaixo do Mínimo
                    <Badge variant="secondary">{belowMinItems.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Materiais com estoque atual abaixo da quantidade mínima configurada
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/materiais/inventario-ajustes")}
                >
                  Ir para Inventário
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-amber-600">{belowMinItems.length}</div>
                    <p className="text-xs text-muted-foreground">Itens Abaixo do Mínimo</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {fmtBRL(belowMinItems.reduce((s, i) => s + (i.estimated_cost || 0), 0))}
                    </div>
                    <p className="text-xs text-muted-foreground">Custo Estimado p/ Reposição</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {belowMinItems.reduce((s, i) => s + (i.deficit_quantity || 0), 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total de Déficit (unidades)</p>
                  </CardContent>
                </Card>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : belowMinItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Todos os materiais estão dentro do estoque mínimo
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Qtd Atual</TableHead>
                        <TableHead className="text-right">Qtd Mínima</TableHead>
                        <TableHead className="text-right">Déficit</TableHead>
                        <TableHead className="text-right">Custo Estimado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {belowMinItems.map(item => (
                        <TableRow key={item.material_id}>
                          <TableCell className="font-mono text-sm">{item.code}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{item.category}</div>
                              {item.subcategory && (
                                <div className="text-xs text-muted-foreground">{item.subcategory}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {(item.current_quantity || 0).toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">
                            {(item.minimum_quantity || 0).toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-amber-100 text-amber-800">
                              {(item.deficit_quantity || 0).toFixed(3)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.estimated_cost ? fmtBRL(item.estimated_cost) : "—"}
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

        <TabsContent value="no-price">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Materiais sem Preço Médio
                  </CardTitle>
                  <CardDescription>
                    Materiais sem custo definido - necessário ajuste para inicialização
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedNoPriceItems.size > 0 && (
                    <Badge variant="secondary" className="mr-2">
                      {selectedNoPriceItems.size} selecionado(s)
                    </Badge>
                  )}
                  <Button
                    onClick={handleAdjustPrices}
                    disabled={selectedNoPriceItems.size === 0}
                  >
                    Ajustar Preço Médio
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{noPriceItems.length}</div>
                    <p className="text-xs text-muted-foreground">Sem Preço Médio</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {noPriceItems.filter(i => (i.current_quantity || 0) > 0).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Com Estoque</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {noPriceItems.filter(i => (i.current_quantity || 0) === 0).length}
                    </div>
                    <p className="text-xs text-muted-foreground">Sem Estoque</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : noPriceItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Todos os materiais possuem preço médio definido
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedNoPriceItems.size === noPriceItems.length && noPriceItems.length > 0}
                            onCheckedChange={toggleNoPriceSelectAll}
                          />
                        </TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Qtd Atual</TableHead>
                        <TableHead className="text-right">Preço Médio</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {noPriceItems.map(item => (
                        <TableRow key={item.material_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedNoPriceItems.has(item.material_id)}
                              onCheckedChange={() => toggleNoPriceSelection(item.material_id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.code}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm">{item.category}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getMaterialTypeLabel(item.material_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.unit}</TableCell>
                          <TableCell className="text-right">
                            {(item.current_quantity || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            R$ 0,00
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={(item.current_quantity || 0) > 0 ? "default" : "secondary"}>
                              {(item.current_quantity || 0) > 0 ? 'Com Estoque' : 'Sem Estoque'}
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

        <TabsContent value="valuation" className="space-y-6">
          {valuationLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-primary">
                      {fmtBRL(valuationItems.reduce((s, i) => s + i.total_value, 0))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Valor Total em Estoque</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{valuationItems.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Materiais Valorizados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className={`text-2xl font-bold ${deviationAlerts.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {deviationAlerts.length}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Alertas de Desvio ≥{deviationThreshold}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-lg font-bold truncate">
                      {valuationItems[0]?.name || "—"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Maior Custo em Estoque</p>
                  </CardContent>
                </Card>
              </div>

              {/* Alertas de Desvio */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-5 w-5 text-amber-500" />
                        Alertas de Variação de Preço
                      </CardTitle>
                      <CardDescription>
                        Materiais cuja última compra desviou do preço médio acima do limite configurado
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Limite de desvio:</span>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={deviationThreshold}
                        onChange={e => setDeviationThreshold(Math.max(1, Math.min(100, Number(e.target.value))))}
                        className="w-20 text-center"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {deviationAlerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum material com desvio ≥ {deviationThreshold}% detectado
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">Preço Médio</TableHead>
                            <TableHead className="text-right">Última Compra</TableHead>
                            <TableHead className="text-right">Variação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deviationAlerts.map(alert => (
                            <TableRow key={alert.material_id}>
                              <TableCell className="font-mono text-sm">{alert.code}</TableCell>
                              <TableCell className="font-medium">{alert.name}</TableCell>
                              <TableCell className="text-right">{fmtBRL(alert.avg_price)}</TableCell>
                              <TableCell className="text-right">{fmtBRL(alert.last_price)}</TableCell>
                              <TableCell className="text-right">
                                <Badge className={
                                  alert.direction === "up"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800"
                                }>
                                  {alert.direction === "up"
                                    ? <TrendingUp className="h-3 w-3 mr-1 inline" />
                                    : <TrendingDown className="h-3 w-3 mr-1 inline" />
                                  }
                                  {fmtPct(alert.deviation_pct)}
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

              {/* Evolução de Preço por Material */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileBarChart className="h-5 w-5" />
                    Evolução de Preço por Material
                  </CardTitle>
                  <CardDescription>
                    Histórico de preço de compra registrado nas entradas de estoque
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="Selecione um material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {valuationItems.map(it => (
                        <SelectItem key={it.material_id} value={it.material_id}>
                          [{it.code}] {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedMaterialId && (
                    <>
                      {priceEvolutionLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                      ) : priceEvolution.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhuma entrada de preço registrada para este material
                        </div>
                      ) : (
                        <>
                          {/* Stat bar */}
                          {(() => {
                            const prices = priceEvolution.map(p => p.price);
                            const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            const last = prices[prices.length - 1];
                            const devFromAvg = ((last - avg) / avg) * 100;
                            return (
                              <div className="grid grid-cols-4 gap-3 text-sm">
                                {[
                                  { label: "Mínimo", value: fmtBRL(min) },
                                  { label: "Máximo", value: fmtBRL(max) },
                                  { label: "Média histórica", value: fmtBRL(avg) },
                                  { label: "Último vs. média", value: fmtPct(devFromAvg), highlight: Math.abs(devFromAvg) >= deviationThreshold },
                                ].map(stat => (
                                  <div key={stat.label} className="bg-muted/50 rounded-lg p-3">
                                    <div className={`font-bold text-base ${stat.highlight ? "text-amber-600" : ""}`}>{stat.value}</div>
                                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={priceEvolution} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                  dataKey="dateLabel"
                                  tick={{ fontSize: 11 }}
                                  interval="preserveStartEnd"
                                />
                                <YAxis
                                  tick={{ fontSize: 11 }}
                                  tickFormatter={v => `R$${Number(v).toFixed(2)}`}
                                  width={70}
                                />
                                <RechartsTooltip
                                  formatter={(v: number) => [fmtBRL(v), "Preço de compra"]}
                                  labelFormatter={label => `Data: ${label}`}
                                />
                                {priceEvolution.length > 0 && (() => {
                                  const avg = priceEvolution.reduce((s, p) => s + p.price, 0) / priceEvolution.length;
                                  return (
                                    <ReferenceLine
                                      y={avg}
                                      stroke="hsl(var(--muted-foreground))"
                                      strokeDasharray="4 4"
                                      label={{ value: `Média: ${fmtBRL(avg)}`, position: "insideTopRight", fontSize: 11 }}
                                    />
                                  );
                                })()}
                                <Line
                                  type="monotone"
                                  dataKey="price"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Posição Valorizada */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle>Posição de Estoque Valorizada</CardTitle>
                      <CardDescription>
                        {valuationItems.length} materiais · Total:{" "}
                        {fmtBRL(valuationItems.reduce((s, i) => s + i.total_value, 0))}
                      </CardDescription>
                    </div>
                    <Select value={valuationFilter} onValueChange={setValuationFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {[...new Set(valuationItems.map(i => i.category))].sort().map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {valuationItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum item valorizado encontrado
                    </div>
                  ) : (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Material</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Un.</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Preço Médio</TableHead>
                            <TableHead className="text-right">Valor Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {valuationItems
                            .filter(it => valuationFilter === "all" || it.category === valuationFilter)
                            .map(it => (
                              <TableRow key={it.material_id}>
                                <TableCell className="font-mono text-sm">{it.code}</TableCell>
                                <TableCell className="font-medium">{it.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{it.category}</TableCell>
                                <TableCell className="text-sm">{it.purchase_unit}</TableCell>
                                <TableCell className="text-right">{it.current_quantity.toFixed(3)}</TableCell>
                                <TableCell className="text-right">{fmtBRL(it.average_price)}</TableCell>
                                <TableCell className="text-right font-medium">{fmtBRL(it.total_value)}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Ajuste de Preço Médio */}
      <Dialog open={showAdjustPriceDialog} onOpenChange={setShowAdjustPriceDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajustar Preço Médio</DialogTitle>
            <DialogDescription>
              Defina o preço médio para os {selectedNoPriceItems.size} {selectedNoPriceItems.size === 1 ? 'item selecionado' : 'itens selecionados'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Qtd Atual</TableHead>
                  <TableHead className="text-right w-[200px]">Novo Preço Médio (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noPriceItems
                  .filter(item => selectedNoPriceItems.has(item.material_id))
                  .map(item => (
                    <TableRow key={item.material_id}>
                      <TableCell className="font-mono text-sm">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {(item.current_quantity || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={priceAdjustments[item.material_id] || ''}
                          onChange={(e) => setPriceAdjustments(prev => ({
                            ...prev,
                            [item.material_id]: e.target.value
                          }))}
                          className="text-right"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustPriceDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmPriceAdjustments}>
              Confirmar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EstoqueRelatorios;
