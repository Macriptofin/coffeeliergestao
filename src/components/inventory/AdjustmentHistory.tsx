import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Calculator, Search, Filter, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InventoryAdjustment {
  id: string;
  material_name: string;
  adjustment_date: string;
  adjustment_time: string;
  system_quantity: number;
  physical_quantity: number;
  quantity_difference: number;
  adjustment_reason: string;
  reference_document?: string;
  responsible_user_id?: string;
  notes?: string;
  created_at: string;
  usage_unit: string;
}

interface CostAdjustment {
  id: string;
  material_name: string;
  adjustment_date: string;
  adjustment_time: string;
  old_unit_cost: number;
  new_unit_cost: number;
  cost_difference: number;
  current_quantity: number;
  old_total_value: number;
  new_total_value: number;
  adjustment_reason: string;
  reference_document?: string;
  responsible_user_id?: string;
  notes?: string;
  created_at: string;
  usage_unit: string;
}

export const AdjustmentHistory = () => {
  const [inventoryAdjustments, setInventoryAdjustments] = useState<InventoryAdjustment[]>([]);
  const [costAdjustments, setCostAdjustments] = useState<CostAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadAdjustments();
  }, []);

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      // Load inventory adjustments with material data
      const { data: inventoryData, error: inventoryError } = await supabase
        .from("inventory_adjustments")
        .select("*")
        .order("created_at", { ascending: false });

      if (inventoryError) throw inventoryError;

      // Load cost adjustments
      const { data: costData, error: costError } = await supabase
        .from("cost_adjustments")
        .select("*")
        .order("created_at", { ascending: false });

      if (costError) throw costError;

      // Get all unique material IDs
      const materialIds = [
        ...new Set([
          ...(inventoryData?.map(item => item.material_id) || []),
          ...(costData?.map(item => item.material_id) || [])
        ])
      ];

      // Load materials data
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("id, name, usage_unit")
        .in("id", materialIds);

      if (materialsError) throw materialsError;

      // Create a map for quick lookup
      const materialsMap = new Map(
        materialsData?.map(material => [material.id, material]) || []
      );

      setInventoryAdjustments(
        inventoryData?.map(item => ({
          ...item,
          material_name: materialsMap.get(item.material_id)?.name || "Material não encontrado",
          usage_unit: materialsMap.get(item.material_id)?.usage_unit || "UN"
        })) || []
      );

      setCostAdjustments(
        costData?.map(item => ({
          ...item,
          material_name: materialsMap.get(item.material_id)?.name || "Material não encontrado",
          usage_unit: materialsMap.get(item.material_id)?.usage_unit || "UN"
        })) || []
      );
    } catch (error) {
      console.error("Error loading adjustments:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico de ajustes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (date: string, time: string) => {
    return `${format(new Date(date), "dd/MM/yyyy", { locale: ptBR })} ${time.slice(0, 5)}`;
  };

  const filterInventoryData = inventoryAdjustments.filter(item => {
    const matchesSearch = item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.adjustment_reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterReason || filterReason === "all" || item.adjustment_reason.toLowerCase().includes(filterReason.toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const filterCostData = costAdjustments.filter(item => {
    const matchesSearch = item.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.adjustment_reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterReason || filterReason === "all" || item.adjustment_reason.toLowerCase().includes(filterReason.toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const getQuantityBadge = (difference: number, unit: string) => {
    const isPositive = difference > 0;
    return (
      <Badge className={isPositive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {isPositive ? '+' : ''}{difference.toFixed(2)} {unit}
      </Badge>
    );
  };

  const getCostBadge = (difference: number) => {
    const isPositive = difference > 0;
    return (
      <Badge className={isPositive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {isPositive ? '+' : ''}{formatCurrency(difference)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Carregando histórico...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por material ou motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="w-full md:w-64">
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motivos</SelectItem>
                  <SelectItem value="inventário">Inventário</SelectItem>
                  <SelectItem value="correção">Correção</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="preço">Preço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterReason("all"); }}>
              <Filter className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Ajustes de Quantidade ({filterInventoryData.length})
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Ajustes de Custo ({filterCostData.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Ajustes de Quantidade</CardTitle>
              <CardDescription>
                Registro completo de todos os ajustes de inventário físico realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Qtd. Sistema</TableHead>
                      <TableHead>Qtd. Física</TableHead>
                      <TableHead>Diferença</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Documento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterInventoryData.map((adjustment) => (
                      <TableRow key={adjustment.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDateTime(adjustment.adjustment_date, adjustment.adjustment_time)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {adjustment.material_name}
                        </TableCell>
                        <TableCell>
                          {adjustment.system_quantity} {adjustment.usage_unit}
                        </TableCell>
                        <TableCell>
                          {adjustment.physical_quantity} {adjustment.usage_unit}
                        </TableCell>
                        <TableCell>
                          {getQuantityBadge(adjustment.quantity_difference, adjustment.usage_unit)}
                        </TableCell>
                        <TableCell>{adjustment.adjustment_reason}</TableCell>
                        <TableCell>
                          {adjustment.reference_document ? (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              {adjustment.reference_document}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filterInventoryData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum ajuste de quantidade encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Ajustes de Custo</CardTitle>
              <CardDescription>
                Registro completo de todas as alterações de custo unitário realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Custo Anterior</TableHead>
                      <TableHead>Novo Custo</TableHead>
                      <TableHead>Diferença</TableHead>
                      <TableHead>Qtd. Estoque</TableHead>
                      <TableHead>Impacto Total</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Documento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterCostData.map((adjustment) => (
                      <TableRow key={adjustment.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDateTime(adjustment.adjustment_date, adjustment.adjustment_time)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {adjustment.material_name}
                        </TableCell>
                        <TableCell>{formatCurrency(adjustment.old_unit_cost)}</TableCell>
                        <TableCell>{formatCurrency(adjustment.new_unit_cost)}</TableCell>
                        <TableCell>
                          {getCostBadge(adjustment.cost_difference)}
                        </TableCell>
                        <TableCell>
                          {adjustment.current_quantity} {adjustment.usage_unit}
                        </TableCell>
                        <TableCell>
                          {getCostBadge(adjustment.new_total_value - adjustment.old_total_value)}
                        </TableCell>
                        <TableCell>{adjustment.adjustment_reason}</TableCell>
                        <TableCell>
                          {adjustment.reference_document ? (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              {adjustment.reference_document}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filterCostData.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum ajuste de custo encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};