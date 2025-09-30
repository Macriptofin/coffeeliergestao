import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Calendar, User, FileX } from "lucide-react";
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
  // Campos calculados
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

export const InventoryCyclesList = () => {
  const [cycles, setCycles] = useState<InventoryCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newCycleName, setNewCycleName] = useState("");
  const [newCycleNotes, setNewCycleNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCycles();
  }, []);

  const loadCycles = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_cycles')
        .select(`
          id,
          name,
          status,
          notes,
          created_at,
          started_at,
          closed_at,
          created_by,
          closed_by
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar contagens de ajustes para cada ciclo
      const cyclesWithCounts = await Promise.all(
        (data || []).map(async (cycle) => {
          const { count: adjustmentsCount } = await supabase
            .from('inventory_adjustments')
            .select('*', { count: 'exact', head: true })
            .eq('cycle_id', cycle.id);

          const { count: materialsCount } = await supabase
            .from('inventory_adjustments')
            .select('material_id', { count: 'exact', head: true })
            .eq('cycle_id', cycle.id);

          return {
            ...cycle,
            adjustments_count: adjustmentsCount || 0,
            materials_count: materialsCount || 0,
          };
        })
      );

      setCycles(cyclesWithCounts);
    } catch (error) {
      console.error('Erro ao carregar ciclos:', error);
      toast.error('Erro ao carregar ciclos de inventário');
    } finally {
      setLoading(false);
    }
  };

  const createCycle = async () => {
    if (!newCycleName.trim()) {
      toast.error('Nome do ciclo é obrigatório');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('rpc_inventory_create_cycle', {
        p_name: newCycleName.trim(),
        p_notes: newCycleNotes.trim() || null,
      });

      if (error) throw error;

      toast.success('Ciclo de inventário criado com sucesso!');
      setDialogOpen(false);
      setNewCycleName("");
      setNewCycleNotes("");
      loadCycles();
      
      // Navegar para o ciclo criado
      navigate(`/estoque/inventario-ajustes/ciclo/${data}`);
    } catch (error) {
      console.error('Erro ao criar ciclo:', error);
      toast.error('Erro ao criar ciclo de inventário');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de criar */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ciclos de Inventário</h2>
          <p className="text-muted-foreground">
            Gerencie ciclos de inventário físico e reconciliação de estoque
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ciclo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Ciclo de Inventário</DialogTitle>
              <DialogDescription>
                Configure um novo ciclo para organizar a contagem e reconciliação de estoque
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="cycleName">Nome do Ciclo *</Label>
                <Input
                  id="cycleName"
                  value={newCycleName}
                  onChange={(e) => setNewCycleName(e.target.value)}
                  placeholder="Ex: Inventário Mensal - Janeiro 2024"
                />
              </div>
              
              <div>
                <Label htmlFor="cycleNotes">Observações</Label>
                <Textarea
                  id="cycleNotes"
                  value={newCycleNotes}
                  onChange={(e) => setNewCycleNotes(e.target.value)}
                  placeholder="Observações sobre este ciclo de inventário..."
                  rows={3}
                />
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

      {/* Lista de ciclos */}
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
              {cycles.length} ciclo{cycles.length !== 1 ? 's' : ''} de inventário
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
                      <div>
                        <div className="font-medium">{cycle.name}</div>
                        {cycle.notes && (
                          <div className="text-sm text-muted-foreground">
                            {cycle.notes}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[cycle.status]}>
                        {statusLabels[cycle.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{cycle.materials_count || 0} materiais</div>
                        <div className="text-muted-foreground">
                          {cycle.adjustments_count || 0} ajustes
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(cycle.created_at)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {cycle.started_at ? (
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(cycle.started_at)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {cycle.closed_at ? (
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(cycle.closed_at)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/estoque/inventario-ajustes/ciclo/${cycle.id}`)}
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