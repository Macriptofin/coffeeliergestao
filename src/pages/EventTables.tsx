import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Users, Clock, FileText, Play, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConsumptionProfileForm } from "@/components/events/ConsumptionProfileForm";
import { EventTableForm } from "@/components/events/EventTableForm";

interface EventTablesData {
  profiles: any[];
  templates: any[];
  events: any[];
}

const EMPTY_DATA: EventTablesData = { profiles: [], templates: [], events: [] };

async function fetchEventTablesData(): Promise<EventTablesData> {
  // Carregar perfis de consumo
  const { data: profilesData, error: profilesError } = await supabase
    .from('consumption_profiles')
    .select(`
      *,
      consumption_profile_mix (
        category_label,
        percent
      )
    `)
    .order('created_at', { ascending: false });
  if (profilesError) throw profilesError;

  // Carregar templates
  const { data: templatesData, error: templatesError } = await supabase
    .from('event_table_templates')
    .select(`
      *,
      consumption_profiles (name),
      event_table_template_items (
        id,
        materials (name)
      )
    `)
    .order('created_at', { ascending: false });
  if (templatesError) throw templatesError;

  // Carregar eventos
  const { data: eventsData, error: eventsError } = await supabase
    .from('event_tables')
    .select(`
      *,
      consumption_profiles (name, grams_per_person),
      event_table_templates (name),
      clients (name),
      event_table_items (
        id,
        materials (name)
      )
    `)
    .order('created_at', { ascending: false });
  if (eventsError) throw eventsError;

  return {
    profiles: profilesData || [],
    templates: templatesData || [],
    events: eventsData || [],
  };
}

const EventTables = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("events");

  // ── data ──────────────────────────────────────────────────────────────────
  const {
    data = EMPTY_DATA,
    isError,
  } = useQuery({ queryKey: ['event-tables'], queryFn: fetchEventTablesData });
  const { profiles, templates, events } = data;

  const refetchEventTables = () => queryClient.invalidateQueries({ queryKey: ['event-tables'] });

  // Estados para formulários
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Erro de carregamento → toast (uma vez por mudança no estado de erro)
  useEffect(() => {
    if (isError) {
      toast({
        title: "Erro",
        description: "Erro ao carregar dados. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [isError, toast]);

  const generateProduction = async (eventId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_event_production', {
        p_event_table_id: eventId
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Ordem de produção gerada com sucesso!",
      });

      refetchEventTables();
    } catch (error) {
      console.error('Erro ao gerar produção:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar ordem de produção.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'proposed': return 'bg-blue-500';
      case 'approved': return 'bg-green-500';
      case 'producing': return 'bg-orange-500';
      case 'done': return 'bg-emerald-500';
      case 'canceled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Rascunho';
      case 'proposed': return 'Proposta';
      case 'approved': return 'Aprovado';
      case 'producing': return 'Produzindo';
      case 'done': return 'Concluído';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Mesas/Eventos</h1>
        <p className="text-muted-foreground">
          Gestão dinâmica de eventos com cálculo automático por pessoa
        </p>
      </div>

      {showProfileForm && (
        <div className="mb-6">
          <ConsumptionProfileForm
            profile={editingProfile}
            onSave={() => {
              setShowProfileForm(false);
              setEditingProfile(null);
              refetchEventTables();
            }}
            onCancel={() => {
              setShowProfileForm(false);
              setEditingProfile(null);
            }}
          />
        </div>
      )}

      {showEventForm && (
        <div className="mb-6">
          <EventTableForm
            eventTable={editingEvent}
            onSave={() => {
              setShowEventForm(false);
              setEditingEvent(null);
              refetchEventTables();
            }}
            onCancel={() => {
              setShowEventForm(false);
              setEditingEvent(null);
            }}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Perfis de Consumo
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Modelos de Mesa
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Eventos/Mesas
          </TabsTrigger>
        </TabsList>

        {/* Perfis de Consumo */}
        <TabsContent value="profiles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Perfis de Consumo</h2>
            <Button
              onClick={() => {
                setEditingProfile(null);
                setShowProfileForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Perfil
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <Card key={profile.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {profile.grams_per_person}g por pessoa
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Mix de Categorias:</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.consumption_profile_mix?.map((mix: any, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {mix.category_label}: {mix.percent}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingProfile({
                          ...profile,
                          mix: profile.consumption_profile_mix
                        });
                        setShowProfileForm(true);
                      }}
                    >
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Modelos de Mesa */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Modelos de Mesa</h2>
            <Button disabled>
              <Plus className="h-4 w-4 mr-2" />
              Novo Modelo
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.consumption_profiles && (
                    <p className="text-sm text-muted-foreground">
                      Perfil: {template.consumption_profiles.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {template.event_table_template_items?.length || 0} itens
                    </p>
                    {template.notes && (
                      <p className="text-sm text-muted-foreground">{template.notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Eventos/Mesas */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Eventos/Mesas</h2>
            <Button
              onClick={() => {
                setEditingEvent(null);
                setShowEventForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Evento
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Card key={event.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{event.event_code}</CardTitle>
                    <Badge className={getStatusColor(event.status)}>
                      {getStatusLabel(event.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{event.client_name}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
                      {new Date(event.date_start).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4" />
                      {event.attendees} participantes
                    </div>
                    {event.consumption_profiles && (
                      <div className="text-sm text-muted-foreground">
                        {event.consumption_profiles.grams_per_person}g/pessoa
                      </div>
                    )}
                    <p className="text-sm font-medium">
                      {event.event_table_items?.length || 0} itens
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingEvent(event);
                        setShowEventForm(true);
                      }}
                    >
                      Editar
                    </Button>
                    {event.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => generateProduction(event.id)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Gerar Ordem
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EventTables;