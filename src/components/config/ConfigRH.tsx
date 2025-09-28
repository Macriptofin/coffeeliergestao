import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { ConfigParams } from "./ConfigParams";

export const ConfigRH = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Configurações de RH</h2>
          <p className="text-muted-foreground">Parâmetros para gestão de recursos humanos</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Configurações de RH serão implementadas em breve.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};