import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Package, List } from "lucide-react";
import { ConfigParams } from "./ConfigParams";
import { TaxonomyManager } from "./TaxonomyManager";

export const ConfigVendas = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Configurações de Vendas</h2>
          <p className="text-muted-foreground">Parâmetros para vendas, propostas e produtos</p>
        </div>
      </div>

      <Tabs defaultValue="parametros" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="parametros" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Parâmetros
          </TabsTrigger>
          <TabsTrigger value="taxonomias" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Categorias de Produto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parametros" className="space-y-4">
          <ConfigParams namespace="vendas" />
        </TabsContent>

        <TabsContent value="taxonomias" className="space-y-4">
          <TaxonomyManager 
            taxonomyKey="product_category" 
            title="Categorias de Produto"
            description="Gerencie as categorias de produtos para vendas"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};