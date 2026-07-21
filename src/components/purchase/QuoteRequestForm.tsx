import { useState, useEffect } from 'react';
import { MEASUREMENT_UNITS } from '@/lib/units';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NumericInput } from '@/components/ui/numeric-input';
import { Combobox } from '@/components/ui/combobox';
import { Trash2, Plus } from 'lucide-react';

interface MaterialOption {
  id: string;
  name: string;
  code: string;
  purchase_unit: string;
}

interface QuoteItemRow {
  material_id: string;
  quantity: number;
  unit: string;
  notes: string;
}

interface QuoteRequestFormProps {
  onSuccess: (quoteRequestId: string) => void;
  onCancel: () => void;
}

// Fase 1: o comprador cria a cotação e alimenta os preços manualmente (telefone/
// WhatsApp/e-mail, fora do sistema). Esta lista de itens é o "pedido mestre" —
// na Fase 2 (futura), é exatamente o que um fornecedor logado veria pra preencher
// a cotação dele. Ver plano em CLAUDE.md / memória do módulo de Cotações.
export const QuoteRequestForm = ({ onSuccess, onCancel }: QuoteRequestFormProps) => {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [specialConditions, setSpecialConditions] = useState('');
  const [items, setItems] = useState<QuoteItemRow[]>([]);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, code, purchase_unit')
      .eq('is_archived', false)
      .order('name');
    if (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
      return;
    }
    setMaterials(data || []);
  };

  const addItem = () => {
    setItems(prev => [...prev, { material_id: '', quantity: 0, unit: 'un', notes: '' }]);
  };

  const updateItem = (index: number, field: keyof QuoteItemRow, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'material_id') {
        const mat = materials.find(m => m.id === value);
        if (mat) updated.unit = mat.purchase_unit || 'un';
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deadlineDate) {
      toast.error('Informe o prazo limite para resposta');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um material para cotar');
      return;
    }
    if (items.some(i => !i.material_id || i.quantity <= 0)) {
      toast.error('Todos os itens precisam ter material e quantidade');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: quoteRequest, error: headerError } = await supabase
        .from('quote_requests')
        .insert({
          deadline_date: deadlineDate,
          delivery_location: deliveryLocation || null,
          payment_terms: paymentTerms || null,
          special_conditions: specialConditions || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (headerError) throw headerError;

      const { error: itemsError } = await supabase
        .from('quote_request_items')
        .insert(items.map((item, idx) => ({
          quote_request_id: quoteRequest.id,
          material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || null,
          position: idx + 1,
        })));
      if (itemsError) throw itemsError;

      toast.success(`Cotação ${quoteRequest.quote_number} criada com sucesso!`);
      onSuccess(quoteRequest.id);
    } catch (error) {
      console.error('Erro ao criar cotação:', error);
      toast.error('Erro ao criar cotação');
    } finally {
      setLoading(false);
    }
  };

  const materialOptions = materials.map(m => ({
    value: m.id,
    label: m.name,
    searchText: `${m.name} ${m.code}`,
  }));

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Nova Cotação</CardTitle>
        <CardDescription>
          Liste os materiais e defina o prazo — os fornecedores a comparar são escolhidos na próxima tela.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline_date">Prazo limite para resposta *</Label>
              <Input
                id="deadline_date"
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_location">Local de entrega (opcional)</Label>
              <Input
                id="delivery_location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="Ex: Cozinha central"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_terms">Condição de pagamento desejada (opcional)</Label>
            <Input
              id="payment_terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ex: 30 dias"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_conditions">Observações (opcional)</Label>
            <Textarea
              id="special_conditions"
              value={specialConditions}
              onChange={(e) => setSpecialConditions(e.target.value)}
              placeholder="Especificações, marcas aceitas, condições especiais..."
              rows={2}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label>Materiais a Cotar</Label>
              <Button type="button" onClick={addItem} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/20">
                  <div className="col-span-6">
                    {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Material</Label>}
                    <Combobox
                      options={materialOptions}
                      value={item.material_id}
                      placeholder="Selecionar..."
                      searchPlaceholder="Buscar material..."
                      emptyText="Nenhum material encontrado."
                      onSelect={(v) => updateItem(index, 'material_id', v)}
                      className="h-8 text-sm font-normal"
                    />
                  </div>
                  <div className="col-span-2">
                    {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Qtd</Label>}
                    <NumericInput
                      step="0.001"
                      min="0"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    {index === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unidade</Label>}
                    <Input
                      value={item.unit}
                      onChange={(e) => updateItem(index, 'unit', e.target.value)}
                      className="h-8 text-sm"
                      list="quote-units"
                    />
                  </div>
                  <div className="col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <datalist id="quote-units">
                {MEASUREMENT_UNITS.map(u => <option key={u} value={u} />)}
              </datalist>

              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <p className="text-sm">Nenhum material adicionado</p>
                  <p className="text-xs mt-1">Clique em "Adicionar" para incluir materiais a cotar</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Cotação'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
