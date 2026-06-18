import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { DollarSign, Save, Tags, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTaxonomy } from "@/hooks/useConfig";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { toast } from "sonner";

// Chaves de app_settings (margem/overhead_pct armazenados como FRAÇÃO em string)
const SETTING_MARGIN = "pricing.default_margin_pct";
const SETTING_OH_PCT = "pricing.default_overhead_pct";
const SETTING_OH_VAL = "pricing.default_overhead_value";
// Logística (frete por evento) — valores diretos (não-fração)
const SETTING_TRIPS = "logistics.delivery_trips";
const SETTING_COST_KM = "logistics.cost_per_km";

// % (UI) → fração string (banco); vazio mantém atual ('0')
const pctToFracStr = (pct: string): string => {
  const n = parseFloat(pct);
  return isNaN(n) ? "0" : (n / 100).toString();
};
// fração string (banco) → % (UI)
const fracStrToPct = (frac: string | null | undefined): string => {
  if (frac == null || frac === "") return "";
  const n = parseFloat(frac);
  return isNaN(n) ? "" : (n * 100).toString();
};

interface PricingRuleRow {
  term_id: string;
  target_margin_pct: number | null;
  overhead_pct: number | null;
  overhead_value: number | null;
}

// Estado editável de uma regra de categoria (campos em % para margem/overhead)
interface CategoryRuleState {
  marginPct: string; // %
  overheadPct: string; // %
  overheadValue: string; // R$
}

const emptyRule = (): CategoryRuleState => ({ marginPct: "", overheadPct: "", overheadValue: "" });

export const ConfigPrecificacao = () => {
  const { getTermsByTaxonomy, loading: taxonomyLoading } = useTaxonomy();

  // ── Parâmetros globais ─────────────────────────────────────────────────
  const [globalMargin, setGlobalMargin] = useState(""); // %
  const [globalOhPct, setGlobalOhPct] = useState(""); // %
  const [globalOhVal, setGlobalOhVal] = useState(""); // R$
  const [logisticsTrips, setLogisticsTrips] = useState(""); // nº de trajetos
  const [logisticsCostKm, setLogisticsCostKm] = useState(""); // R$/km
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

  // ── Regras por categoria ───────────────────────────────────────────────
  const [rules, setRules] = useState<Record<string, CategoryRuleState>>({});
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);

  const categories = getTermsByTaxonomy("material_category").filter((t) => t.is_active !== false);

  // Carregar parâmetros globais
  useEffect(() => {
    const load = async () => {
      setLoadingGlobal(true);
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .in("key", [SETTING_MARGIN, SETTING_OH_PCT, SETTING_OH_VAL, SETTING_TRIPS, SETTING_COST_KM]);
        if (error) throw error;
        const map = new Map((data || []).map((r) => [r.key, r.value]));
        setGlobalMargin(fracStrToPct(map.get(SETTING_MARGIN)));
        setGlobalOhPct(fracStrToPct(map.get(SETTING_OH_PCT)));
        const ohVal = map.get(SETTING_OH_VAL);
        setGlobalOhVal(ohVal != null && ohVal !== "" && parseFloat(ohVal) !== 0 ? ohVal : "");
        setLogisticsTrips(map.get(SETTING_TRIPS) ?? "4");
        setLogisticsCostKm(map.get(SETTING_COST_KM) ?? "1.50");
      } catch (err) {
        console.error("Erro ao carregar parâmetros de precificação:", err);
        toast.error("Não foi possível carregar os parâmetros globais.");
      } finally {
        setLoadingGlobal(false);
      }
    };
    load();
  }, []);

  // Carregar regras por categoria existentes
  useEffect(() => {
    const load = async () => {
      setLoadingRules(true);
      try {
        const { data, error } = await supabase
          .from("pricing_rules")
          .select("term_id,target_margin_pct,overhead_pct,overhead_value")
          .eq("scope_type", "category");
        if (error) throw error;
        const next: Record<string, CategoryRuleState> = {};
        (data as PricingRuleRow[] | null)?.forEach((r) => {
          next[r.term_id] = {
            marginPct: fracStrToPct(r.target_margin_pct?.toString()),
            overheadPct: fracStrToPct(r.overhead_pct?.toString()),
            overheadValue: r.overhead_value != null ? r.overhead_value.toString() : "",
          };
        });
        setRules(next);
      } catch (err) {
        console.error("Erro ao carregar regras por categoria:", err);
        toast.error("Não foi possível carregar as regras por categoria.");
      } finally {
        setLoadingRules(false);
      }
    };
    load();
  }, []);

  const recompute = async () => {
    const { error } = await (supabase.rpc as any)("recompute_all_pricing");
    if (error) throw error;
  };

  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    try {
      const rows = [
        { key: SETTING_MARGIN, value: pctToFracStr(globalMargin) },
        { key: SETTING_OH_PCT, value: pctToFracStr(globalOhPct) },
        { key: SETTING_OH_VAL, value: globalOhVal.trim() !== "" ? parseFloat(globalOhVal).toString() : "0" },
        { key: SETTING_TRIPS, value: logisticsTrips.trim() !== "" ? parseFloat(logisticsTrips).toString() : "4" },
        { key: SETTING_COST_KM, value: logisticsCostKm.trim() !== "" ? parseFloat(logisticsCostKm).toString() : "1.50" },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      await recompute();
      toast.success("Parâmetros globais salvos e preços recalculados.");
    } catch (err) {
      console.error("Erro ao salvar parâmetros globais:", err);
      toast.error("Não foi possível salvar os parâmetros globais.");
    } finally {
      setSavingGlobal(false);
    }
  };

  const updateRuleField = (termId: string, field: keyof CategoryRuleState, value: string) => {
    setRules((prev) => ({
      ...prev,
      [termId]: { ...(prev[termId] ?? emptyRule()), [field]: value },
    }));
  };

  const handleSaveRule = async (termId: string) => {
    setSavingRule(termId);
    try {
      const r = rules[termId] ?? emptyRule();
      const payload = {
        scope_type: "category",
        term_id: termId,
        // Vazio = herda global → null
        target_margin_pct: r.marginPct.trim() !== "" ? parseFloat(r.marginPct) / 100 : null,
        overhead_pct: r.overheadPct.trim() !== "" ? parseFloat(r.overheadPct) / 100 : null,
        overhead_value: r.overheadValue.trim() !== "" ? parseFloat(r.overheadValue) : null,
      };
      const { error } = await supabase
        .from("pricing_rules")
        .upsert(payload, { onConflict: "scope_type,term_id" });
      if (error) throw error;
      await recompute();
      toast.success("Regra da categoria salva e preços recalculados.");
    } catch (err) {
      console.error("Erro ao salvar regra de categoria:", err);
      toast.error("Não foi possível salvar a regra da categoria.");
    } finally {
      setSavingRule(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">Precificação</h2>
          <p className="text-muted-foreground">
            Defina a margem e o overhead padrão e ajuste por categoria de produto.
          </p>
        </div>
      </div>

      {/* ── Parâmetros globais ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Parâmetros globais
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Valores padrão aplicados quando o produto e a categoria não definem o seu próprio.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingGlobal ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Margem padrão (%)</Label>
                  <NumericInput
                    step="0.1"
                    value={globalMargin}
                    onChange={(e) => setGlobalMargin(e.target.value)}
                    placeholder="Ex: 40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overhead padrão (%)</Label>
                  <NumericInput
                    step="0.1"
                    value={globalOhPct}
                    onChange={(e) => setGlobalOhPct(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Overhead padrão (R$/un)</Label>
                  <NumericInput
                    step="0.01"
                    value={globalOhVal}
                    onChange={(e) => setGlobalOhVal(e.target.value)}
                    placeholder="Ex: 0,50"
                  />
                </div>
              </div>

              {/* Logística — frete por evento */}
              <div className="pt-2 border-t">
                <p className="text-sm font-medium mb-1">Logística (frete por evento)</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Frete = distância do cliente × nº de trajetos × custo/km, rateado pelo nº de pessoas.
                  Entra embutido no preço (repasse, sem margem); o cliente vê só o valor por pessoa.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nº de trajetos por evento</Label>
                    <NumericInput
                      step="1"
                      value={logisticsTrips}
                      onChange={(e) => setLogisticsTrips(e.target.value)}
                      placeholder="Ex: 4 (2 idas + 2 voltas)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo por km (R$)</Label>
                    <NumericInput
                      step="0.01"
                      value={logisticsCostKm}
                      onChange={(e) => setLogisticsCostKm(e.target.value)}
                      placeholder="Ex: 1,50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveGlobal} disabled={savingGlobal}>
                  <Save className="h-4 w-4 mr-2" />
                  {savingGlobal ? "Salvando..." : "Salvar e recalcular"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Regras por categoria ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Regras por categoria
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sobrepõe os parâmetros globais para uma categoria. Campos vazios herdam o padrão global.
          </p>
        </CardHeader>
        <CardContent>
          {taxonomyLoading || loadingRules ? (
            <p className="text-sm text-muted-foreground">Carregando categorias...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma categoria ativa encontrada.</p>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => {
                const r = rules[cat.id] ?? emptyRule();
                const isSaving = savingRule === cat.id;
                return (
                  <div key={cat.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{cat.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveRule(cat.id)}
                        disabled={isSaving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Margem (%)</Label>
                        <NumericInput
                          step="0.1"
                          value={r.marginPct}
                          onChange={(e) => updateRuleField(cat.id, "marginPct", e.target.value)}
                          placeholder={
                            globalMargin ? `Herda: ${formatPercent(parseFloat(globalMargin) / 100)}` : "Herda global"
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Overhead (%)</Label>
                        <NumericInput
                          step="0.1"
                          value={r.overheadPct}
                          onChange={(e) => updateRuleField(cat.id, "overheadPct", e.target.value)}
                          placeholder={
                            globalOhPct ? `Herda: ${formatPercent(parseFloat(globalOhPct) / 100)}` : "Herda global"
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Overhead (R$/un)</Label>
                        <NumericInput
                          step="0.01"
                          value={r.overheadValue}
                          onChange={(e) => updateRuleField(cat.id, "overheadValue", e.target.value)}
                          placeholder={
                            globalOhVal ? `Herda: ${formatCurrency(parseFloat(globalOhVal))}` : "Herda global"
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
