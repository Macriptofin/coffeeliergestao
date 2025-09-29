import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Plus, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PurchaseRequirement {
  id: string;
  material_id: string;
  required_quantity: number;
  required_unit: string;
  source_type: string;
  source_id: string;
  priority: string;
  status: string;
  required_date: string;
  notes: string;
  created_at: string;
  material: {
    name: string;
    code: string;
  };
}

export function PurchaseRequirements() {
  const [requirements, setRequirements] = useState<PurchaseRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<PurchaseRequirement | null>(null);
  const [department, setDepartment] = useState('');
  const [justification, setJustification] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_requirements')
        .select(`
          *,
          material:materials(name, code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequirements(data || []);
    } catch (error) {
      console.error('Error loading requirements:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar necessidades de compra.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseRequest = async () => {
    if (!selectedRequirement || !department || !justification) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Criar requisição diretamente via INSERT (request_number será gerado pelo trigger)
      const { data: requestData, error: requestError } = await supabase
        .from('purchase_requests')
        .insert([{
          requirement_id: selectedRequirement.id,
          department: department,
          justification: justification,
          priority: selectedRequirement.priority,
          requested_by: (await supabase.auth.getUser()).data.user?.id,
          request_number: '' // Será sobrescrito pelo trigger
        }])
        .select()
        .single();

      if (requestError) throw requestError;

      // Criar item da requisição
      const { error: itemError } = await supabase
        .from('purchase_request_items')
        .insert([{
          request_id: requestData.id,
          material_id: selectedRequirement.material_id,
          quantity: selectedRequirement.required_quantity,
          unit: selectedRequirement.required_unit,
          estimated_unit_price: 0 // Será preenchido posteriormente
        }]);

      if (itemError) throw itemError;

      // Atualizar status da necessidade
      const { error: updateError } = await supabase
        .from('purchase_requirements')
        .update({ status: 'requested' })
        .eq('id', selectedRequirement.id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Requisição de compra criada com sucesso!",
      });

      setShowCreateRequest(false);
      setSelectedRequirement(null);
      setDepartment('');
      setJustification('');
      loadRequirements();
    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar requisição de compra.",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'requested': return 'default';
      case 'approved': return 'default';
      case 'ordered': return 'default';
      case 'received': return 'default';
      case 'cancelled': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendente',
      requested: 'Solicitada',
      approved: 'Aprovada',
      ordered: 'Pedido Feito',
      received: 'Recebida',
      cancelled: 'Cancelada'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      high: 'Alta',
      medium: 'Média',
      low: 'Baixa'
    };
    return labels[priority as keyof typeof labels] || priority;
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Necessidades de Compra (MRP)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Métricas rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-destructive">
                    {requirements.filter(r => r.status === 'pending').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Pendentes</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {requirements.filter(r => r.priority === 'high').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Alta Prioridade</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {requirements.filter(r => r.source_type === 'production_order').length}
                  </div>
                  <div className="text-sm text-muted-foreground">De Produção</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {requirements.filter(r => r.status === 'received').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Atendidas</div>
                </CardContent>
              </Card>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Necessária</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((requirement) => (
                  <TableRow key={requirement.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{requirement.material.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {requirement.material.code}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {requirement.required_quantity} {requirement.required_unit}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityColor(requirement.priority)}>
                        {getPriorityLabel(requirement.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(requirement.status)}>
                        {getStatusLabel(requirement.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(requirement.required_date), 'dd/MM/yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {requirement.source_type === 'production_order' ? 'Produção' : 
                         requirement.source_type === 'stock_minimum' ? 'Estoque Mín.' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {requirement.status === 'pending' && (
                        <Dialog open={showCreateRequest} onOpenChange={setShowCreateRequest}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              onClick={() => setSelectedRequirement(requirement)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Criar Requisição
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Criar Requisição de Compra</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Material</Label>
                                <Input 
                                  value={selectedRequirement?.material.name || ''} 
                                  disabled 
                                />
                              </div>
                              <div>
                                <Label>Quantidade</Label>
                                <Input 
                                  value={`${selectedRequirement?.required_quantity || ''} ${selectedRequirement?.required_unit || ''}`} 
                                  disabled 
                                />
                              </div>
                              <div>
                                <Label htmlFor="department">Departamento *</Label>
                                <Select value={department} onValueChange={setDepartment}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o departamento" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="producao">Produção</SelectItem>
                                    <SelectItem value="eventos">Eventos</SelectItem>
                                    <SelectItem value="administrativo">Administrativo</SelectItem>
                                    <SelectItem value="manutencao">Manutenção</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="justification">Justificativa *</Label>
                                <Textarea
                                  id="justification"
                                  value={justification}
                                  onChange={(e) => setJustification(e.target.value)}
                                  placeholder="Justifique a necessidade de compra..."
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setShowCreateRequest(false)}
                                >
                                  Cancelar
                                </Button>
                                <Button onClick={createPurchaseRequest}>
                                  Criar Requisição
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {requirements.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma necessidade de compra encontrada.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}