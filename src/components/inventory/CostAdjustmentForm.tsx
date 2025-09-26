import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MaterialSelect } from "@/components/MaterialSelect";

const costAdjustmentSchema = z.object({
  materialId: z.string().min(1, "Selecione um material"),
  newUnitCost: z.number().min(0.01, "Custo deve ser maior que zero"),
  adjustmentReason: z.string().min(1, "Motivo é obrigatório"),
  referenceDocument: z.string().optional(),
  notes: z.string().optional(),
});

type CostAdjustmentFormData = z.infer<typeof costAdjustmentSchema>;

interface CostInfo {
  materialName: string;
  currentCost: number;
  currentQuantity: number;
  currentTotalValue: number;
  unit: string;
}

export const CostAdjustmentForm = () => {
  const [loading, setLoading] = useState(false);
  const [costInfo, setCostInfo] = useState<CostInfo | null>(null);
  const [newTotalValue, setNewTotalValue] = useState<number | null>(null);
  const [costDifference, setCostDifference] = useState<number | null>(null);
  const [valueDifference, setValueDifference] = useState<number | null>(null);
  const { toast } = useToast();

  const form = useForm<CostAdjustmentFormData>({
    resolver: zodResolver(costAdjustmentSchema),
    defaultValues: {
      newUnitCost: 0,
      adjustmentReason: "",
      referenceDocument: "",
      notes: "",
    },
  });

  const handleMaterialSelect = async (materialId: string) => {
    if (!materialId) {
      setCostInfo(null);
      setNewTotalValue(null);
      setCostDifference(null);
      setValueDifference(null);
      return;
    }

    try {
      // Get material info
      const { data: materialData, error: materialError } = await supabase
        .from("materials")
        .select("name, usage_unit")
        .eq("id", materialId)
        .single();

      if (materialError) throw materialError;

      // Get stock info
      const { data: stockData, error: stockError } = await supabase
        .from("stock_items")
        .select("current_quantity, average_price, total_value")
        .eq("material_id", materialId)
        .maybeSingle();

      if (stockError) throw stockError;

      setCostInfo({
        materialName: materialData.name,
        currentCost: stockData?.average_price || 0,
        currentQuantity: stockData?.current_quantity || 0,
        currentTotalValue: stockData?.total_value || 0,
        unit: materialData.usage_unit,
      });

      // Calculate differences when new cost changes
      const newCost = form.getValues("newUnitCost");
      if (newCost && stockData) {
        calculateDifferences(newCost, stockData.average_price || 0, stockData.current_quantity || 0, stockData.total_value || 0);
      }
    } catch (error) {
      console.error("Error fetching material info:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar informações do material",
        variant: "destructive",
      });
    }
  };

  const calculateDifferences = (newCost: number, currentCost: number, quantity: number, currentValue: number) => {
    const newValue = newCost * quantity;
    setCostDifference(newCost - currentCost);
    setValueDifference(newValue - currentValue);
    setNewTotalValue(newValue);
  };

  const handleNewCostChange = (value: number) => {
    if (costInfo) {
      calculateDifferences(value, costInfo.currentCost, costInfo.currentQuantity, costInfo.currentTotalValue);
    }
  };

  const onSubmit = async (data: CostAdjustmentFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("process_cost_adjustment", {
        p_material_id: data.materialId,
        p_new_unit_cost: data.newUnitCost,
        p_adjustment_reason: data.adjustmentReason,
        p_reference_document: data.referenceDocument || null,
        p_notes: data.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Ajuste realizado",
        description: "Custo ajustado e estoque recalculado com sucesso",
      });

      form.reset();
      setCostInfo(null);
      setNewTotalValue(null);
      setCostDifference(null);
      setValueDifference(null);
    } catch (error) {
      console.error("Error processing cost adjustment:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar ajuste de custo",
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

  const getCostDifferenceIcon = () => {
    if (!costDifference) return null;
    return costDifference > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getCostDifferenceColor = () => {
    if (!costDifference) return "";
    return costDifference > 0 
      ? "bg-green-100 text-green-800 border-green-200" 
      : "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="materialId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Material</FormLabel>
                <FormControl>
                  <MaterialSelect
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleMaterialSelect(value);
                    }}
                    placeholder="Selecione um material"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {costInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Informações de Custo
                </CardTitle>
                <CardDescription>{costInfo.materialName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Custo Atual</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(costInfo.currentCost)}
                    </p>
                    <p className="text-xs text-muted-foreground">por {costInfo.unit}</p>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="newUnitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Novo Custo Unitário</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value);
                              handleNewCostChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Quantidade em Estoque</p>
                    <p className="text-lg font-bold">
                      {costInfo.currentQuantity} {costInfo.unit}
                    </p>
                  </div>

                  {costDifference !== null && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Diferença no Custo</p>
                      <Badge className={`text-sm font-bold ${getCostDifferenceColor()}`}>
                        {getCostDifferenceIcon()}
                        {costDifference > 0 ? '+' : ''}{formatCurrency(costDifference)}
                      </Badge>
                    </div>
                  )}
                </div>

                {valueDifference !== null && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Valor Total Atual</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(costInfo.currentTotalValue)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Novo Valor Total</p>
                        <p className="text-xl font-bold">
                          {formatCurrency(newTotalValue || 0)}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Diferença no Valor</p>
                        <Badge className={`text-lg font-bold ${getCostDifferenceColor()}`}>
                          {getCostDifferenceIcon()}
                          {valueDifference > 0 ? '+' : ''}{formatCurrency(valueDifference)}
                        </Badge>
                      </div>
                    </div>

                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Ajuste a ser realizado:</h4>
                      <p className="text-sm">
                        O custo unitário será alterado de {formatCurrency(costInfo.currentCost)} 
                        para {formatCurrency(form.getValues("newUnitCost") || 0)}, 
                        resultando em uma {valueDifference > 0 ? 'valorização' : 'desvalorização'} 
                        total de {formatCurrency(Math.abs(valueDifference))} no estoque.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="adjustmentReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo do Ajuste *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Atualização de preços de fornecedor" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referenceDocument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento de Referência</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: NF-001234, Cotação-2024-05" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Observações adicionais sobre o ajuste de custo..."
                    rows={3}
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !costInfo || costDifference === null}
          >
            {loading ? "Processando..." : "Processar Ajuste de Custo"}
          </Button>
        </form>
      </Form>
    </div>
  );
};