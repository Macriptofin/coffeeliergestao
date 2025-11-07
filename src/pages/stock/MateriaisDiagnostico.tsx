import { useEffect } from "react";
import { useMaterialsDiagnostics } from "@/hooks/useMaterialsDiagnostics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  FileText,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

const MateriaisDiagnostico = () => {
  const { loading, diagnostics, error, runDiagnostics } = useMaterialsDiagnostics();
  const navigate = useNavigate();

  useEffect(() => {
    runDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Analisando materiais...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Comparando dados atuais com referência PRODUTOS_LIMPOS.csv
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!diagnostics) return null;

  const healthPercentage = diagnostics.total_materials > 0
    ? Math.round(((diagnostics.total_materials - diagnostics.materials_with_issues) / diagnostics.total_materials) * 100)
    : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Diagnóstico de Materiais</h1>
        <p className="text-muted-foreground">
          Análise comparativa entre dados atuais e estrutura de referência
        </p>
      </div>

      {/* Card de Saúde Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saúde do Sistema</CardTitle>
              <CardDescription>
                {diagnostics.materials_with_issues === 0 
                  ? "Sistema íntegro e consistente"
                  : `${diagnostics.materials_with_issues} materiais precisam de correção`
                }
              </CardDescription>
            </div>
            {diagnostics.materials_with_issues === 0 ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : (
              <AlertTriangle className="h-12 w-12 text-orange-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Integridade dos Dados</span>
              <span className="font-medium">{healthPercentage}%</span>
            </div>
            <Progress value={healthPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{diagnostics.total_materials}</div>
              <div className="text-xs text-muted-foreground mt-1">Total de Materiais</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {diagnostics.total_materials - diagnostics.materials_with_issues}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Corretos</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {diagnostics.materials_with_issues}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Com Problemas</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {diagnostics.discrepancies.reduce((acc, d) => acc + d.issues.length, 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Issues Totais</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Resumo de Problemas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resumo de Problemas por Tipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Tipo Operacional Incorreto</div>
                <div className="text-sm text-muted-foreground">material_type precisa correção</div>
              </div>
              <Badge variant={diagnostics.summary.material_type_issues > 0 ? "destructive" : "secondary"}>
                {diagnostics.summary.material_type_issues}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Categoria Comercial Incorreta</div>
                <div className="text-sm text-muted-foreground">category precisa atualização</div>
              </div>
              <Badge variant={diagnostics.summary.category_issues > 0 ? "destructive" : "secondary"}>
                {diagnostics.summary.category_issues}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Subcategoria Ausente/Incorreta</div>
                <div className="text-sm text-muted-foreground">subcategory precisa definição</div>
              </div>
              <Badge variant={diagnostics.summary.subcategory_issues > 0 ? "default" : "secondary"}>
                {diagnostics.summary.subcategory_issues}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="font-medium">Código com Prefixo Incorreto</div>
                <div className="text-sm text-muted-foreground">Prefixo obsoleto ou inválido</div>
              </div>
              <Badge variant={diagnostics.summary.code_prefix_issues > 0 ? "default" : "secondary"}>
                {diagnostics.summary.code_prefix_issues}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      {diagnostics.materials_with_issues > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
            <CardDescription>
              Recomendamos revisar e corrigir os materiais com problemas antes de prosseguir
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              onClick={() => navigate('/stock/materiais-problemas')}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Ir para Limpeza de Materiais
            </Button>
            <Button
              variant="outline"
              onClick={runDiagnostics}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reanalizar
            </Button>
          </CardContent>
        </Card>
      )}

      {diagnostics.materials_with_issues === 0 && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Parabéns!</strong> Todos os materiais estão consistentes com a estrutura de referência.
            Não há necessidade de correções no momento.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default MateriaisDiagnostico;
