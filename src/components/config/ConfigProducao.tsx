import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { ConfigParams } from "./ConfigParams";

export const ConfigProducao = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Configurações de Produção</h2>
          <p className="text-muted-foreground">Parâmetros para cálculos e processos produtivos</p>
        </div>
      </div>

      <ConfigParams namespace="producao" />
    </div>
  );
};