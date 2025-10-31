import { Clock } from "lucide-react";
import { TimeClockWidget } from "@/components/timeclock/TimeClockWidget";
import { TimeRecordsList } from "@/components/timeclock/TimeRecordsList";

const ControlePonto = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Controle de Ponto</h1>
          <p className="text-muted-foreground">
            Registre e gerencie os horários de trabalho dos colaboradores
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <TimeClockWidget />
        </div>
        <div className="lg:col-span-2">
          <TimeRecordsList />
        </div>
      </div>
    </div>
  );
};

export default ControlePonto;
