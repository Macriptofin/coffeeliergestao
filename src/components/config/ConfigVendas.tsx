import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { ShoppingCart, Package, List, Workflow, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfigParams } from "./ConfigParams";
import { TaxonomyManager } from "./TaxonomyManager";

// Chaves de app_settings — probabilidades do funil (armazenadas como FRAÇÃO string)
const PROB_KEYS = {
  rascunho: "pipeline.prob_rascunho",
  enviada: "pipeline.prob_enviada",
  aprovadaCliente: "pipeline.prob_aprovada_cliente",
} as const;

const PROB_FALLBACK = { rascunho: "0.10", enviada: "0.40", aprovadaCliente: "0.80" };

// fração string (banco) → % (UI)
const fracStrToPct = (frac: string | null | undefined, fb: string): string => {
  const src = frac == null || frac === "" ? fb : frac;
  const n = parseFloat(src);
  return isNaN(n) ? "" : (n * 100).toString();
};
// % (UI) → fração string (banco)
const pctToFracStr = (pct: string, fb: string): string => {
  const n = parseFloat(pct);
  return isNaN(n) ? fb : (n / 100).toString();
};

const PipelineProbabilities = () => {
  const [rascunho, setRascunho] = useState("");
  const [enviada, setEnviada] = useState("");
  const [aprovadaCliente, setAprovadaCliente] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .in("key", Object.values(PROB_KEYS));
        if (error) throw error;
        const map = new Map((data || []).map((r) => [r.key, r.value]));
        setRascunho(fracStrToPct(map.get(PROB_KEYS.rascunho), PROB_FALLBACK.rascunho));
        setEnviada(fracStrToPct(map.get(PROB_KEYS.enviada), PROB_FALLBACK.enviada));
        setAprovadaCliente(
          fracStrToPct(map.get(PROB_KEYS.aprovadaCliente), PROB_FALLBACK.aprovadaCliente),
        );
      } catch (err) {
        console.error("Erro ao carregar probabilidades do funil:", err);
        toast.error("Não foi possível carregar as probabilidades do funil.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = [
        { key: PROB_KEYS.rascunho, value: pctToFracStr(rascunho, PROB_FALLBACK.rascunho) },
        { key: PROB_KEYS.enviada, value: pctToFracStr(enviada, PROB_FALLBACK.enviada) },
        {
          key: PROB_KEYS.aprovadaCliente,
          value: pctToFracStr(aprovadaCliente, PROB_FALLBACK.aprovadaCliente),
        },
      ];
      const { error } = await supabase
        .from("app_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Probabilidades do funil salvas.");
    } catch (err) {
      console.error("Erro ao salvar probabilidades do funil:", err);
      toast.error("Não foi possível salvar as probabilidades do funil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Funil de vendas — probabilidades de fechamento (forecast)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Probabilidade de cada estágio aberto virar venda. Usada para calcular a
          receita prevista (forecast) no funil.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Rascunho (%)</Label>
                <NumericInput
                  step="1"
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  placeholder="Ex: 10"
                />
              </div>
              <div className="space-y-2">
                <Label>Enviada (%)</Label>
                <NumericInput
                  step="1"
                  value={enviada}
                  onChange={(e) => setEnviada(e.target.value)}
                  placeholder="Ex: 40"
                />
              </div>
              <div className="space-y-2">
                <Label>Aprovada pelo Cliente (%)</Label>
                <NumericInput
                  step="1"
                  value={aprovadaCliente}
                  onChange={(e) => setAprovadaCliente(e.target.value)}
                  placeholder="Ex: 80"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

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
          <PipelineProbabilities />
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
