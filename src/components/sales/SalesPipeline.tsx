import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  TrendingUp,
  Trophy,
  Wallet,
  Percent,
  Clock,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { formatLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";

// ── Estágios do funil ─────────────────────────────────────────────────────
type Stage =
  | "Rascunho"
  | "Enviada"
  | "Aprovada pelo Cliente"
  | "Aprovada"
  | "Rejeitada"
  | "Cancelada";

const OPEN_STAGES: Stage[] = ["Rascunho", "Enviada", "Aprovada pelo Cliente"];
const WON_STAGES: Stage[] = ["Aprovada"];
const LOST_STAGES: Stage[] = ["Rejeitada", "Cancelada"];

// Opções de movimentação disponíveis no card
const MOVE_OPTIONS: Stage[] = [
  "Enviada",
  "Aprovada pelo Cliente",
  "Aprovada",
  "Rejeitada",
  "Cancelada",
];

const LOSS_REASONS = ["Preço", "Concorrência", "Prazo", "Sem retorno", "Outro"];

// Colunas visuais (Perdidas agrupa Rejeitada+Cancelada)
const COLUMNS: { key: string; title: string; stages: Stage[] }[] = [
  { key: "Rascunho", title: "Rascunho", stages: ["Rascunho"] },
  { key: "Enviada", title: "Enviada", stages: ["Enviada"] },
  {
    key: "Aprovada pelo Cliente",
    title: "Aprovada pelo Cliente",
    stages: ["Aprovada pelo Cliente"],
  },
  { key: "Aprovada", title: "Aprovada", stages: ["Aprovada"] },
  { key: "Perdidas", title: "Perdidas", stages: ["Rejeitada", "Cancelada"] },
];

// Chaves de probabilidade em app_settings (fração string)
const PROB_KEYS = {
  Rascunho: "pipeline.prob_rascunho",
  Enviada: "pipeline.prob_enviada",
  "Aprovada pelo Cliente": "pipeline.prob_aprovada_cliente",
} as const;

const PROB_FALLBACK: Record<string, number> = {
  Rascunho: 0.1,
  Enviada: 0.4,
  "Aprovada pelo Cliente": 0.8,
};

interface ProposalRow {
  id: string;
  proposal_number: string | null;
  revision: number | null;
  status: Stage;
  total_amount: number | null;
  total_cost: number | null;
  event_date: string | null;
  number_of_people: number | null;
  loss_reason: string | null;
  approved_at: string | null;
  created_at: string | null;
  is_umbrella: boolean | null;
  clients: { name: string | null; fantasy_name: string | null } | null;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const avg = (arr: number[]) => (arr.length ? sum(arr) / arr.length : null);

const marginFrac = (p: ProposalRow): number | null => {
  if (p.total_cost == null || !p.total_amount || p.total_amount <= 0) return null;
  return (p.total_amount - p.total_cost) / p.total_amount;
};

const SalesPipeline = () => {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingLoss, setPendingLoss] = useState<{ id: string; status: Stage } | null>(
    null,
  );
  const [lossReason, setLossReason] = useState<string>("");
  const [movingId, setMovingId] = useState<string | null>(null);

  // ── Propostas ──────────────────────────────────────────────────────────
  // Chave PRÓPRIA (['proposals','pipeline']): este select é parcial (sem
  // proposal_kind/event_category); compartilhar ['proposals'] com a lista de
  // Propostas fazia o Funil sobrescrever o cache dela com linhas incompletas
  // (badges viravam "Produto"/"—"). O prefixo comum mantém as invalidações
  // de ['proposals'] atingindo os dois.
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals", "pipeline"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(
          "id, proposal_number, revision, status, total_amount, total_cost, event_date, number_of_people, loss_reason, approved_at, created_at, is_umbrella, clients(name, fantasy_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProposalRow[];
    },
  });

  // ── Probabilidades ───────────────────────────────────────────────────────
  const { data: probs = PROB_FALLBACK } = useQuery({
    queryKey: ["pipeline-probs"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", Object.values(PROB_KEYS));
      if (error) throw error;
      const map = new Map((data || []).map((r) => [r.key, r.value]));
      const parse = (k: string, fb: number) => {
        const v = map.get(k);
        const n = v != null ? parseFloat(v) : NaN;
        return isNaN(n) ? fb : n;
      };
      return {
        Rascunho: parse(PROB_KEYS.Rascunho, PROB_FALLBACK.Rascunho),
        Enviada: parse(PROB_KEYS.Enviada, PROB_FALLBACK.Enviada),
        "Aprovada pelo Cliente": parse(
          PROB_KEYS["Aprovada pelo Cliente"],
          PROB_FALLBACK["Aprovada pelo Cliente"],
        ),
      } as Record<string, number>;
    },
  });

  // ── KPIs ───────────────────────────────────────────────────────────────
  const open = proposals.filter((p) => OPEN_STAGES.includes(p.status));
  const won = proposals.filter((p) => WON_STAGES.includes(p.status));
  const lost = proposals.filter((p) => LOST_STAGES.includes(p.status));

  const openValue = sum(open.map((p) => p.total_amount || 0));
  const forecast = sum(
    open.map((p) => (p.total_amount || 0) * (probs[p.status] ?? 0)),
  );
  const winRate =
    won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null;
  const ticketMedio = avg(won.map((p) => p.total_amount || 0));
  const margemMedia = avg(
    won.map(marginFrac).filter((m): m is number => m != null),
  );
  const cicloDias = avg(
    won
      .filter((p) => p.approved_at && p.created_at)
      .map(
        (p) =>
          (new Date(p.approved_at as string).getTime() -
            new Date(p.created_at as string).getTime()) /
          86_400_000,
      ),
  );

  // ── Mutações de estágio ───────────────────────────────────────────────────
  const handleMove = async (p: ProposalRow, novo: Stage) => {
    if (novo === p.status) return;

    // Guarda-chuva aprovada NUNCA volta de estágio pelo funil: reaprovar
    // dispara create_event_from_proposal/generate_production_from_proposal,
    // que apagam e recriam eventos/ordens — destruindo as execuções já
    // lançadas (checklists/anexos têm ON DELETE CASCADE). Mesma trava da
    // lista de propostas (que só oferece "Ver saldo e execuções").
    if (p.is_umbrella && p.status === "Aprovada") {
      toast.error(
        'Proposta guarda-chuva aprovada não muda de estágio — gerencie pelas execuções em Propostas ("Ver saldo e execuções").',
      );
      return;
    }

    // Perda → pedir motivo
    if (LOST_STAGES.includes(novo)) {
      setPendingLoss({ id: p.id, status: novo });
      setLossReason("");
      setDialogOpen(true);
      return;
    }

    setMovingId(p.id);
    try {
      if (novo === "Aprovada") {
        // Aprovação final — replica ProposalsList.handleApprove
        await supabase.from("proposals").update({ status: "Aprovada" }).eq("id", p.id);
        const { error: evtErr } = await (supabase.rpc as any)(
          "create_event_from_proposal",
          { p_proposal_id: p.id },
        );
        const { error: prodErr } = await supabase.rpc(
          "generate_production_from_proposal",
          { p_proposal_id: p.id },
        );
        if (evtErr) console.warn("create_event_from_proposal:", evtErr.message);
        if (prodErr)
          console.warn("generate_production_from_proposal:", prodErr.message);
        toast.success("Proposta aprovada! Evento e ordem de produção criados.");
      } else {
        // 'Enviada' ou 'Aprovada pelo Cliente'
        const { error } = await supabase
          .from("proposals")
          .update({ status: novo })
          .eq("id", p.id);
        if (error) throw error;
        toast.success(`Proposta movida para "${novo}".`);
      }
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao mover proposta");
    } finally {
      setMovingId(null);
    }
  };

  const confirmLoss = async () => {
    if (!pendingLoss || !lossReason) return;
    setMovingId(pendingLoss.id);
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ status: pendingLoss.status, loss_reason: lossReason })
        .eq("id", pendingLoss.id);
      if (error) throw error;
      toast.success(`Proposta marcada como "${pendingLoss.status}".`);
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      setDialogOpen(false);
      setPendingLoss(null);
      setLossReason("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar perda");
    } finally {
      setMovingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: "Valor em aberto",
      value: formatCurrency(openValue),
      icon: Wallet,
    },
    {
      label: "Forecast (receita prevista)",
      value: formatCurrency(forecast),
      icon: TrendingUp,
    },
    {
      label: "Win rate",
      value: winRate == null ? "—" : formatPercent(winRate),
      icon: Trophy,
    },
    {
      label: "Ticket médio",
      value: ticketMedio == null ? "—" : formatCurrency(ticketMedio),
      icon: Wallet,
    },
    {
      label: "Margem média",
      value: margemMedia == null ? "—" : formatPercent(margemMedia),
      icon: Percent,
    },
    {
      label: "Ciclo médio (dias)",
      value: cicloDias == null ? "—" : Math.round(cicloDias).toString(),
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Icon className="h-4 w-4" />
                  <span>{k.label}</span>
                </div>
                <div className="text-lg font-semibold">{k.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Kanban ── */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando funil...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const cards = proposals.filter((p) => col.stages.includes(p.status));
            const colTotal = sum(cards.map((c) => c.total_amount || 0));
            return (
              <div
                key={col.key}
                className="flex flex-col bg-muted/40 rounded-lg p-3 min-h-[120px]"
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{col.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(colTotal)}
                  </div>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[60vh]">
                  {cards.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhuma proposta
                    </p>
                  ) : (
                    cards.map((p) => {
                      const m = marginFrac(p);
                      const clientName =
                        p.clients?.fantasy_name || p.clients?.name || "Sem cliente";
                      return (
                        <Card key={p.id} className="border">
                          <CardContent className="p-3 space-y-2">
                            <div>
                              <div className="font-medium text-sm leading-tight">
                                {clientName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.proposal_number || "—"}
                                {(p.revision ?? 1) > 1 && ` · Rev. ${p.revision}`}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold">
                                {formatCurrency(p.total_amount)}
                              </span>
                              <span
                                className={
                                  m == null
                                    ? "text-muted-foreground text-xs"
                                    : m >= 0
                                      ? "text-green-600 text-xs font-medium"
                                      : "text-red-600 text-xs font-medium"
                                }
                              >
                                {m == null ? "—" : formatPercent(m)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {p.event_date ? formatLocalDate(p.event_date) : "—"}
                            </div>

                            {p.is_umbrella && p.status === "Aprovada" ? (
                              // Guarda-chuva em execução não muda de estágio (ver handleMove)
                              <div className="h-8 flex items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
                                Recorrente — via Propostas
                              </div>
                            ) : (
                              <Select
                                value=""
                                onValueChange={(v) => handleMove(p, v as Stage)}
                                disabled={movingId === p.id}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Mover estágio..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {MOVE_OPTIONS.filter((s) => s !== p.status).map(
                                    (s) => (
                                      <SelectItem key={s} value={s} className="text-xs">
                                        {s}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog de motivo de perda ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da perda</DialogTitle>
            <DialogDescription>
              Selecione o motivo pelo qual esta proposta foi{" "}
              {pendingLoss?.status === "Cancelada" ? "cancelada" : "rejeitada"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo</Label>
            <Select value={lossReason} onValueChange={setLossReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmLoss} disabled={!lossReason}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPipeline;
