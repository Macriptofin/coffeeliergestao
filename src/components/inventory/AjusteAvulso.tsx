import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MaterialSelect } from "@/components/MaterialSelect";
import { TrendingUp, TrendingDown, AlertTriangle, Lock, CheckCircle, Package, DollarSign } from "lucide-react";
import { format } from "date-fns";

const ADMIN_PASSWORD = "coffeelier2024";

const QTY_REASON_CODES = [
  { value: "quebra",       label: "Quebra / Dano físico" },
  { value: "perda",        label: "Perda / Extravio" },
  { value: "furto",        label: "Furto / Roubo" },
  { value: "vencimento",   label: "Vencimento / Validade" },
  { value: "erro_entrada", label: "Erro de lançamento anterior" },
  { value: "devolucao",    label: "Devolução a fornecedor" },
  { value: "outro",        label: "Outro (descrever nas obs)" },
];

const COST_REASON_CODES = [
  { value: "atualizacao_fornecedor", label: "Atualização de preço do fornecedor" },
  { value: "erro_cadastro",          label: "Erro no cadastro do custo" },
  { value: "pesquisa_mercado",       label: "Pesquisa de mercado / cotação" },
  { value: "revalorizacao",          label: "Revalorização patrimonial" },
  { value: "outro",                  label: "Outro (descrever nas obs)" },
];

const today = format(new Date(), "yyyy-MM-dd");

interface StockSnapshot {
  materialName: string;
  unit: string;
  systemQty: number;
  averagePrice: number;
  totalValue: number;
}

export const AjusteAvulso = () => {
  const [type, setType] = useState<"qty" | "cost">("qty");

  // material
  const [materialId,    setMaterialId]    = useState("");
  const [stockSnapshot, setStockSnapshot] = useState<StockSnapshot | null>(null);
  const [loadingMat,    setLoadingMat]    = useState(false);

  // qty form
  const [physicalQty,  setPhysicalQty]  = useState("");
  const [qtyReasonCode, setQtyReasonCode] = useState("");

  // cost form
  const [newCost,        setNewCost]        = useState("");
  const [costReasonCode, setCostReasonCode] = useState("");

  // shared
  const [reason,       setReason]       = useState("");
  const [responsible,  setResponsible]  = useState("");
  const [occurredAt,   setOccurredAt]   = useState(today);
  const [refDoc,       setRefDoc]       = useState("");
  const [notes,        setNotes]        = useState("");

  // admin confirmation
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [submitting,    setSubmitting]    = useState(false);

  const resetForm = () => {
    setMaterialId(""); setStockSnapshot(null);
    setPhysicalQty(""); setQtyReasonCode("");
    setNewCost(""); setCostReasonCode("");
    setReason(""); setResponsible(""); setOccurredAt(today);
    setRefDoc(""); setNotes("");
  };

  const handleMaterialChange = async (id: string) => {
    setMaterialId(id);
    setStockSnapshot(null);
    if (!id) return;
    setLoadingMat(true);
    try {
      const [{ data: mat }, { data: stock }] = await Promise.all([
        supabase.from("materials").select("name, usage_unit").eq("id", id).single(),
        supabase.from("stock_items").select("current_quantity, average_price, total_value").eq("material_id", id).maybeSingle(),
      ]);
      setStockSnapshot({
        materialName: mat?.name || "",
        unit:         mat?.usage_unit || "",
        systemQty:    parseFloat(stock?.current_quantity?.toString() || "0"),
        averagePrice: parseFloat(stock?.average_price?.toString()   || "0"),
        totalValue:   parseFloat(stock?.total_value?.toString()     || "0"),
      });
    } catch { toast.error("Erro ao buscar dados do material"); }
    finally  { setLoadingMat(false); }
  };

  // calculated values
  const physQtyNum  = parseFloat(physicalQty) || 0;
  const newCostNum  = parseFloat(newCost)     || 0;
  const qtyDiff     = stockSnapshot ? physQtyNum - stockSnapshot.systemQty : 0;
  const costDiff    = stockSnapshot ? newCostNum - stockSnapshot.averagePrice : 0;
  const newTotal    = stockSnapshot ? newCostNum * stockSnapshot.systemQty   : 0;
  const valueDiff   = stockSnapshot ? newTotal - stockSnapshot.totalValue    : 0;

  const canSubmit = () => {
    if (!materialId || !stockSnapshot) return false;
    if (!responsible.trim()) return false;
    if (type === "qty") {
      return physicalQty !== "" && qtyReasonCode !== "" && reason.trim() !== "";
    }
    return newCost !== "" && newCostNum > 0 && costReasonCode !== "" && reason.trim() !== "";
  };

  const handleConfirm = async () => {
    if (adminPassword !== ADMIN_PASSWORD) {
      setPasswordError(true);
      return;
    }
    setPasswordError(false);
    setSubmitting(true);
    try {
      if (type === "qty") {
        const { error } = await supabase.rpc("process_inventory_adjustment", {
          p_material_id:        materialId,
          p_physical_quantity:  physQtyNum,
          p_adjustment_reason:  reason,
          p_reference_document: refDoc || null,
          p_notes:              notes  || null,
          p_reason_code:        qtyReasonCode,
          p_responsible_person: responsible,
          p_occurred_at:        occurredAt,
        });
        if (error) throw error;
        toast.success("Ajuste quantitativo registrado com sucesso.");
      } else {
        const { error } = await supabase.rpc("process_cost_adjustment", {
          p_material_id:        materialId,
          p_new_unit_cost:      newCostNum,
          p_adjustment_reason:  reason,
          p_reference_document: refDoc || null,
          p_notes:              notes  || null,
          p_reason_code:        costReasonCode,
          p_responsible_person: responsible,
          p_occurred_at:        occurredAt,
        });
        if (error) throw error;
        toast.success("Revalorização de custo registrada com sucesso.");
      }
      setConfirmOpen(false);
      setAdminPassword("");
      resetForm();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao processar ajuste: " + (e?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Tipo toggle */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Tipo de ajuste</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setType("qty")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              type === "qty"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary"
            }`}
          >
            <Package className="h-4 w-4" />
            Ajuste de Quantidade
          </button>
          <button
            onClick={() => setType("cost")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              type === "cost"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary"
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Revalorização de Custo
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {type === "qty"
            ? "Use para quebras, perdas, furtos, vencimentos ou erros de lançamento"
            : "Use para atualizar o custo unitário quando o preço de mercado/fornecedor mudou"}
        </p>
      </div>

      {/* Material */}
      <div>
        <Label>Material *</Label>
        <MaterialSelect
          value={materialId}
          onValueChange={handleMaterialChange}
          placeholder="Selecione o material"
        />
      </div>

      {/* Snapshot do saldo atual */}
      {loadingMat && <p className="text-sm text-muted-foreground">Carregando dados...</p>}
      {stockSnapshot && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              Saldo atual — {stockSnapshot.materialName}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Qtd em estoque</p>
                <p className="text-lg font-bold">{stockSnapshot.systemQty} <span className="text-sm font-normal text-muted-foreground">{stockSnapshot.unit}</span></p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo unitário</p>
                <p className="text-lg font-bold">{fmt(stockSnapshot.averagePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="text-lg font-bold">{fmt(stockSnapshot.totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campos específicos por tipo */}
      {stockSnapshot && type === "qty" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade física contada *</Label>
              <Input
                type="number" step="0.001" min="0"
                value={physicalQty}
                onChange={e => setPhysicalQty(e.target.value)}
                placeholder={`Ex: ${stockSnapshot.systemQty}`}
              />
            </div>
            <div className="flex items-end pb-0.5">
              {physicalQty !== "" && (
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1">Diferença calculada</p>
                  <Badge className={`text-sm px-3 py-1 ${
                    qtyDiff === 0 ? "bg-gray-100 text-gray-700" :
                    qtyDiff > 0  ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {qtyDiff === 0 ? <AlertTriangle className="h-4 w-4 mr-1 inline" /> :
                     qtyDiff > 0  ? <TrendingUp    className="h-4 w-4 mr-1 inline" /> :
                                    <TrendingDown  className="h-4 w-4 mr-1 inline" />}
                    {qtyDiff > 0 ? "+" : ""}{qtyDiff.toFixed(3)} {stockSnapshot.unit}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Código de motivo *</Label>
            <Select value={qtyReasonCode} onValueChange={setQtyReasonCode}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {QTY_REASON_CODES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {stockSnapshot && type === "cost" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Novo custo unitário *</Label>
              <Input
                type="number" step="0.0001" min="0.0001"
                value={newCost}
                onChange={e => setNewCost(e.target.value)}
                placeholder="0,0000"
              />
            </div>
            <div className="flex items-end pb-0.5">
              {newCost !== "" && newCostNum > 0 && (
                <div className="w-full space-y-1">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Variação por unidade</p>
                    <Badge className={`text-sm px-3 py-1 ${costDiff >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {costDiff >= 0 ? <TrendingUp className="h-4 w-4 mr-1 inline" /> : <TrendingDown className="h-4 w-4 mr-1 inline" />}
                      {costDiff >= 0 ? "+" : ""}{fmt(costDiff)}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          {newCost !== "" && newCostNum > 0 && (
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor atual do estoque</p>
                    <p className="font-semibold">{fmt(stockSnapshot.totalValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Novo valor do estoque</p>
                    <p className="font-semibold">{fmt(newTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Impacto total</p>
                    <Badge className={`${valueDiff >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {valueDiff >= 0 ? "+" : ""}{fmt(valueDiff)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div>
            <Label>Código de motivo *</Label>
            <Select value={costReasonCode} onValueChange={setCostReasonCode}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
              <SelectContent>
                {COST_REASON_CODES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Campos compartilhados */}
      {stockSnapshot && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Descrição / Motivo detalhado *</Label>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Ex: Material encontrado amassado no recebimento"
              />
            </div>
            <div>
              <Label>Responsável *</Label>
              <Input
                value={responsible}
                onChange={e => setResponsible(e.target.value)}
                placeholder="Nome completo de quem aprovou"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data do ocorrido *</Label>
              <Input type="date" value={occurredAt} onChange={e => setOccurredAt(e.target.value)} />
            </div>
            <div>
              <Label>Documento de referência</Label>
              <Input
                value={refDoc}
                onChange={e => setRefDoc(e.target.value)}
                placeholder="Ex: BO-2024-001, Laudo-Fiscal-02"
              />
            </div>
          </div>

          <div>
            <Label>Observações adicionais</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre o ocorrido..."
              rows={3}
            />
          </div>

          {/* Aviso de auditoria */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              Este ajuste será registrado permanentemente no histórico de movimentações com data, responsável e motivo. Não é possível desfazê-lo após a confirmação.
            </p>
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit()}
            onClick={() => { setAdminPassword(""); setPasswordError(false); setConfirmOpen(true); }}
          >
            <Lock className="h-4 w-4 mr-2" />
            {type === "qty" ? "Registrar Ajuste de Quantidade" : "Registrar Revalorização de Custo"}
          </Button>
        </>
      )}

      {/* Dialog de confirmação com senha admin */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Confirmação Administrativa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
              <p><span className="font-medium">Material:</span> {stockSnapshot?.materialName}</p>
              <p><span className="font-medium">Tipo:</span> {type === "qty" ? "Ajuste de Quantidade" : "Revalorização de Custo"}</p>
              {type === "qty"
                ? <p><span className="font-medium">Diferença:</span> {qtyDiff > 0 ? "+" : ""}{qtyDiff.toFixed(3)} {stockSnapshot?.unit}</p>
                : <p><span className="font-medium">Impacto:</span> {valueDiff >= 0 ? "+" : ""}{fmt(valueDiff)}</p>
              }
              <p><span className="font-medium">Responsável:</span> {responsible}</p>
              <p><span className="font-medium">Motivo:</span> {reason}</p>
            </div>

            <div>
              <Label>Senha de administrador *</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={e => { setAdminPassword(e.target.value); setPasswordError(false); }}
                placeholder="••••••••••"
                className={passwordError ? "border-destructive" : ""}
                onKeyDown={e => { if (e.key === "Enter") handleConfirm(); }}
              />
              {passwordError && (
                <p className="text-xs text-destructive mt-1">Senha incorreta.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={submitting || !adminPassword}>
              {submitting ? "Processando..." : (
                <><CheckCircle className="h-4 w-4 mr-2" />Confirmar Ajuste</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
