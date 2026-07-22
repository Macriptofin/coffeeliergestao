import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

const ProductionReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "relatorios");
  const [costData, setCostData] = useState<any[]>([]);

  useEffect(() => {
    loadCostData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadCostData = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes_bom')
        .select(`
          id,
          yield_quantity,
          yield_unit,
          cached_total_cost,
          materials:finished_material_id (
            name,
            category,
            suggested_price,
            practiced_price
          )
        `)
        .eq('is_archived', false);

      if (error) throw error;

      const rows = (data || []).map((recipe: any) => {
        const totalCost = Number(recipe.cached_total_cost) || 0;
        const yieldAmount = Number(recipe.yield_quantity) || 0;
        const unitCost = yieldAmount > 0 ? totalCost / yieldAmount : 0;
        const price = Number(recipe.materials?.practiced_price ?? recipe.materials?.suggested_price) || 0;
        return {
          id: recipe.id,
          name: recipe.materials?.name || '—',
          category: recipe.materials?.category || '—',
          yield_amount: yieldAmount,
          yield_unit: recipe.yield_unit,
          total_cost: totalCost,
          suggested_price: price || null,
          profit_margin: price > 0 ? ((price - unitCost) / price) * 100 : null,
        };
      });

      setCostData(rows);
    } catch (error) {
      console.error('Error loading cost data:', error);
      toast.error('Erro ao carregar dados de custos');
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === "relatorios") {
        newParams.delete('tab');
      } else {
        newParams.set('tab', value);
      }
      return newParams;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Relatórios</h1>
          <p className="text-muted-foreground">Performance, custos e análises</p>
        </div>
        <Button onClick={() => toast.success("Relatório exportado com sucesso!")}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios de Produção
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Análise de Custos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="relatorios" className="space-y-6">
          {/* ... resto do código do relatório de produção ... */}
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Análise de Custos de Produção
              </CardTitle>
              <CardDescription>
                Custos padrão por produto com base nas receitas cadastradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Rendimento</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">Custo/Unidade</TableHead>
                      <TableHead className="text-right">Preço Sugerido</TableHead>
                      <TableHead className="text-right">Margem (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costData.map((recipe) => (
                      <TableRow key={recipe.id}>
                        <TableCell className="font-medium">{recipe.name}</TableCell>
                        <TableCell>{recipe.category}</TableCell>
                        <TableCell>
                          {recipe.yield_amount} {recipe.yield_unit}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {recipe.total_cost ? Number(recipe.total_cost).toFixed(2) : '0,00'}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {recipe.total_cost && recipe.yield_amount 
                            ? (Number(recipe.total_cost) / recipe.yield_amount).toFixed(2) 
                            : '0,00'}
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {recipe.suggested_price ? Number(recipe.suggested_price).toFixed(2) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {recipe.profit_margin ? `${Number(recipe.profit_margin).toFixed(1)}%` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionReports;