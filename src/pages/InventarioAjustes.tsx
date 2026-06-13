import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, AlertTriangle, History } from "lucide-react";
import { InventoryCyclesList } from "@/components/inventory/InventoryCyclesList";
import { AjusteAvulso }        from "@/components/inventory/AjusteAvulso";
import { HistoricoUnificado }  from "@/components/inventory/HistoricoUnificado";

const InventarioAjustes = () => {
  const [activeTab, setActiveTab] = useState("ciclos");

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Inventário & Ajustes</h1>
        <p className="text-muted-foreground text-sm">
          Controle auditável de contagens físicas, ajustes e revalorizações de estoque
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ciclos" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Ciclos de Inventário
          </TabsTrigger>
          <TabsTrigger value="avulso" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Ajuste Avulso
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico Unificado
          </TabsTrigger>
        </TabsList>

        {/* ── Ciclos ── */}
        <TabsContent value="ciclos">
          <InventoryCyclesList />
        </TabsContent>

        {/* ── Ajuste Avulso ── */}
        <TabsContent value="avulso">
          <div className="max-w-2xl">
            <div className="mb-5 p-4 rounded-lg border border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800 font-medium mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Quando usar o Ajuste Avulso
              </p>
              <p className="text-sm text-amber-700">
                Use este formulário apenas para eventos pontuais que não fazem parte de um ciclo de inventário periódico: quebras acidentais, perdas identificadas, erros de lançamento anterior, vencimentos ou revalorizações de custo pontuais. Para contagens programadas, use a aba <strong>Ciclos de Inventário</strong>.
              </p>
            </div>
            <AjusteAvulso />
          </div>
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico">
          <HistoricoUnificado />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventarioAjustes;
