import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Calendar, FileX, Layers, Tag, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface InventoryCycle {
  id: string;
  name: string;
  status: string;
  notes?: string;
  created_at: string;
  started_at?: string;
  closed_at?: string;
  created_by?: string;
  closed_by?: string;
  adjustments_count?: number;
  materials_count?: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  counting: "bg-blue-100 text-blue-800",
  reconciling: "bg-yellow-100 text-yellow-800",
  closed: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  counting: "Em Contagem",
  reconciling: "Em Reconciliação",
  closed: "Fechado",
};

type Scope = "all" | "category" | "random";

export const InventoryCyclesList = () => {
  const [cycles, setCycles] = useState<InventoryCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [cycleName, setCycleName] = useState("");
  const [cycleNotes, setCycleNotes] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [randomPct, setRandomPct] = useState<number>(20);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    loadCycles();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("materials")
      .select("category")
      .eq("tracks_inventory", true)
      .not("category", "is", null);
    if (data) {
      const unique = [...new Set(data.map((d: any) => d.category as string).filter(Boolean))].sort();
      setCategories(unique);
    }
  };

  const loadCycles = async () => {
    try {
      const { data, error } = await supabase
        .from("inventory_cycles")
        .select("id, name, status, notes, created_at, started_at, closed_at, created_by, closed_by")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const cyclesWithCounts = await Promise.all(
        (data || []).map(async (cycle) => {
          const { count: materialsCount } = await supabase
            .from("inventory_adjustments")
            .select("material_id", { count: "exact", head: true })
            .eq("cycle_id", cycle.id);
          const { count: adjustmentsCount } = await supabase
            .from("inventory_adjustments")
            .select("*", { count: "exact", head: true })
            .eq("cycle_id", cycle.id);
          return { ...cycle, adjustments_count: adjustmentsCount || 0, materials_count: materialsCount || 0 };
        })
      );

      setCycles(cyclesWithCounts);
    } catch (error) {
      console.error("Erro ao carregar ciclos:", error);
      toast.error("Erro ao carregar ciclos de inventário");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCycleName("");
    setCycleNotes("");
    setScope("all");
    setSelectedCategory("");
    setRandomPct(20);
  };

  const getMaterialIds = async (): Promise<string[]> => {
    let query = supabase
      .from("materials")
      .select("id")
      .eq("tracks_inventory", true)
      .eq("is_active", true);

    if (scope === "category" && selectedCategory) {
      query = query.eq("category", selectedCategory);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const ids = data.map((m: any) => m.id as string);

    if (scope === "random") {
      const n = Math.max(1, Math.round((ids.length * randomPct) / 100));
      // Fisher-Yates shuffle slice
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.slice(0, n);
    }

    return ids;
  };

  const createCycle = async () => {
    if (!cycleName.trim()) {
      toast.error("Nome do ciclo é obrigatório");
      return;
    }
    if (scope === "category" && !selectedCategory) {
      toast.error("Selecione uma categoria");
      return;
    }

    setCreating(true);
    try {
      // 1. Criar ciclo
      const { data: cycleId, error: cycleErr } = await supabase.rpc(
        "rpc_inventory_create_cycle",
        { p_name: cycleName.trim(), p_notes: cycleNotes.trim() || null }
      );
      if (cycleErr) throw cycleErr;

      // 2. Buscar materiais conforme escopo e pré-popular
      const materialIds = await getMaterialIds();
      if (materialIds.length > 0) {
        const { error: addErr } = await supabase.rpc("rpc_inventory_add_materials", {
          p_cycle_id: cycleId,
          p_material_ids: materialIds,
        });
        if (addErr) {
          console.error("Erro ao adicionar materiais:", addErr);
          toast.warning("Ciclo criado, mas houve erro ao adicionar materiais automaticamente.");
        } else {
          const label =
            scope === "all"
              ? `${materialIds.length} materiais adicionados automaticamente`
              : scope === "category"
              ? `${materialIds.length} materiais da categoria "${selectedCategory}"`
              : `${materialIds.length} materiais selecionados aleatoriamente (${randomPct}%)`;
          toast.success(`Ciclo criado! ${label}.`);
        }
      } else {
        toast.success("Ciclo de inventário criado.");
      }

      setDialogOpen(false);
      resetForm();
      navigate(`/materiais/inventario-ajustes/ciclo/${cycleId}`);
    } catch (error) {
      console.error("Erro ao criar ciclo:", error);
      toast.error("Erro ao criar ciclo de inventário");
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) =>
    format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ciclos de Inventário</h2>
          <p className="text-muted-foreground">
            Gerencie ciclos de inventário físico e reconciliação de estoque
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ciclo
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Ciclo de Inventário</DialogTitle>
              <DialogDescription>
                Defina o nome, escopo e os materiais que farão parte deste ciclo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-1">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="cycleName">Nome do Ciclo *</Label>
                <Input
                  id="cycleName"
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  placeholder="Ex: Inventário Mensal — Junho 2026"
                />
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label htmlFor="cycleNotes">Observações</Label>
                <Textarea
                  id="cycleNotes"
                  value={cycleNotes}
                  onChange={(e) => setCycleNotes(e.target.value)}
                  placeholder="Contexto ou instruções para este ciclo..."
                  rows={2}
                />
              </div>

              {/* Escopo */}
              <div className="space-y-2">
                <Label>Escopo do inventário</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "all",      icon: <Layers   className="h-4 w-4" />, label: "Todos os materiais"    },
                    { value: "category", icon: <Tag      className="h-4 w-4" />, label: "Por categoria"          },
                    { value: "random",   icon: <Shuffle  className="h-4 w-4" />, label: "Amostragem aleatória"   },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setScope(opt.value as Scope)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors ${
                        scope === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {opt.icon}
                      <span className="text-center leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Detalhes do escopo */}
                {scope === "category" && (
                  <div className="mt-2 space-y-1.5">
                    <Label>Categoria</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="_none" disabled>Nenhuma categoria encontrada</SelectItem>
                        ) : (
                          categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {scope === "random" && (
                  <div className="mt-2 space-y-1.5">
                    <Label>Percentual de materiais a amostrar</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={randomPct}
                        onChange={(e) => setRandomPct(Math.min(100, Math.max(1, Number(e.target.value))))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">% dos materiais ativos</span>
                    </div>
                  </div>
                )}

                {/* Hint */}
                <p className="text-xs text-muted-foreground mt-1">
                  {scope === "all"
                    ? "Todos os materiais com controle de estoque ativo serão adicionados ao ciclo."
                    : scope === "category"
                    ? "Somente os materiais da categoria selecionada serão adicionados."
                    : `Aproximadamente ${randomPct}% dos materiais serão selecionados aleatoriamente.`}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createCycle} disabled={creating}>
                {creating ? "Criando..." : "Criar Ciclo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista */}
      {cycles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileX className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum ciclo encontrado</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Crie seu primeiro ciclo de inventário para começar a organizar as contagens de estoque
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Ciclo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todos os Ciclos</CardTitle>
            <CardDescription>
              {cycles.length} ciclo{cycles.length !== 1 ? "s" : ""} de inventário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Materiais</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Iniciado</TableHead>
                  <TableHead>Fechado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell>
                      <div className="font-medium">{cycle.name}</div>
                      {cycle.notes && (
                        <div className="text-xs text-muted-foreground">{cycle.notes}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[cycle.status]}>
                        {statusLabels[cycle.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{cycle.materials_count || 0} materiais</div>
                        <div className="text-muted-foreground text-xs">{cycle.adjustments_count || 0} ajustes</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(cycle.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {cycle.started_at ? (
                        <div className="text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(cycle.started_at)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cycle.closed_at ? (
                        <div className="text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(cycle.closed_at)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/materiais/inventario-ajustes/ciclo/${cycle.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
