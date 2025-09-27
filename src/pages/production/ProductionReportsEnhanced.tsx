import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSearchParams } from "react-router-dom";

const ProductionReports = () => {
  const { flags } = useFeatureFlags();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPeriod, setSelectedPeriod] = useState("last-30-days");
  const [selectedReport, setSelectedReport] = useState("production-summary");
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || "relatorios");
  const [costData, setCostData] = useState<any[]>([]);

  // Mock data for the reports
  const productionSummary = [
    { recipe: "Brigadeiro Gourmet", quantity: 250, unit: "unidade", cost: 125.50 },
    { recipe: "Brownie Premium", quantity: 180, unit: "fatia", cost: 240.75 },
    { recipe: "Cheesecake Individual", quantity: 120, unit: "unidade", cost: 360.00 },
    { recipe: "Torta Holandesa", quantity: 45, unit: "fatia", cost: 337.50 },
    { recipe: "Mousse de Chocolate", quantity: 200, unit: "porção", cost: 180.00 }
  ];

  const materialConsumption = [
    { material: "Chocolate Belga 70%", consumed: 5.5, unit: "kg", cost: 275.00 },
    { material: "Cream Cheese Philadelphia", consumed: 8.2, unit: "kg", cost: 123.00 },
    { material: "Ovos Orgânicos", consumed: 180, unit: "unidade", cost: 90.00 },
    { material: "Açúcar Cristal", consumed: 12.3, unit: "kg", cost: 49.20 },
    { material: "Farinha de Trigo Especial", consumed: 15.7, unit: "kg", cost: 62.80 }
  ];

  const costAnalysis = [
    { order: "ORD-001", recipe: "Brigadeiro Gourmet", standardCost: 125.50, actualCost: 132.75, variance: 5.8, status: "Acima do Esperado" },
    { order: "ORD-002", recipe: "Brownie Premium", standardCost: 240.75, actualCost: 235.20, variance: -2.3, status: "Dentro do Padrão" },
    { order: "ORD-003", recipe: "Cheesecake Individual", standardCost: 360.00, actualCost: 380.15, variance: 5.6, status: "Acima do Esperado" },
    { order: "ORD-004", recipe: "Torta Holandesa", standardCost: 337.50, actualCost: 315.80, variance: -6.4, status: "Abaixo do Esperado" }
  ];

  useEffect(() => {
    if (flags.FF_MOVE_COSTS_TO_REPORTS) {
      loadCostData();
    }
  }, [flags.FF_MOVE_COSTS_TO_REPORTS]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadCostData = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_ingredients (
            quantity,
            material_id,
            materials (name, purchase_unit, price_per_purchase_unit)
          )
        `);
      
      if (error) throw error;
      setCostData(data || []);
    } catch (error) {
      console.error('Error loading cost data:', error);
      toast.error('Erro ao carregar dados de custos');
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 10) return "text-red-600";
    if (variance < -10) return "text-green-600";
    return "text-yellow-600";
  };

  const getVarianceBadge = (status: string) => {
    switch (status) {
      case "Dentro do Padrão":
        return <Badge variant="default" className="bg-green-500">Dentro do Padrão</Badge>;
      case "Acima do Esperado":
        return <Badge variant="destructive">Acima do Esperado</Badge>;
      case "Abaixo do Esperado":
        return <Badge variant="secondary">Abaixo do Esperado</Badge>;
      default:
        return <Badge variant="outline">Indefinido</Badge>;
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

  if (!flags.FF_MOVE_COSTS_TO_REPORTS) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Relatórios de Produção</h1>
            <p className="text-muted-foreground">Análise de performance e eficiência</p>
          </div>
          <Button onClick={() => toast.success("Relatório exportado com sucesso!")}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium">Período</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-7-days">Últimos 7 dias</SelectItem>
                <SelectItem value="last-30-days">Últimos 30 dias</SelectItem>
                <SelectItem value="last-90-days">Últimos 90 dias</SelectItem>
                <SelectItem value="this-year">Este ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Relatório</label>
            <Select value={selectedReport} onValueChange={setSelectedReport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production-summary">Resumo de Produção</SelectItem>
                <SelectItem value="material-consumption">Consumo de Materiais</SelectItem>
                <SelectItem value="cost-analysis">Análise de Custos</SelectItem>
                <SelectItem value="efficiency-report">Relatório de Eficiência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button className="mb-6">
          <FileText className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>

        {selectedReport === "production-summary" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Produção por Receita</CardTitle>
                <CardDescription>Quantidade produzida no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receita</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Unidade</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionSummary.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.recipe}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.unit}</TableCell>
                          <TableCell className="text-right">R$ {item.cost.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Produzido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">795 itens</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Custo Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">R$ 1.343,75</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Eficiência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">92%</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {selectedReport === "material-consumption" && (
          <Card>
            <CardHeader>
              <CardTitle>Consumo de Materiais</CardTitle>
              <CardDescription>Materiais consumidos no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Quantidade Consumida</TableHead>
                      <TableHead className="text-right">Unidade</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialConsumption.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.material}</TableCell>
                        <TableCell className="text-right">{item.consumed}</TableCell>
                        <TableCell className="text-right">{item.unit}</TableCell>
                        <TableCell className="text-right">R$ {item.cost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedReport === "cost-analysis" && (
          <Card>
            <CardHeader>
              <CardTitle>Análise de Custos</CardTitle>
              <CardDescription>Comparativo entre custo padrão e realizado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Receita</TableHead>
                      <TableHead className="text-right">Custo Padrão</TableHead>
                      <TableHead className="text-right">Custo Realizado</TableHead>
                      <TableHead className="text-right">Variação (%)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costAnalysis.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.order}</TableCell>
                        <TableCell>{item.recipe}</TableCell>
                        <TableCell className="text-right">R$ {item.standardCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {item.actualCost.toFixed(2)}</TableCell>
                        <TableCell className={`text-right ${getVarianceColor(item.variance)}`}>
                          {item.variance > 0 ? '+' : ''}{item.variance.toFixed(1)}%
                        </TableCell>
                        <TableCell>{getVarianceBadge(item.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedReport === "efficiency-report" && (
          <Card>
            <CardHeader>
              <CardTitle>Relatório de Eficiência</CardTitle>
              <CardDescription>Em desenvolvimento...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Este relatório está sendo desenvolvido e estará disponível em breve.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

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