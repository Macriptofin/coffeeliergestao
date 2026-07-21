import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, FileText, Calendar, Package2, AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFeatureFlags, logFeatureFlagEvent } from "@/hooks/useFeatureFlags";
import { supabase } from "@/integrations/supabase/client";

interface BomAlert {
  id: string;
  name: string;
  cost_status: string;
  missing_count: number;
}

const ProducaoMain = () => {
  const navigate = useNavigate();
  const { flags, loading } = useFeatureFlags();
  const [bomAlerts, setBomAlerts] = useState<BomAlert[]>([]);

  useEffect(() => { loadBomAlerts(); }, []);

  const loadBomAlerts = async () => {
    const { data } = await supabase
      .from('recipes_bom')
      .select('id, cost_status, missing_cost_items, materials!finished_material_id(name)')
      .in('cost_status', ['incomplete', 'partial', 'unknown'])
      .eq('is_archived', false)
      .limit(10);

    if (data) {
      setBomAlerts(data.map((b: any) => ({
        id: b.id,
        name: b.materials?.name || '—',
        cost_status: b.cost_status,
        missing_count: Array.isArray(b.missing_cost_items) ? b.missing_cost_items.length : 0,
      })));
    }
  };

  const modules = [
    {
      title: "Fichas Técnicas (BOM)",
      description: "Gestão unificada de produtos, receitas e composições com custos automáticos",
      icon: Package2,
      href: "/producao/fichas-tecnicas",
      color: "bg-purple-500"
    },
    {
      title: "Planejamento e Ordens",
      description: "Centro operacional unificado - gestão completa da produção",
      icon: ClipboardList,
      href: "/producao/planejamento",
      color: "bg-blue-500"
    },
    {
      title: "Relatórios",
      description: "Performance, custos completos e análises detalhadas de produção",
      icon: FileText,
      href: "/producao/relatorios",
      color: "bg-orange-500"
    },
    {
      title: "Mesas/Eventos",
      description: "Gestão de eventos com auto-geração de ordens de produção",
      icon: Calendar,
      href: "/producao/eventos",
      color: "bg-pink-500",
      hidden: !flags.FF_EVENT_TABLES_ENABLED
    }
  ].filter(module => !module.hidden);

  const handleModuleClick = (module: any) => {
    logFeatureFlagEvent('nav.module.click', module.href);
    navigate(module.href);
  };

  // Bloquear a renderização até a flag de Mesas/Eventos carregar, evitando
  // o card piscar. Com o cache do react-query, isto só ocorre na 1ª carga
  // da sessão; revisitas são instantâneas e já com a flag correta.
  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Produção</h1>
          <p className="text-muted-foreground">
            Controle completo da produção unificada: produtos, receitas, custos e execução
          </p>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gestão de Produção</h1>
        <p className="text-muted-foreground">
          Controle completo da produção unificada: produtos, receitas, custos e execução
        </p>
      </div>

      {/* Alertas de fichas com custo incompleto */}
      {bomAlerts.length > 0 && (
        <div className="mb-6 border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="font-semibold text-yellow-800 text-sm">
              {bomAlerts.length} {bomAlerts.length === 1 ? 'ficha técnica com custo incompleto' : 'fichas técnicas com custo incompleto'}
            </span>
          </div>
          <div className="space-y-1.5">
            {bomAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between text-sm">
                <span className="text-yellow-800 font-medium">{alert.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 text-xs">
                    {alert.missing_count > 0 ? `${alert.missing_count} ingrediente(s) sem custo` : alert.cost_status}
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-yellow-700 hover:text-yellow-900"
                    onClick={() => navigate(`/producao/fichas-tecnicas`)}>
                    Corrigir <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.title} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${module.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {module.description}
                </CardDescription>
                <Button 
                  onClick={() => handleModuleClick(module)}
                  variant="outline" 
                  className="w-full"
                >
                  Acessar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProducaoMain;