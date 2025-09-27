import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EventTable {
  id?: string;
  event_code: string;
  client_name: string;
  client_id?: string;
  date_start: string;
  date_end?: string;
  attendees: number;
  profile_id?: string;
  template_id?: string;
  status: string;
  notes?: string;
  items?: Array<{
    material_id: string;
    category_label: string;
    quantity_per_person?: number;
    fixed_quantity?: number;
    unit_override?: string;
  }>;
}

interface EventTableFormProps {
  eventTable?: EventTable;
  onSave: () => void;
  onCancel: () => void;
}

export function EventTableForm({ eventTable, onSave, onCancel }: EventTableFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<EventTable>({
    event_code: eventTable?.event_code || "",
    client_name: eventTable?.client_name || "",
    client_id: eventTable?.client_id || "",
    date_start: eventTable?.date_start || "",
    date_end: eventTable?.date_end || "",
    attendees: eventTable?.attendees || 10,
    profile_id: eventTable?.profile_id || "",
    template_id: eventTable?.template_id || "",
    status: eventTable?.status || "draft",
    notes: eventTable?.notes || "",
    items: eventTable?.items || [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar perfis de consumo
      const { data: profilesData } = await supabase
        .from('consumption_profiles')
        .select('*')
        .order('name');
      
      // Carregar templates
      const { data: templatesData } = await supabase
        .from('event_table_templates')
        .select('*')
        .order('name');
      
      // Carregar clientes
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'Ativo')
        .order('name');
      
      // Carregar materiais para os itens
      const { data: materialsData } = await supabase
        .from('materials')
        .select('*')
        .in('material_type', ['finished_product', 'resale_product'])
        .order('name');

      setProfiles(profilesData || []);
      setTemplates(templatesData || []);
      setClients(clientsData || []);
      setMaterials(materialsData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const applyTemplate = async (templateId: string) => {
    if (!templateId) return;

    try {
      const { data: templateItems } = await supabase
        .from('event_table_template_items')
        .select(`
          material_id,
          category_label,
          quantity_per_person,
          fixed_quantity,
          unit_override,
          materials (name)
        `)
        .eq('template_id', templateId);

      if (templateItems) {
        setFormData(prev => ({
          ...prev,
          items: templateItems.map(item => ({
            material_id: item.material_id,
            category_label: item.category_label,
            quantity_per_person: item.quantity_per_person,
            fixed_quantity: item.fixed_quantity,
            unit_override: item.unit_override,
          }))
        }));
      }
    } catch (error) {
      console.error('Erro ao aplicar template:', error);
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), {
        material_id: "",
        category_label: "Salgados",
        quantity_per_person: 1,
        fixed_quantity: undefined,
        unit_override: "",
      }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let eventTableId = eventTable?.id;

      if (eventTable?.id) {
        // Atualizar evento existente
        const { error } = await supabase
          .from('event_tables')
          .update({
            event_code: formData.event_code,
            client_name: formData.client_name,
            client_id: formData.client_id || null,
            date_start: formData.date_start,
            date_end: formData.date_end || null,
            attendees: formData.attendees,
            profile_id: formData.profile_id || null,
            template_id: formData.template_id || null,
            status: formData.status,
            notes: formData.notes,
          })
          .eq('id', eventTable.id);

        if (error) throw error;

        // Remover itens antigos
        await supabase
          .from('event_table_items')
          .delete()
          .eq('event_table_id', eventTable.id);
      } else {
        // Criar novo evento
        const { data, error } = await supabase
          .from('event_tables')
          .insert({
            event_code: formData.event_code,
            client_name: formData.client_name,
            client_id: formData.client_id || null,
            date_start: formData.date_start,
            date_end: formData.date_end || null,
            attendees: formData.attendees,
            profile_id: formData.profile_id || null,
            template_id: formData.template_id || null,
            status: formData.status,
            notes: formData.notes,
          })
          .select()
          .single();

        if (error) throw error;
        eventTableId = data.id;
      }

      // Inserir novos itens
      if (formData.items && formData.items.length > 0 && eventTableId) {
        const { error: itemsError } = await supabase
          .from('event_table_items')
          .insert(
            formData.items
              .filter(item => item.material_id)
              .map((item, index) => ({
                event_table_id: eventTableId,
                material_id: item.material_id,
                category_label: item.category_label,
                quantity_per_person: item.quantity_per_person,
                fixed_quantity: item.fixed_quantity,
                unit_override: item.unit_override,
                position: index + 1,
                source: formData.template_id ? 'from_template' : 'manual',
              }))
          );

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Sucesso",
        description: eventTable?.id ? "Evento atualizado com sucesso!" : "Evento criado com sucesso!",
      });

      onSave();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar evento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getMaterialName = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.name || '';
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {eventTable?.id ? "Editar Mesa/Evento" : "Nova Mesa/Evento"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados básicos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_code">Código do Evento</Label>
              <Input
                id="event_code"
                value={formData.event_code}
                onChange={(e) => setFormData(prev => ({ ...prev, event_code: e.target.value }))}
                placeholder="EVT-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Nome do Cliente</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Nome do cliente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendees">Participantes</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="attendees"
                  type="number"
                  min="1"
                  value={formData.attendees}
                  onChange={(e) => setFormData(prev => ({ ...prev, attendees: parseInt(e.target.value) || 0 }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date_start">Data/Hora de Início</Label>
              <Input
                id="date_start"
                type="datetime-local"
                value={formData.date_start}
                onChange={(e) => setFormData(prev => ({ ...prev, date_start: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_end">Data/Hora de Fim</Label>
              <Input
                id="date_end"
                type="datetime-local"
                value={formData.date_end}
                onChange={(e) => setFormData(prev => ({ ...prev, date_end: e.target.value }))}
              />
            </div>
          </div>

          {/* Perfil e Template */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile_id">Perfil de Consumo</Label>
              <Select
                value={formData.profile_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, profile_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} ({profile.grams_per_person}g/pessoa)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template_id">Template de Mesa</Label>
              <Select
                value={formData.template_id}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, template_id: value }));
                  if (value) applyTemplate(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="proposed">Proposta</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="producing">Produzindo</SelectItem>
                <SelectItem value="done">Concluído</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Itens da Mesa */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Itens da Mesa</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
            </div>

            <div className="space-y-2">
              {formData.items?.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                  <Select
                    value={item.material_id}
                    onValueChange={(value) => updateItem(index, 'material_id', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Categoria"
                    value={item.category_label}
                    onChange={(e) => updateItem(index, 'category_label', e.target.value)}
                    className="w-32"
                  />
                  
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Por pessoa"
                    value={item.quantity_per_person || ''}
                    onChange={(e) => updateItem(index, 'quantity_per_person', parseFloat(e.target.value) || undefined)}
                    className="w-28"
                  />
                  
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Fixo"
                    value={item.fixed_quantity || ''}
                    onChange={(e) => updateItem(index, 'fixed_quantity', parseFloat(e.target.value) || undefined)}
                    className="w-24"
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações sobre o evento..."
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}