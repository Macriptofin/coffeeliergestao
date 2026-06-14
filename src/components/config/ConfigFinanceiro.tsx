import { DollarSign } from "lucide-react";
import { ConfigParams } from "./ConfigParams";
import { PaymentMethodsManager } from "./PaymentMethodsManager";

export const ConfigFinanceiro = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Configurações Financeiras</h2>
          <p className="text-muted-foreground">Parâmetros para gestão financeira e contábil</p>
        </div>
      </div>

      <ConfigParams namespace="financeiro" />

      <PaymentMethodsManager />
    </div>
  );
};
