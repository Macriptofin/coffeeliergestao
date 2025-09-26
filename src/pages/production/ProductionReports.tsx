import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, TrendingUp, BarChart3, Calendar } from "lucide-react";

const ProductionReports = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");
  const [selectedReport, setSelectedReport] = useState("production-summary");

  // Mock data for demonstration
  const productionSummary = [
    { recipe: 'Bolo de Chocolate', produced: 25, unit: 'unidades', cost: 312.50 },
    { recipe: 'Brigadeiros Gourmet', produced: 200, unit: 'unidades', cost: 180.00 },
    { recipe: 'Torta de Limão', produced: 12, unit: 'unidades', cost: 144.00 },
    { recipe: 'Cupcakes Variados', produced: 80, unit: 'unidades', cost: 240.00 }
  ];

  const materialConsumption = [
    { material: 'Farinha de Trigo', consumed: 15.5, unit: 'kg', cost: 62.00 },
    { material: 'Açúcar Cristal', consumed: 8.2, unit: 'kg', cost: 32.80 },
    { material: 'Ovos', consumed: 120, unit: 'unidades', cost: 48.00 },
    { material: 'Manteiga', consumed: 3.8, unit: 'kg', cost: 76.00 }
  ];

  const costAnalysis = [
    { 
      order: 'OP-001', 
      recipe: 'Bolo de Chocolate', 
      standardCost: 12.50, 
      actualCost: 13.20, 
      variance: 0.70,
      status: 'Acima do padrão'
    },
    { 
      order: 'OP-002', 
      recipe: 'Brigadeiros Gourmet', 
      standardCost: 0.90, 
      actualCost: 0.85, 
      variance: -0.05,
      status: 'Abaixo do padrão'
    }
  ];

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600';
    if (variance < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  const getVarianceBadge = (status: string) => {
    if (status === 'Acima do padrão') return 'bg-red-100 text-red-800';
    if (status === 'Abaixo do padrão') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Relatórios de Produção</h1>
          <p className="text-muted-foreground">Performance, eficiência e análises de produção</p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Mês Atual</SelectItem>
                  <SelectItem value="last-month">Mês Anterior</SelectItem>
                  <SelectItem value="current-quarter">Trimestre Atual</SelectItem>
                  <SelectItem value="custom">Período Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo de Relatório</label>
              <Select value={selectedReport} onValueChange={setSelectedReport}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production-summary">Resumo de Produção</SelectItem>
                  <SelectItem value="material-consumption">Consumo de Materiais</SelectItem>
                  <SelectItem value="cost-analysis">Análise de Custos</SelectItem>
                  <SelectItem value="efficiency">Eficiência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button className="w-full">
                <BarChart3 className="h-4 w-4 mr-2" />
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Summary Report */}
      {selectedReport === 'production-summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Produção por Receita
              </CardTitle>
              <CardDescription>Quantidade produzida no período selecionado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productionSummary.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.recipe}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.produced} {item.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">R$ {item.cost.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo Geral</CardTitle>
              <CardDescription>Indicadores do período</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de Ordens:</span>
                  <span className="font-medium">15</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ordens Concluídas:</span>
                  <span className="font-medium text-green-600">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Em Produção:</span>
                  <span className="font-medium text-yellow-600">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Canceladas:</span>
                  <span className="font-medium text-red-600">1</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo Total:</span>
                  <span className="font-bold text-primary">R$ 876,50</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Material Consumption Report */}
      {selectedReport === 'material-consumption' && (
        <Card>
          <CardHeader>
            <CardTitle>Consumo de Materiais</CardTitle>
            <CardDescription>Materiais consumidos na produção do período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Material</th>
                    <th className="text-left py-2">Quantidade</th>
                    <th className="text-left py-2">Unidade</th>
                    <th className="text-right py-2">Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {materialConsumption.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 font-medium">{item.material}</td>
                      <td className="py-3">{item.consumed}</td>
                      <td className="py-3">{item.unit}</td>
                      <td className="py-3 text-right font-medium">
                        R$ {item.cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Analysis Report */}
      {selectedReport === 'cost-analysis' && (
        <Card>
          <CardHeader>
            <CardTitle>Análise de Custos (Padrão x Real)</CardTitle>
            <CardDescription>Comparação entre custos padrão e reais por ordem de produção</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Ordem</th>
                    <th className="text-left py-2">Receita</th>
                    <th className="text-right py-2">Custo Padrão</th>
                    <th className="text-right py-2">Custo Real</th>
                    <th className="text-right py-2">Variação</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {costAnalysis.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 font-medium">{item.order}</td>
                      <td className="py-3">{item.recipe}</td>
                      <td className="py-3 text-right">R$ {item.standardCost.toFixed(2)}</td>
                      <td className="py-3 text-right">R$ {item.actualCost.toFixed(2)}</td>
                      <td className={`py-3 text-right font-medium ${getVarianceColor(item.variance)}`}>
                        R$ {item.variance.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <Badge className={getVarianceBadge(item.status)}>
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Efficiency Report */}
      {selectedReport === 'efficiency' && (
        <Card>
          <CardHeader>
            <CardTitle>Relatório de Eficiência</CardTitle>
            <CardDescription>Indicadores de performance e eficiência</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4" />
              <p>Funcionalidade em desenvolvimento</p>
              <p className="text-sm">Em breve você terá acesso a relatórios detalhados de eficiência</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductionReports;