import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { usePricingAnalysis } from "@/hooks/usePricingAnalysis";
import { AlertCircle, CheckCircle, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const PricingHealthDashboard = () => {
  const { analyzeSystemHealth, loading } = usePricingAnalysis();
  const [health, setHealth] = useState<any>(null);

  const loadHealth = async () => {
    const result = await analyzeSystemHealth();
    if (result.success) {
      setHealth(result);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  if (loading && !health) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">Excelente</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500">Atenção</Badge>;
    return <Badge variant="destructive">Crítico</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saúde do Sistema de Precificação</CardTitle>
              <CardDescription>
                Análise geral de preços médios e conversões de unidades
              </CardDescription>
            </div>
            <Button onClick={loadHealth} disabled={loading} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Geral */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score de Saúde</span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getHealthColor(health.health_score)}`}>
                  {health.health_score?.toFixed(0)}%
                </span>
                {getHealthBadge(health.health_score)}
              </div>
            </div>
            <Progress value={health.health_score} className="h-2" />
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{health.summary?.total_materials || 0}</div>
                <p className="text-xs text-muted-foreground">Total de Materiais</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  {health.summary?.materials_with_stock || 0}
                </div>
                <p className="text-xs text-muted-foreground">Com Estoque</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">
                  {health.summary?.materials_no_price || 0}
                </div>
                <p className="text-xs text-muted-foreground">Sem Preço</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">
                  {health.summary?.materials_no_movement || 0}
                </div>
                <p className="text-xs text-muted-foreground">Sem Movimentação</p>
              </CardContent>
            </Card>
          </div>

          {/* Recomendações */}
          {health.recommendations && health.recommendations.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Recomendações</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {health.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} className="text-sm">
                      {rec}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Materiais Problemáticos */}
          {health.problem_materials && health.problem_materials.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Materiais que Necessitam Atenção</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {health.problem_materials.slice(0, 20).map((material: any) => (
                  <Alert key={material.material_id} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-medium">
                      {material.material_name}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      <div className="flex items-center justify-between mt-1">
                        <span>Problema: {material.issue}</span>
                        <Badge variant="outline" className="text-xs">
                          Qtd: {material.current_quantity} | Preço: R${" "}
                          {material.average_price.toFixed(4)}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
              {health.problem_materials.length > 20 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... e mais {health.problem_materials.length - 20} materiais
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
