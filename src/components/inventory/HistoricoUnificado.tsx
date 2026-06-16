import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, RefreshCw, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatLocalDate } from "@/lib/date-utils";

interface Movement {
  id: string;
  material_id: string;
  material_name: string;
  material_unit: string;
  movement_type: string;
  quantity: number;
  unit_price?: number;
  total_cost?: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  responsible_person?: string;
  created_at: string;
}

const MOVEMENT_CONFIGS: Record<string, { label: string; color: string; dot: string; sign: 1 | -1 | 0 }> = {
  "Compra":     { label: "Entrada NF",          color: "bg-green-100 text-green-800", dot: "bg-green-500", sign:  1 },
  "Entrada":    { label: "Entrada",             color: "bg-green-100 text-green-800", dot: "bg-green-500", sign:  1 },
  "Devolução":  { label: "Devolução",           color: "bg-green-100 text-green-700", dot: "bg-green-400", sign:  1 },
  "Produção":   { label: "Saída — Produção",    color: "bg-red-100 text-red-800",     dot: "bg-red-500",   sign: -1 },
  "Saída":      { label: "Saída",               color: "bg-red-100 text-red-800",     dot: "bg-red-500",   sign: -1 },
  "Venda":      { label: "Saída — Venda",       color: "bg-red-100 text-red-800",     dot: "bg-red-500",   sign: -1 },
  "Perda":      { label: "Perda / Quebra",      color: "bg-red-100 text-red-800",     dot: "bg-red-500",   sign: -1 },
  "Ajuste":     { label: "Ajuste",              color: "bg-amber-100 text-amber-800", dot: "bg-amber-500", sign:  0 },
};

const getConfig = (type: string) => MOVEMENT_CONFIGS[type] || { label: type, color: "bg-gray-100 text-gray-700", dot: "bg-gray-400", sign: 0 as 0 };

const today = format(new Date(), "yyyy-MM-dd");
const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

interface HistoricoData {
  movements: Movement[];
  materials: { id: string; name: string }[];
}

const EMPTY_HISTORICO: HistoricoData = { movements: [], materials: [] };

async function fetchHistorico(): Promise<HistoricoData> {
  const [movRes, matRes] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("materials")
      .select("id, name, usage_unit")
      .eq("tracks_inventory", true)
      .order("name"),
  ]);
  if (movRes.error) throw movRes.error;

  const matMap = new Map((matRes.data || []).map((m: any) => [m.id, m]));
  const movements = (movRes.data || []).map((m: any) => ({
    ...m,
    material_name: matMap.get(m.material_id)?.name    || "—",
    material_unit: matMap.get(m.material_id)?.usage_unit || "",
  }));

  return { movements, materials: matRes.data || [] };
}

export const HistoricoUnificado = () => {
  const {
    data = EMPTY_HISTORICO,
    isPending: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["historico-unificado"],
    queryFn: fetchHistorico,
  });
  const { movements, materials } = data;

  useEffect(() => {
    if (isError) toast.error("Erro ao carregar histórico");
  }, [isError]);

  // filters
  const [search,       setSearch]       = useState("");
  const [matFilter,    setMatFilter]    = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [dateStart,    setDateStart]    = useState(monthStart);
  const [dateEnd,      setDateEnd]      = useState(today);
  const [monthQuick,   setMonthQuick]   = useState("current");

  const applyQuick = (q: string) => {
    setMonthQuick(q);
    const now = new Date();
    if (q === "current") {
      setDateStart(format(startOfMonth(now),         "yyyy-MM-dd"));
      setDateEnd(format(endOfMonth(now),             "yyyy-MM-dd"));
    } else if (q === "last") {
      const last = subMonths(now, 1);
      setDateStart(format(startOfMonth(last),        "yyyy-MM-dd"));
      setDateEnd(format(endOfMonth(last),            "yyyy-MM-dd"));
    } else {
      setDateStart(""); setDateEnd("");
    }
  };

  const filtered = useMemo(() => {
    return movements.filter(m => {
      const matchSearch = m.material_name.toLowerCase().includes(search.toLowerCase()) ||
                          (m.notes || "").toLowerCase().includes(search.toLowerCase()) ||
                          (m.responsible_person || "").toLowerCase().includes(search.toLowerCase());
      const matchMat    = matFilter  === "all" || m.material_id === matFilter;
      const matchType   = typeFilter === "all" || m.movement_type === typeFilter;
      const movDate     = m.created_at.slice(0, 10);
      const matchDate   = (!dateStart || movDate >= dateStart) && (!dateEnd || movDate <= dateEnd);
      return matchSearch && matchMat && matchType && matchDate;
    });
  }, [movements, search, matFilter, typeFilter, dateStart, dateEnd]);

  // totals
  const totalEntradas = filtered
    .filter(m => getConfig(m.movement_type).sign === 1)
    .reduce((s, m) => s + m.quantity, 0);
  const totalSaidas = filtered
    .filter(m => getConfig(m.movement_type).sign === -1)
    .reduce((s, m) => s + m.quantity, 0);

  const movTypes = [...new Set(movements.map(m => m.movement_type))].sort();

  if (loading) return <div className="py-12 text-center text-muted-foreground text-sm">Carregando histórico...</div>;

  return (
    <div className="space-y-4">
      {/* Totalizadores */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground font-medium">Entradas no período</span>
            </div>
            <p className="text-xl font-bold text-green-700">{filtered.filter(m => getConfig(m.movement_type).sign === 1).length} movimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground font-medium">Saídas no período</span>
            </div>
            <p className="text-xl font-bold text-red-600">{filtered.filter(m => getConfig(m.movement_type).sign === -1).length} movimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground font-medium">Ajustes no período</span>
            </div>
            <p className="text-xl font-bold text-amber-700">{filtered.filter(m => getConfig(m.movement_type).sign === 0).length} movimentos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          {/* Linha 1: busca + material + tipo */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar material, obs, responsável..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={matFilter} onValueChange={setMatFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os materiais</SelectItem>
                {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {movTypes.map(t => <SelectItem key={t} value={t}>{getConfig(t).label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 2: período */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Período:</span>
            {[{ v: "current", l: "Este mês" }, { v: "last", l: "Mês passado" }, { v: "all", l: "Todos" }].map(q => (
              <button key={q.v} onClick={() => applyQuick(q.v)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  monthQuick === q.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}>
                {q.l}
              </button>
            ))}
            <div className="flex gap-2 ml-2">
              <Input type="date" value={dateStart} className="w-36 h-8 text-sm"
                onChange={e => { setDateStart(e.target.value); setMonthQuick(""); }} />
              <span className="text-muted-foreground self-center">—</span>
              <Input type="date" value={dateEnd} className="w-36 h-8 text-sm"
                onChange={e => { setDateEnd(e.target.value); setMonthQuick(""); }} />
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{filtered.length} movimentos encontrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Data</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="w-36">Tipo</TableHead>
                <TableHead className="w-28 text-right">Quantidade</TableHead>
                <TableHead>Origem / Documento</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhum movimento encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(m => {
                const cfg  = getConfig(m.movement_type);
                const sign = cfg.sign;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(m.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{m.material_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                        <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span className={sign === 1 ? "text-green-700" : sign === -1 ? "text-red-600" : "text-amber-700"}>
                        {sign === 1 ? "+" : sign === -1 ? "−" : "±"}
                        {m.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">{m.material_unit}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.reference_type && (
                        <span className="font-medium text-foreground">
                          {m.reference_type.replace(/_/g, " ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{m.responsible_person || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={m.notes || ""}>
                      {m.notes || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
