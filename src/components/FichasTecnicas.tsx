import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Factory, ArrowRight, AlertCircle, Package, Wrench, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeatureFlags, logFeatureFlagEvent } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MaterialForm } from "@/components/MaterialForm";
import { ProductionExecutor } from "@/components/bom/ProductionExecutor";
import { EventProductionIntegration } from "@/components/EventProductionIntegration";
import { BOMStatusAlert } from "@/components/BOMStatusAlert";
import { useMaterialBOM } from "@/hooks/useMaterialBOM";
import type { Material } from "@/pages/Materials";

const FichasTecnicas = () => {
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState("produto-acabado");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showProductionExecutor, setShowProductionExecutor] = useState(false);
  const [showEventIntegration, setShowEventIntegration] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .in('material_type', ['finished_product', 'composite_product'])
        .order('name');
      
      if (error) throw error;
      
      const formattedMaterials = data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || undefined,
        purchaseUnit: item.purchase_unit,
        usageUnit: item.usage_unit,
        conversionFactor: parseFloat(item.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit.toString()),
        supplier: item.supplier || undefined,
        allowedBrands: item.allowed_brands || undefined,
        category: item.category as Material['category'],
        code: item.code,
        materialType: item.material_type as Material['materialType'],
        unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined
      }));
      
      setMaterials(formattedMaterials);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    logFeatureFlagEvent('nav.ficha_tecnica.tab_change', value);
  };

  const handleAddMaterial = (type: 'finished_product' | 'composite_product') => {
    setEditingMaterial(null);
    setShowMaterialForm(true);
    setActiveTab(type === 'finished_product' ? 'produto-acabado' : 'produto-composto');
  };

  const addMaterial = async (material: Omit<Material, 'id' | 'code'>) => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .insert({
          name: material.name,
          description: material.description,
          purchase_unit: material.purchaseUnit,
          usage_unit: material.usageUnit,
          conversion_factor: material.conversionFactor,
          price_per_purchase_unit: material.pricePerPurchaseUnit,
          supplier: material.supplier,
          allowed_brands: material.allowedBrands,
          category: material.category,
          material_type: material.materialType,
          unit_weight: material.unitWeight
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newMaterial: Material = {
        id: data.id,
        name: data.name,
        description: data.description || undefined,
        purchaseUnit: data.purchase_unit,
        usageUnit: data.usage_unit,
        conversionFactor: parseFloat(data.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(data.price_per_purchase_unit.toString()),
        supplier: data.supplier || undefined,
        allowedBrands: data.allowed_brands || undefined,
        category: data.category as Material['category'],
        code: data.code,
        materialType: data.material_type as Material['materialType'],
        unitWeight: data.unit_weight ? parseFloat(data.unit_weight.toString()) : undefined
      };
      
      setMaterials([...materials, newMaterial]);
      setShowMaterialForm(false);
      toast.success('Produto cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar material:', error);
      toast.error('Erro ao cadastrar produto');
    }
  };

  const handleMaterialSubmit = (materialData: Omit<Material, 'id' | 'code'>) => {
    addMaterial(materialData);
  };

  const getFinishedProducts = () => materials.filter(m => m.materialType === 'finished_product');
  const getCompositeProducts = () => materials.filter(m => m.materialType === 'composite_product');

  const renderProductCard = (material: Material) => {
    return <ProductCard key={material.id} material={material} onRefresh={loadMaterials} />;
  };

  const ProductCard = ({ material, onRefresh }: { material: Material; onRefresh: () => void }) => {
    const { bomInfo, loading: bomLoading } = useMaterialBOM(material.id, material.materialType);
    
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{material.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{material.code}</Badge>
                <Badge variant={material.materialType === 'finished_product' ? 'default' : 'secondary'}>
                  {material.materialType === 'finished_product' ? 'Produto Acabado' : 'Produto Composto'}
                </Badge>
              </div>
            </div>
          </div>
          {material.description && (
            <CardDescription>{material.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bomLoading ? (
              <div className="animate-pulse">
                <div className="h-16 bg-muted rounded w-full"></div>
              </div>
            ) : (
              <BOMStatusAlert
                hasBOM={bomInfo.hasBOM}
                cost={bomInfo.cost}
                itemsCount={bomInfo.itemsCount}
                yieldQuantity={bomInfo.yieldQuantity}
                materialType={material.materialType as 'finished_product' | 'composite_product'}
              />
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(material.materialType === 'finished_product' ? '/receitas' : '/producao/bom')}
                className="flex-1"
              >
                <Settings className="h-4 w-4 mr-1" />
                {bomInfo.hasBOM ? 'Editar BOM' : 'Configurar BOM'}
              </Button>
              
              {bomInfo.hasBOM && (
                <Button 
                  size="sm" 
                  onClick={() => setShowProductionExecutor(true)}
                  className="flex-1"
                >
                  {material.materialType === 'finished_product' ? (
                    <>
                      <Package className="h-4 w-4 mr-1" />
                      Produzir
                    </>
                  ) : (
                    <>
                      <Wrench className="h-4 w-4 mr-1" />
                      Montar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fichas Técnicas (BOM)</h1>
          <p className="text-muted-foreground">
            Gestão unificada de produtos, receitas e composições
          </p>
        </div>
        
        {showEventIntegration && (
          <Button 
            onClick={() => setShowEventIntegration(false)}
            variant="outline"
          >
            Voltar para Cadastro
          </Button>
        )}
        
        {showProductionExecutor && (
          <Button 
            onClick={() => setShowProductionExecutor(false)}
            variant="outline"
          >
            Voltar para Cadastro
          </Button>
        )}
      </div>

      {showEventIntegration ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Integração com Eventos</h2>
          </div>
          <EventProductionIntegration onOrderGenerated={() => {
            toast.success('Ordem gerada! Verifique em Ordens de Produção.');
            setShowEventIntegration(false);
          }} />
        </div>
      ) : showProductionExecutor ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Factory className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Execução de Produção</h2>
          </div>
          <ProductionExecutor onSuccess={() => setShowProductionExecutor(false)} />
        </div>
      ) : (
        <>
          {showMaterialForm && (
            <div className="mb-8">
              <MaterialForm 
                material={editingMaterial}
                existingMaterials={materials}
                onSubmit={handleMaterialSubmit}
                onCancel={() => setShowMaterialForm(false)}
              />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="produto-acabado" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos Acabados
              </TabsTrigger>
              <TabsTrigger value="produto-composto" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Produtos Compostos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="produto-acabado" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Produtos Acabados</h2>
                  <p className="text-muted-foreground">
                    Produtos que requerem receita e processo de produção
                  </p>
                </div>
                <Button 
                  onClick={() => handleAddMaterial('finished_product')}
                  className="bg-gradient-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto Acabado
                </Button>
              </div>

              {getFinishedProducts().length === 0 ? (
                <Card className="shadow-soft">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhum produto acabado cadastrado</h3>
                      <p className="text-muted-foreground mb-4">
                        Cadastre produtos acabados para gerenciar suas receitas e produção.
                      </p>
                      <Button onClick={() => handleAddMaterial('finished_product')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar Primeiro Produto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getFinishedProducts().map(renderProductCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="produto-composto" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">Produtos Compostos</h2>
                  <p className="text-muted-foreground">
                    Kits e conjuntos montados a partir de outros produtos
                  </p>
                </div>
                <Button 
                  onClick={() => handleAddMaterial('composite_product')}
                  className="bg-gradient-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto Composto
                </Button>
              </div>

              {getCompositeProducts().length === 0 ? (
                <Card className="shadow-soft">
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhum produto composto cadastrado</h3>
                      <p className="text-muted-foreground mb-4">
                        Cadastre produtos compostos para gerenciar kits e montagens.
                      </p>
                      <Button onClick={() => handleAddMaterial('composite_product')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar Primeiro Composto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getCompositeProducts().map(renderProductCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {!showMaterialForm && (
            <div className="mt-8 flex justify-center gap-4">
              <Button 
                onClick={() => setShowProductionExecutor(true)}
                className="bg-gradient-primary hover:bg-primary/90"
                disabled={materials.length === 0}
              >
                <Factory className="h-4 w-4 mr-2" />
                Executar Produção/Montagem
              </Button>
              
              <Button 
                onClick={() => setShowEventIntegration(true)}
                variant="outline"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Integração com Eventos
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FichasTecnicas;