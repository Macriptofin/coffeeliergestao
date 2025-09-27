import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Factory, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeatureFlags, logFeatureFlagEvent } from "@/hooks/useFeatureFlags";

const FichasTecnicas = () => {
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState("produto-acabado");

  const handleCreateProductionOrder = (material: any) => {
    logFeatureFlagEvent('orders.create.from_recipe', material?.id);
    console.info(`🏭 Creating production order for material: ${material?.name}`);
    navigate(`/producao/ordens?material=${material.id}&source=ficha-tecnica`);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    logFeatureFlagEvent('nav.ficha_tecnica.tab_change', value);
  };

  const handleNavigateToReceitas = () => {
    logFeatureFlagEvent('nav.redirect.fichas_to_receitas');
    navigate('/receitas');
  };

  const handleNavigateToBOM = () => {
    logFeatureFlagEvent('nav.redirect.fichas_to_bom');
    navigate('/producao/bom');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fichas Técnicas (BOM)</h1>
          <p className="text-muted-foreground">
            Gestão unificada de receitas e composições de produtos
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="produto-acabado" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Produto Acabado
          </TabsTrigger>
          <TabsTrigger value="produto-composto" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Produto Composto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produto-acabado" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Receitas - Produtos Acabados</CardTitle>
                  <CardDescription>
                    Gestão de receitas com cálculo automático de custos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Settings className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Interface Unificada</h3>
                <p className="text-muted-foreground mb-6">
                  Esta página unifica o gerenciamento de receitas e BOMs.{" "}
                  {flags.FF_ORDERS_AS_CENTRAL && "Produção centralizada via Ordens de Produção."}
                </p>
                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={handleNavigateToReceitas}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    Acessar Receitas
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {flags.FF_ORDERS_AS_CENTRAL && (
                    <Button 
                      onClick={() => navigate('/producao/ordens')}
                      className="bg-gradient-primary hover:bg-primary/90 flex items-center gap-2"
                    >
                      Ordens de Produção
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produto-composto" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Composições - Produtos Compostos</CardTitle>
                  <CardDescription>
                    BOMs de materiais compostos e montagem
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Factory className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">BOM Management</h3>
                <p className="text-muted-foreground mb-6">
                  Gerencie BOMs de produtos compostos e execução de montagem.{" "}
                  {flags.FF_ORDERS_AS_CENTRAL && "Execução centralizada via Ordens."}
                </p>
                <div className="flex justify-center gap-4">
                  <Button 
                    onClick={handleNavigateToBOM}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    Acessar BOM & Produção
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FichasTecnicas;