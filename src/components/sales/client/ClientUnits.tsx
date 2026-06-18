import React, { useState, useEffect, useRef } from 'react';
import { computeDistanceKmFromCep } from '@/lib/geo';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Building, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Unit {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  distance_km: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  clientId: string;
}

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function ClientUnits({ clientId }: Props) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const originalUnitZip = useRef(''); // CEP carregado, p/ recalcular distância só quando mudar
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    distance_km: null as number | null,
    notes: '',
    is_active: true
  });

  useEffect(() => {
    loadUnits();
  }, [clientId]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_units')
        .select('*')
        .eq('client_id', clientId)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
      toast.error('Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };

  const formatZipCode = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      // Distância automática pelo CEP (recalcula só quando o CEP mudou ou não há valor)
      const cep = (formData.zip_code ?? '').replace(/\D/g, '');
      const origCep = (originalUnitZip.current ?? '').replace(/\D/g, '');
      let distance_km: number | null = formData.distance_km;
      if (cep.length === 8 && (cep !== origCep || distance_km == null)) {
        const d = await computeDistanceKmFromCep(cep);
        if (d != null) distance_km = d;
      }

      const payload = {
        name: formData.name,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        distance_km,
        notes: formData.notes || null,
        is_active: formData.is_active
      };

      if (editingId) {
        const { error } = await supabase
          .from('client_units')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Unidade atualizada!');
      } else {
        const { error } = await supabase
          .from('client_units')
          .insert({ ...payload, client_id: clientId });

        if (error) throw error;
        toast.success('Unidade adicionada!');
      }

      handleCancel();
      loadUnits();
    } catch (error: any) {
      console.error('Erro ao salvar unidade:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma unidade com este nome');
      } else {
        toast.error('Erro ao salvar unidade');
      }
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    originalUnitZip.current = unit.zip_code || '';
    setFormData({
      name: unit.name,
      address: unit.address || '',
      city: unit.city || '',
      state: unit.state || '',
      zip_code: unit.zip_code || '',
      distance_km: unit.distance_km ?? null,
      notes: unit.notes || '',
      is_active: unit.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_units')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Unidade excluída!');
      loadUnits();
    } catch (error) {
      console.error('Erro ao excluir unidade:', error);
      toast.error('Erro ao excluir unidade. Verifique se não há salas vinculadas.');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    originalUnitZip.current = '';
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      distance_km: null,
      notes: '',
      is_active: true
    });
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Unidades / Prédios</h3>
          <Badge variant="secondary">{units.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {units.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>
                    {unit.city || unit.state ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[unit.city, unit.state].filter(Boolean).join(', ')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                      {unit.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(unit)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Excluir a unidade "{unit.name}"? Todas as salas vinculadas também serão excluídas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(unit.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Building className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma unidade cadastrada
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Unidade' : 'Nova Unidade'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="unit-name">Nome *</Label>
              <Input
                id="unit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Sede Administrativa, Fábrica..."
              />
            </div>
            <div>
              <Label htmlFor="unit-address">Endereço</Label>
              <Input
                id="unit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="unit-zip">CEP</Label>
                <Input
                  id="unit-zip"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: formatZipCode(e.target.value) })}
                  placeholder="00000-000"
                />
              </div>
              <div>
                <Label htmlFor="unit-city">Cidade</Label>
                <Input
                  id="unit-city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label htmlFor="unit-state">Estado</Label>
                <Select
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {brazilianStates.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="unit-distance">Distância até a base (km)</Label>
              <Input
                id="unit-distance"
                type="number"
                step="0.1"
                value={formData.distance_km ?? ''}
                onChange={(e) => setFormData({ ...formData, distance_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                placeholder="Calculada pelo CEP"
              />
              <span className="text-xs text-muted-foreground">
                Estimada automaticamente pelo CEP ao salvar (linha reta). Usada no frete da proposta deste local.
              </span>
            </div>
            <div>
              <Label htmlFor="unit-notes">Observações</Label>
              <Textarea
                id="unit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="unit-active">Ativo</Label>
              <Switch
                id="unit-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
