import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePricingAnalysis } from "@/hooks/usePricingAnalysis";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface CostSourceData {
  material_type: string;
  cost_source: string;
  count: number;
}

const costSourceLabels: Record<string, string> = {
  purchase: "Compra",
  production: "Produção",
  manual: "Manual"
};

const materialTypeLabels: Record<string, string> = {
  raw_material: "Insumo",
  packaging: "Embalagem",
  intermediate_product: "Produto Intermediário",
  finished_product: "Produto Acabado",
  composite_product: "Produto Composto",
  resale_product: "Produto de Revenda"
};

export const CostSourceSummary = () => {
  const { getCostSourceSummary, loading } = usePricingAnalysis();
  const [summary, setSummary] = useState<CostSourceData[]>([]);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const data = await getCostSourceSummary();
      setSummary((data || []) as CostSourceData[]);
    } catch (error) {
      console.error("Erro ao carregar resumo:", error);
    }
  };

  const getCostSourceVariant = (source: string) => {
    switch (source) {
      case "purchase":
        return "default";
      case "production":
        return "secondary";
      case "manual":
        return "outline";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem de Custos por Tipo de Material</CardTitle>
        <CardDescription>
          Resumo da classificação de origem de custos após migração
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum dado disponível
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Material</TableHead>
                <TableHead>Origem do Custo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    {materialTypeLabels[row.material_type] || row.material_type}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getCostSourceVariant(row.cost_source)}>
                      {costSourceLabels[row.cost_source] || row.cost_source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
