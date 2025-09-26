import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, CheckCircle, Plus } from "lucide-react";

const ProductionPlanning = () => {
  const [viewMode, setViewMode] = useState<'list' | 'weekly' | 'monthly'>('list');

  // Mock data for demonstration
  const mockProductionOrders = [
    {
      id: '1',
      recipe: 'Bolo de Chocolate',
      quantity: 2,
      unit: 'unidades',
      status: 'Planejada',
      priority: 'Alta',
      plannedStart: '2024-01-15T08:00:00',
      plannedEnd: '2024-01-15T12:00:00',
      center: 'Forno 1'
    },
    {
      id: '2',
      recipe: 'Brigadeiros Gourmet',
      quantity: 50,
      unit: 'unidades',
      status: 'Em produção',
      priority: 'Média',
      plannedStart: '2024-01-15T10:00:00',
      plannedEnd: '2024-01-15T14:00:00',
      center: 'Bancada A'
    },
    {
      id: '3',
      recipe: 'Torta de Limão',
      quantity: 1,
      unit: 'unidade',
      status: 'Concluída',
      priority: 'Baixa',
      plannedStart: '2024-01-14T14:00:00',
      plannedEnd: '2024-01-14T18:00:00',
      center: 'Forno 2'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Planejada': return 'bg-blue-100 text-blue-800';
      case 'Em produção': return 'bg-yellow-100 text-yellow-800';
      case 'Concluída': return 'bg-green-100 text-green-800';
      case 'Cancelada': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-100 text-red-800';
      case 'Média': return 'bg-yellow-100 text-yellow-800';
      case 'Baixa': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Planejamento de Produção</h1>
          <p className="text-muted-foreground">Programação de produção e otimização de recursos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
            size="sm"
          >
            Lista
          </Button>
          <Button 
            variant={viewMode === 'weekly' ? 'default' : 'outline'}
            onClick={() => setViewMode('weekly')}
            size="sm"
          >
            Semanal
          </Button>
          <Button 
            variant={viewMode === 'monthly' ? 'default' : 'outline'}
            onClick={() => setViewMode('monthly')}
            size="sm"
          >
            Mensal
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Em Produção</p>
                <p className="text-2xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Orders List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Ordens de Produção</CardTitle>
              <CardDescription>Programação atual de produção</CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Ordem
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockProductionOrders.map((order) => {
              const startTime = formatDateTime(order.plannedStart);
              const endTime = formatDateTime(order.plannedEnd);
              
              return (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{order.recipe}</h3>
                    <div className="flex gap-2">
                      <Badge className={getPriorityColor(order.priority)}>
                        {order.priority}
                      </Badge>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Quantidade:</span>
                      <p>{order.quantity} {order.unit}</p>
                    </div>
                    
                    <div>
                      <span className="font-medium">Início:</span>
                      <p>{startTime.date} {startTime.time}</p>
                    </div>
                    
                    <div>
                      <span className="font-medium">Fim:</span>
                      <p>{endTime.date} {endTime.time}</p>
                    </div>
                    
                    <div>
                      <span className="font-medium">Centro:</span>
                      <p>{order.center}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Material Requirements */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Necessidades de Materiais</CardTitle>
          <CardDescription>Consolidação de materiais necessários para produção planejada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p>Funcionalidade em desenvolvimento</p>
            <p className="text-sm">Em breve você poderá visualizar as necessidades consolidadas de materiais</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionPlanning;