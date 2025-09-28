import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Palette, List } from "lucide-react";
import { ConfigParams } from "./ConfigParams";
import { ConfigColors } from "./ConfigColors";
import { TaxonomyManager } from "./TaxonomyManager";

export const ConfigEstoque = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Configurações de Estoque</h2>
          <p className="text-muted-foreground">Parâmetros, cores e taxonomias para gestão de materiais</p>
        </div>
      </div>

      <Tabs defaultValue="parametros" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="parametros" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Parâmetros
          </TabsTrigger>
          <TabsTrigger value="cores" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Cores & Aparência
          </TabsTrigger>
          <TabsTrigger value="taxonomias" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Categorias & Subcategorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parametros" className="space-y-4">
          <ConfigParams namespace="estoque" />
        </TabsContent>

        <TabsContent value="cores" className="space-y-4">
          <ConfigColors namespace="estoque" />
        </TabsContent>

        <TabsContent value="taxonomias" className="space-y-4">
          <div className="grid gap-6">
            <TaxonomyManager 
              taxonomyKey="material_category" 
              title="Categorias de Material"
              description="Gerencie as categorias principais de materiais"
            />
            <TaxonomyManager 
              taxonomyKey="material_subcategory" 
              title="Subcategorias de Material"
              description="Gerencie as subcategorias de materiais"
              showParent={true}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};