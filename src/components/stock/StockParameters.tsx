import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StockParameter {
  id: string;
  material_id: string;
  material_name: string;
  abc_classification: string;
  minimum_stock: number;
  maximum_stock: number;
  reorder_point: number;
  safety_stock: number;
  lead_time_days: number;
  review_period_days: number;
  unit: string;
  is_active: boolean;
  notes?: string;
}

export function StockParameters() {
  const [parameters, setParameters] = useState<StockParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StockParameter>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadParameters();
  }, []);

  const loadParameters = async () => {
    try {
      const { data: params, error } = await supabase
        .from('stock_parameters')
        .select(`
          *,
          materials (
            name
          )
        `)
        .order('abc_classification', { ascending: true });

      if (error) throw error;

      setParameters(params?.map(p => ({
        ...p,
        material_name: p.materials?.name || 'N/A'
      })) || []);
    } catch (error) {
      console.error('Erro ao carregar parâmetros:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os parâmetros de estoque",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (param: StockParameter) => {
    setEditingId(param.id);
    setEditForm(param);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('stock_parameters')
        .update({
          abc_classification: editForm.abc_classification,
          minimum_stock: editForm.minimum_stock,
          maximum_stock: editForm.maximum_stock,
          reorder_point: editForm.reorder_point,
          safety_stock: editForm.safety_stock,
          lead_time_days: editForm.lead_time_days,
          review_period_days: editForm.review_period_days,
          is_active: editForm.is_active,
          notes: editForm.notes
        })
        .eq('id', editingId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Parâmetros atualizados com sucesso"
      });

      loadParameters();
      cancelEdit();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os parâmetros",
        variant: "destructive"
      });
    }
  };

  const getClassColor = (classification: string) => {
    switch (classification) {
      case 'A': return 'text-red-600 font-bold';
      case 'B': return 'text-yellow-600 font-semibold';
      case 'C': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  if (loading) return <div className="text-center py-8">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Parâmetro
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>ABC</TableHead>
              <TableHead>Estoque Mín.</TableHead>
              <TableHead>Estoque Máx.</TableHead>
              <TableHead>Ponto Pedido</TableHead>
              <TableHead>Estoque Seg.</TableHead>
              <TableHead>Lead Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((param) => (
              <TableRow key={param.id}>
                {editingId === param.id ? (
                  <>
                    <TableCell>{param.material_name}</TableCell>
                    <TableCell>
                      <Select
                        value={editForm.abc_classification}
                        onValueChange={(value) => setEditForm({ ...editForm, abc_classification: value })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="N/A">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.minimum_stock}
                        onChange={(e) => setEditForm({ ...editForm, minimum_stock: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.maximum_stock}
                        onChange={(e) => setEditForm({ ...editForm, maximum_stock: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.reorder_point}
                        onChange={(e) => setEditForm({ ...editForm, reorder_point: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.safety_stock}
                        onChange={(e) => setEditForm({ ...editForm, safety_stock: parseFloat(e.target.value) })}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={editForm.lead_time_days}
                        onChange={(e) => setEditForm({ ...editForm, lead_time_days: parseInt(e.target.value) })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={editForm.is_active ? 'active' : 'inactive'}
                        onValueChange={(value) => setEditForm({ ...editForm, is_active: value === 'active' })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={saveEdit}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>{param.material_name}</TableCell>
                    <TableCell>
                      <span className={getClassColor(param.abc_classification)}>
                        {param.abc_classification}
                      </span>
                    </TableCell>
                    <TableCell>{param.minimum_stock} {param.unit}</TableCell>
                    <TableCell>{param.maximum_stock} {param.unit}</TableCell>
                    <TableCell>{param.reorder_point} {param.unit}</TableCell>
                    <TableCell>{param.safety_stock} {param.unit}</TableCell>
                    <TableCell>{param.lead_time_days} dias</TableCell>
                    <TableCell>
                      <span className={param.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                        {param.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(param)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}