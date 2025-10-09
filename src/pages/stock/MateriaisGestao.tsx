import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockParameters } from "@/components/stock/StockParameters";
import { StockPlanning } from "@/components/stock/StockPlanning";

const MateriaisGestao = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestão de Estoque</h1>
        <p className="text-muted-foreground">
          Configure parâmetros ABC, níveis de estoque e planeje necessidades de compra
        </p>
      </div>
      
      <Tabs defaultValue="parametros" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parametros" className="mt-6">
          <StockParameters />
        </TabsContent>
        
        <TabsContent value="planejamento" className="mt-6">
          <StockPlanning />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MateriaisGestao;
