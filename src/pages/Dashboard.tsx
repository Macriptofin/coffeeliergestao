import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, ClipboardList, AlertTriangle, TrendingUp,
  DollarSign, Clock, Package, ChevronRight, Users,
  CheckCircle2, XCircle, Loader2
} from "lucide-react";
import { EventCalendar } from "@/components/agenda/EventCalendar";
import { todayLocalISO, addDaysLocalISO } from "@/lib/date-utils";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface DashboardEvent {
  id: string; event_name: string; event_date: string;
  status: string; venue?: string;
  total_people: number; total_weight: number; total_amount: number;
  clients?: { name: string };
}

interface KpiData {
  // Comercial
  eventosProximos7: number;
  eventosProximos30: number;
  proximoEvento: { nome: string; data: string; pessoas: number; cliente: string } | null;
  propostasPendentes: number;
  // Operacional
  ordensPendentes: number;
  ordensEmAndamento: number;
  materiaisAbaixoMinimo: number;
  materiaisZerados: number;
  // Financeiro
  contasReceberVencidas: number;
  contasPagarProximas7: number;
  totalReceberVencido: number;
  totalPagarProximas7: number;
}

const EMPTY_KPI: KpiData = {
  eventosProximos7: 0, eventosProximos30: 0, proximoEvento: null,
  propostasPendentes: 0, ordensPendentes: 0, ordensEmAndamento: 0,
  materiaisAbaixoMinimo: 0, materiaisZerados: 0,
  contasReceberVencidas: 0, contasPagarProximas7: 0,
  totalReceberVencido: 0, totalPagarProximas7: 0,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const today = () => todayLocalISO();
const inDays = (d: number) => addDaysLocalISO(d);

// ─── Componente ─────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [kpi, setKpi] = useState<KpiData>(EMPTY_KPI);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([loadKpis(), loadCalendarEvents()]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarEvents = async () => {
    const { data } = await supabase
      .from("events")
      .select("*, clients(name)")
      .order("event_date", { ascending: true });
    setEvents(data || []);
  };

  const loadKpis = async () => {
    const td = today();
    const in7 = inDays(7);
    const in30 = inDays(30);

    const [
      evts7, evts30, nextEvt,
      proposals,
      ordPending, ordActive,
      stockLow, stockZero,
      apVencido, apProximo,
    ] = await Promise.all([
      // Eventos próximos 7 dias
      supabase.from("events").select("id", { count: "exact", head: true })
        .gte("event_date", td).lte("event_date", in7).neq("status", "cancelado"),

      // Eventos próximos 30 dias
      supabase.from("events").select("id", { count: "exact", head: true })
        .gte("event_date", td).lte("event_date", in30).neq("status", "cancelado"),

      // Próximo evento
      supabase.from("events").select("event_name, event_date, total_people, clients(name)")
        .gte("event_date", td).neq("status", "cancelado")
        .order("event_date", { ascending: true }).limit(1),

      // Propostas pendentes (rascunho ou enviada)
      supabase.from("proposals").select("id", { count: "exact", head: true })
        .in("status", ["rascunho", "enviada"]),

      // OPs pendentes
      supabase.from("bom_production_orders").select("id", { count: "exact", head: true })
        .eq("status", "Planejado"),

      // OPs em andamento
      supabase.from("bom_production_orders").select("id", { count: "exact", head: true })
        .eq("status", "Em Produção"),

      // Materiais abaixo do mínimo
      supabase.from("vw_stock_available").select("material_id", { count: "exact", head: true })
        .in("status_estoque", ["critico", "baixo"]),

      // Materiais zerados
      supabase.from("vw_stock_available").select("material_id", { count: "exact", head: true })
        .eq("status_estoque", "zerado"),

      // Contas a receber vencidas
      supabase.from("accounts_receivable").select("remaining_amount")
        .lt("due_date", td).eq("status", "pendente"),

      // Contas a pagar próximos 7 dias
      supabase.from("accounts_payable").select("remaining_amount")
        .gte("due_date", td).lte("due_date", in7).eq("status", "pendente"),
    ]);

    const proxEvt = nextEvt.data?.[0];

    setKpi({
      eventosProximos7:   evts7.count   ?? 0,
      eventosProximos30:  evts30.count  ?? 0,
      proximoEvento: proxEvt ? {
        nome:    proxEvt.event_name,
        data:    proxEvt.event_date,
        pessoas: proxEvt.total_people ?? 0,
        cliente: (proxEvt as any).clients?.name ?? "—",
      } : null,
      propostasPendentes:   proposals.count ?? 0,
      ordensPendentes:      ordPending.count ?? 0,
      ordensEmAndamento:    ordActive.count  ?? 0,
      materiaisAbaixoMinimo: stockLow.count  ?? 0,
      materiaisZerados:      stockZero.count ?? 0,
      contasReceberVencidas: apVencido.data?.length ?? 0,
      contasPagarProximas7:  apProximo.data?.length ?? 0,
      totalReceberVencido:   apVencido.data?.reduce((s, r) => s + parseFloat(r.remaining_amount ?? '0'), 0) ?? 0,
      totalPagarProximas7:   apProximo.data?.reduce((s, r) => s + parseFloat(r.remaining_amount ?? '0'), 0) ?? 0,
    });
  };

  if (showLoader) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão operacional em tempo real</p>
      </div>

      {/* ── BLOCO 1: COMERCIAL ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Comercial
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/agenda")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Eventos esta semana</CardTitle>
                <Calendar className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-primary">{kpi.eventosProximos7}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.eventosProximos30} nos próximos 30 dias</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow col-span-1 sm:col-span-2"
            onClick={() => navigate("/agenda")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Próximo evento</CardTitle>
                <Calendar className="h-4 w-4 text-accent-coffee" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {kpi.proximoEvento ? (
                <div>
                  <p className="font-semibold text-base leading-tight">{kpi.proximoEvento.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(kpi.proximoEvento.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                    &nbsp;·&nbsp;{kpi.proximoEvento.pessoas} pessoas
                    &nbsp;·&nbsp;{kpi.proximoEvento.cliente}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum evento agendado</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/vendas")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Propostas pendentes</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-blue-600">{kpi.propostasPendentes}</div>
              <p className="text-xs text-muted-foreground mt-1">aguardando aprovação</p>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ── BLOCO 2: OPERACIONAL ────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Operacional
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/producao/planejamento")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ordens em andamento</CardTitle>
                <ClipboardList className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-orange-500">{kpi.ordensEmAndamento}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.ordensPendentes} pendentes</p>
            </CardContent>
          </Card>

          <Card className={`shadow-soft cursor-pointer hover:shadow-md transition-shadow ${kpi.materiaisZerados > 0 ? "border-red-200" : ""}`}
            onClick={() => navigate("/materiais/controle")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estoque crítico</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${kpi.materiaisZerados > 0 ? "text-red-500" : "text-yellow-500"}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-3xl font-bold ${kpi.materiaisZerados > 0 ? "text-red-600" : "text-yellow-600"}`}>
                {kpi.materiaisAbaixoMinimo}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                abaixo do mínimo · {kpi.materiaisZerados} zerados
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/producao/fichas-tecnicas")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ordens pendentes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold">{kpi.ordensPendentes}</div>
              <p className="text-xs text-muted-foreground mt-1">aguardando início</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/materiais/controle")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Materiais zerados</CardTitle>
                <Package className="h-4 w-4 text-red-400" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-3xl font-bold ${kpi.materiaisZerados > 0 ? "text-red-600" : "text-green-600"}`}>
                {kpi.materiaisZerados}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpi.materiaisZerados === 0 ? "tudo ok" : "requer atenção"}
              </p>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ── BLOCO 3: FINANCEIRO ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Financeiro
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Card className={`shadow-soft cursor-pointer hover:shadow-md transition-shadow ${kpi.contasReceberVencidas > 0 ? "border-red-200" : ""}`}
            onClick={() => navigate("/financeiro/receber")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">A receber vencidas</CardTitle>
                <DollarSign className={`h-4 w-4 ${kpi.contasReceberVencidas > 0 ? "text-red-500" : "text-green-500"}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className={`text-2xl font-bold ${kpi.contasReceberVencidas > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmt(kpi.totalReceberVencido)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpi.contasReceberVencidas} {kpi.contasReceberVencidas === 1 ? "conta vencida" : "contas vencidas"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate("/financeiro/pagar")}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">A pagar (próximos 7 dias)</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-bold text-orange-600">
                {fmt(kpi.totalPagarProximas7)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpi.contasPagarProximas7} {kpi.contasPagarProximas7 === 1 ? "conta" : "contas"} nos próximos 7 dias
              </p>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* ── CALENDÁRIO ──────────────────────────────────────────────────── */}
      <section>
        <EventCalendar
          events={events}
          onEventSelect={(event) => navigate("/agenda")}
          onEventCreate={(_date) => navigate("/agenda")}
        />
      </section>
    </div>
  );
};

export default Dashboard;
