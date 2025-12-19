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
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MaterialSelect } from "@/components/MaterialSelect";

const inventorySchema = z.object({
  materialId: z.string().min(1, "Selecione um material"),
  physicalQuantity: z.number().min(0, "Quantidade deve ser maior ou igual a zero"),
  adjustmentReason: z.string().min(1, "Motivo é obrigatório"),
  referenceDocument: z.string().optional(),
  notes: z.string().optional(),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

interface StockInfo {
  materialName: string;
  systemQuantity: number;
  unit: string;
}

export const InventoryCountForm = () => {
  const [loading, setLoading] = useState(false);
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [difference, setDifference] = useState<number | null>(null);
  const { toast } = useToast();

  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      physicalQuantity: 0,
      adjustmentReason: "",
      referenceDocument: "",
      notes: "",
    },
  });

  const handleMaterialSelect = async (materialId: string) => {
    if (!materialId) {
      setStockInfo(null);
      setDifference(null);
      return;
    }

    try {
      // Get material info and stock
      const { data: materialData, error: materialError } = await supabase
        .from("materials")
        .select("name, usage_unit")
        .eq("id", materialId)
        .single();

      if (materialError) throw materialError;

      const { data: stockData, error: stockError } = await supabase
        .from("stock_items")
        .select("current_quantity")
        .eq("material_id", materialId)
        .maybeSingle();

      if (stockError) throw stockError;

      const systemQty = stockData?.current_quantity || 0;
      
      setStockInfo({
        materialName: materialData.name,
        systemQuantity: systemQty,
        unit: materialData.usage_unit,
      });

      // Calcular diferença imediatamente com a quantidade física atual
      const physicalQty = form.getValues("physicalQuantity") || 0;
      setDifference(physicalQty - systemQty);
    } catch (error) {
      console.error("Error fetching material info:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar informações do material",
        variant: "destructive",
      });
    }
  };

  const handlePhysicalQuantityChange = (value: number) => {
    if (stockInfo) {
      setDifference(value - stockInfo.systemQuantity);
    }
  };

  const onSubmit = async (data: InventoryFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("process_inventory_adjustment", {
        p_material_id: data.materialId,
        p_physical_quantity: data.physicalQuantity,
        p_adjustment_reason: data.adjustmentReason,
        p_reference_document: data.referenceDocument || null,
        p_notes: data.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Ajuste realizado",
        description: "Inventário processado e estoque ajustado com sucesso",
      });

      form.reset();
      setStockInfo(null);
      setDifference(null);
    } catch (error) {
      console.error("Error processing inventory:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar inventário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDifferenceStatus = () => {
    if (difference === null || difference === 0) return null;
    return difference > 0 ? "positive" : "negative";
  };

  const getDifferenceIcon = () => {
    const status = getDifferenceStatus();
    if (status === "positive") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === "negative") return <XCircle className="h-4 w-4 text-red-600" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  };

  const getDifferenceColor = () => {
    const status = getDifferenceStatus();
    if (status === "positive") return "bg-green-100 text-green-800 border-green-200";
    if (status === "negative") return "bg-red-100 text-red-800 border-red-200";
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
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

          {stockInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações do Estoque</CardTitle>
                <CardDescription>{stockInfo.materialName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Quantidade Sistema</p>
                    <p className="text-2xl font-bold">
                      {stockInfo.systemQuantity} {stockInfo.unit}
                    </p>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="physicalQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade Física</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value);
                              handlePhysicalQuantityChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {difference !== null && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Diferença</p>
                      <Badge className={`text-lg font-bold ${getDifferenceColor()}`}>
                        {getDifferenceIcon()}
                        {difference > 0 ? '+' : ''}{difference.toFixed(2)} {stockInfo.unit}
                      </Badge>
                    </div>
                  )}
                </div>

                {difference !== null && difference !== 0 && (
                  <>
                    <Separator />
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Ajuste a ser realizado:</h4>
                      <p className="text-sm">
                        {difference > 0 
                          ? `Será adicionado ${difference.toFixed(2)} ${stockInfo.unit} ao estoque`
                          : `Será removido ${Math.abs(difference).toFixed(2)} ${stockInfo.unit} do estoque`
                        }
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
                    <Input placeholder="Ex: Inventário físico mensal" {...field} />
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
                    <Input placeholder="Ex: INV-2024-001" {...field} />
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
                    placeholder="Observações adicionais sobre o ajuste..."
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
            disabled={loading || !stockInfo}
          >
            {loading ? "Processando..." : "Processar Ajuste de Inventário"}
          </Button>
        </form>
      </Form>
    </div>
  );
};