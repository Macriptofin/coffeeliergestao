import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Palette, List, FileSpreadsheet, Layers } from "lucide-react";
import { ConfigParams } from "./ConfigParams";
import { ConfigColors } from "./ConfigColors";
import { TaxonomyManager } from "./TaxonomyManager";
import { TaxonomyImporter } from "./TaxonomyImporter";

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

      <Tabs defaultValue="taxonomias" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="taxonomias" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Classificação
          </TabsTrigger>
          <TabsTrigger value="parametros" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Parâmetros
          </TabsTrigger>
          <TabsTrigger value="cores" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Cores & Aparência
          </TabsTrigger>
          <TabsTrigger value="importacao" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importação CSV
          </TabsTrigger>
        </TabsList>

        <TabsContent value="taxonomias" className="space-y-4">
          <div className="grid gap-6">
            <TaxonomyManager 
              taxonomyKey="material_type" 
              title="Tipos de Material"
              description="Defina os tipos principais de materiais (Insumo, Produto Acabado, etc.)"
            />
            <TaxonomyManager 
              taxonomyKey="material_category" 
              title="Categorias de Material"
              description="Gerencie as categorias de materiais (vinculadas aos tipos)"
              showParent={true}
              parentTaxonomyKey="material_type"
            />
            <TaxonomyManager 
              taxonomyKey="material_subcategory" 
              title="Subcategorias de Material"
              description="Gerencie as subcategorias de materiais (vinculadas às categorias)"
              showParent={true}
              parentTaxonomyKey="material_category"
            />
          </div>
        </TabsContent>

        <TabsContent value="parametros" className="space-y-4">
          <ConfigParams namespace="estoque" />
        </TabsContent>

        <TabsContent value="cores" className="space-y-4">
          <ConfigColors namespace="estoque" />
        </TabsContent>

        <TabsContent value="importacao" className="space-y-4">
          <TaxonomyImporter />
        </TabsContent>
      </Tabs>
    </div>
  );
};