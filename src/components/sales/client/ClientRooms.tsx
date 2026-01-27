import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, DoorOpen, Users } from 'lucide-react';
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

interface Room {
  id: string;
  client_id: string;
  unit_id: string;
  name: string;
  floor: string | null;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
}

interface Props {
  clientId: string;
}

export default function ClientRooms({ clientId }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    unit_id: '',
    name: '',
    floor: '',
    capacity: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roomsRes, unitsRes] = await Promise.all([
        supabase
          .from('client_rooms')
          .select('*')
          .eq('client_id', clientId)
          .order('name'),
        supabase
          .from('client_units')
          .select('id, name')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (roomsRes.error) throw roomsRes.error;
      if (unitsRes.error) throw unitsRes.error;

      setRooms(roomsRes.data || []);
      setUnits(unitsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar salas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.unit_id) {
      toast.error('Selecione uma unidade');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const payload = {
        unit_id: formData.unit_id,
        name: formData.name,
        floor: formData.floor || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        notes: formData.notes || null,
        is_active: formData.is_active
      };

      if (editingId) {
        const { error } = await supabase
          .from('client_rooms')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Sala atualizada!');
      } else {
        const { error } = await supabase
          .from('client_rooms')
          .insert({ ...payload, client_id: clientId });

        if (error) throw error;
        toast.success('Sala adicionada!');
      }

      handleCancel();
      loadData();
    } catch (error: any) {
      console.error('Erro ao salvar sala:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma sala com este nome nesta unidade');
      } else {
        toast.error('Erro ao salvar sala');
      }
    }
  };

  const handleEdit = (room: Room) => {
    setEditingId(room.id);
    setFormData({
      unit_id: room.unit_id,
      name: room.name,
      floor: room.floor || '',
      capacity: room.capacity?.toString() || '',
      notes: room.notes || '',
      is_active: room.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('client_rooms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Sala excluída!');
      loadData();
    } catch (error) {
      console.error('Erro ao excluir sala:', error);
      toast.error('Erro ao excluir sala');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      unit_id: '',
      name: '',
      floor: '',
      capacity: '',
      notes: '',
      is_active: true
    });
  };

  const getUnitName = (unitId: string) => {
    return units.find(u => u.id === unitId)?.name || 'Unidade não encontrada';
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Salas / Espaços</h3>
          <Badge variant="secondary">{rooms.length}</Badge>
        </div>
        <Button 
          size="sm" 
          onClick={() => setShowForm(true)}
          disabled={units.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {units.length === 0 && (
        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            Cadastre uma unidade primeiro para poder adicionar salas.
          </CardContent>
        </Card>
      )}

      {rooms.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sala</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Andar</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getUnitName(room.unit_id)}
                  </TableCell>
                  <TableCell>{room.floor || '-'}</TableCell>
                  <TableCell>
                    {room.capacity ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-3 w-3" />
                        {room.capacity}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={room.is_active ? 'default' : 'secondary'}>
                      {room.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(room)}
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
                              Excluir a sala "{room.name}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(room.id)}>
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
      ) : units.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <DoorOpen className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma sala cadastrada
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Sala' : 'Nova Sala'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="room-unit">Unidade *</Label>
              <Select
                value={formData.unit_id}
                onValueChange={(value) => setFormData({ ...formData, unit_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="room-name">Nome *</Label>
              <Input
                id="room-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Sala de Reuniões 1, Auditório..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="room-floor">Andar</Label>
                <Input
                  id="room-floor"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  placeholder="Ex: Térreo, 1º andar..."
                />
              </div>
              <div>
                <Label htmlFor="room-capacity">Capacidade</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="Nº de pessoas"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="room-notes">Observações</Label>
              <Textarea
                id="room-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Informações adicionais..."
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="room-active">Ativo</Label>
              <Switch
                id="room-active"
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
