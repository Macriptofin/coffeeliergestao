import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, Calculator, History, RotateCcw, FileSpreadsheet } from "lucide-react";
import { InventoryCountForm } from "@/components/inventory/InventoryCountForm";
import { CostAdjustmentForm } from "@/components/inventory/CostAdjustmentForm";
import { AdjustmentHistory } from "@/components/inventory/AdjustmentHistory";
import { InventoryCyclesList } from "@/components/inventory/InventoryCyclesList";
import { InventoryImportCSV } from "@/components/inventory/InventoryImportCSV";

const InventarioAjustes = () => {
  const [activeTab, setActiveTab] = useState("cycles");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Inventário & Ajustes</h1>
        <p className="text-muted-foreground">
          Gestão auditável de inventários físicos, ajustes de quantidade e custo
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="cycles" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Ciclos
          </TabsTrigger>
          <TabsTrigger value="csv" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importação CSV
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Contagem
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Custo
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cycles">
          <InventoryCyclesList />
        </TabsContent>

        <TabsContent value="csv">
          <InventoryImportCSV />
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Contagem de Inventário Físico
              </CardTitle>
              <CardDescription>
                Compare quantidades do sistema com contagem física e ajuste automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InventoryCountForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Ajuste de Custo Unitário
              </CardTitle>
              <CardDescription>
                Ajuste valor unitário e recalcule custo médio ponderado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CostAdjustmentForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Ajustes
              </CardTitle>
              <CardDescription>
                Visualize todos os ajustes realizados com rastreabilidade completa
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdjustmentHistory />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventarioAjustes;