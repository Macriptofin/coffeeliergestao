import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, X, Trophy, Save, ShoppingCart, AlertTriangle } from 'lucide-react';

interface QuoteRequestDetailProps {
  quoteRequestId: string;
  onBack: () => void;
}

interface HeaderData {
  id: string;
  quote_number: string;
  deadline_date: string;
  delivery_location: string | null;
  payment_terms: string | null;
  special_conditions: string | null;
  status: string;
  request_id: string | null;
}

interface RequestItem {
  id: string;
  material_id: string;
  material_name: string;
  quantity: number;
  unit: string;
}

interface SupplierColumn {
  supplier_id: string;
  company_name: string;
  supplier_quote_id: string | null;
  valid_until: string;
  payment_terms: string;
  delivery_time_days: string;
  status: string;
}

// Fase 1 (manual): o comprador adiciona fornecedores à comparação e digita os
// preços que cada um cotou por fora do sistema. Cada coluna salva de forma
// independente (não existe "salvar tudo de uma vez") para que uma falha isolada
// não derrube o restante. Unidade é travada na do pedido (quote_request_items) —
// não se compara preço em unidades diferentes sem conversão nesta fase.
//
// Fase 2 (futura, não implementada): o próprio fornecedor logaria (análogo ao
// Portal do Cliente — client_users/current_portal_client_id()) e preencheria a
// coluna dele diretamente. quote_request_items já é, hoje, exatamente a lista que
// esse fornecedor veria; bastará RLS aditiva escopando supplier_quotes/
// supplier_quote_items por supplier_id, sem mudar o schema desta fase.
export const QuoteRequestDetail = ({ quoteRequestId, onBack }: QuoteRequestDetailProps) => {
  const [header, setHeader] = useState<HeaderData | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [columns, setColumns] = useState<SupplierColumn[]>([]);
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>({});
  const [availableSuppliers, setAvailableSuppliers] = useState<{ id: string; company_name: string }[]>([]);
  const [supplierToAdd, setSupplierToAdd] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSupplier, setSavingSupplier] = useState<string | null>(null);
  const [existingOrderNumber, setExistingOrderNumber] = useState<string | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: headerData, error: headerError }, { data: itemsData, error: itemsError }] = await Promise.all([
        supabase.from('quote_requests').select('*').eq('id', quoteRequestId).single(),
        supabase
          .from('quote_request_items')
          .select('id, material_id, quantity, unit, materials(name)')
          .eq('quote_request_id', quoteRequestId)
          .order('position'),
      ]);
      if (headerError) throw headerError;
      if (itemsError) throw itemsError;

      setHeader(headerData);
      const reqItems: RequestItem[] = (itemsData || []).map((i: any) => ({
        id: i.id,
        material_id: i.material_id,
        material_name: i.materials?.name || '—',
        quantity: Number(i.quantity),
        unit: i.unit,
      }));
      setItems(reqItems);

      const { data: qrSuppliers, error: qrSuppliersError } = await supabase
        .from('quote_request_suppliers')
        .select('supplier_id, suppliers(company_name)')
        .eq('quote_request_id', quoteRequestId);
      if (qrSuppliersError) throw qrSuppliersError;

      const supplierIds = (qrSuppliers || []).map((s: any) => s.supplier_id);

      let quotesData: any[] = [];
      let quoteItemsData: any[] = [];
      if (supplierIds.length > 0) {
        const { data: sq, error: sqError } = await supabase
          .from('supplier_quotes')
          .select('*')
          .eq('quote_request_id', quoteRequestId)
          .in('supplier_id', supplierIds);
        if (sqError) throw sqError;
        quotesData = sq || [];

        const quoteIds = quotesData.map(q => q.id);
        if (quoteIds.length > 0) {
          const { data: sqi, error: sqiError } = await supabase
            .from('supplier_quote_items')
            .select('*')
            .in('quote_id', quoteIds);
          if (sqiError) throw sqiError;
          quoteItemsData = sqi || [];
        }
      }

      const quotesBySupplier = Object.fromEntries(quotesData.map(q => [q.supplier_id, q]));

      const newColumns: SupplierColumn[] = (qrSuppliers || []).map((s: any) => {
        const q = quotesBySupplier[s.supplier_id];
        return {
          supplier_id: s.supplier_id,
          company_name: s.suppliers?.company_name || '—',
          supplier_quote_id: q?.id ?? null,
          valid_until: q?.valid_until ?? headerData.deadline_date,
          payment_terms: q?.payment_terms ?? '',
          delivery_time_days: q?.delivery_time_days != null ? String(q.delivery_time_days) : '',
          status: q?.status ?? 'Recebida',
        };
      });
      // Mescla com o estado local em vez de substituir: um fornecedor ainda não
      // salvo (sem supplier_quote_id) pode ter edições locais em andamento (ex.:
      // o usuário está preenchendo o preço de um fornecedor enquanto salva outro)
      // — recarregar tudo não pode descartar isso.
      setColumns(prevColumns => {
        const prevBySupplier = Object.fromEntries(prevColumns.map(c => [c.supplier_id, c]));
        return newColumns.map(nc => {
          const prevCol = prevBySupplier[nc.supplier_id];
          if (nc.supplier_quote_id || !prevCol) return nc;
          return { ...nc, valid_until: prevCol.valid_until, payment_terms: prevCol.payment_terms, delivery_time_days: prevCol.delivery_time_days };
        });
      });

      const newPrices: Record<string, Record<string, string>> = {};
      quoteItemsData.forEach((qi: any) => {
        const quote = quotesData.find(q => q.id === qi.quote_id);
        if (!quote || !qi.quote_request_item_id) return;
        if (!newPrices[qi.quote_request_item_id]) newPrices[qi.quote_request_item_id] = {};
        newPrices[qi.quote_request_item_id][quote.supplier_id] = String(qi.unit_price);
      });
      // Idem: mescla por item, preservando preços digitados p/ fornecedores que
      // ainda não foram salvos (não aparecem em newPrices ainda).
      setPrices(prevPrices => {
        const merged: Record<string, Record<string, string>> = { ...prevPrices };
        Object.entries(newPrices).forEach(([itemId, supplierMap]) => {
          merged[itemId] = { ...(merged[itemId] || {}), ...supplierMap };
        });
        return merged;
      });

      const { data: allSuppliers, error: allSuppliersError } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('status', 'Ativo')
        .order('company_name');
      if (allSuppliersError) throw allSuppliersError;
      setAvailableSuppliers((allSuppliers || []).filter(s => !supplierIds.includes(s.id)));

      const { data: existingOrder } = await supabase
        .from('purchase_orders')
        .select('order_number')
        .eq('quote_request_id', quoteRequestId)
        .maybeSingle();
      setExistingOrderNumber(existingOrder?.order_number ?? null);
    } catch (error) {
      console.error('Erro ao carregar cotação:', error);
      toast.error('Erro ao carregar cotação');
    } finally {
      setLoading(false);
    }
  }, [quoteRequestId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleAddSupplier = async () => {
    if (!supplierToAdd) return;
    try {
      const { error } = await supabase
        .from('quote_request_suppliers')
        .insert({ quote_request_id: quoteRequestId, supplier_id: supplierToAdd });
      if (error) throw error;
      setSupplierToAdd('');
      await loadAll();
    } catch (error) {
      console.error('Erro ao adicionar fornecedor:', error);
      toast.error('Erro ao adicionar fornecedor');
    }
  };

  const handleRemoveSupplier = async (supplierId: string) => {
    try {
      const { error } = await supabase
        .from('quote_request_suppliers')
        .delete()
        .eq('quote_request_id', quoteRequestId)
        .eq('supplier_id', supplierId);
      if (error) throw error;
      await loadAll();
    } catch (error) {
      console.error('Erro ao remover fornecedor:', error);
      toast.error('Erro ao remover fornecedor');
    }
  };

  const updateColumn = (supplierId: string, field: keyof SupplierColumn, value: string) => {
    setColumns(prev => prev.map(c => c.supplier_id === supplierId ? { ...c, [field]: value } : c));
  };

  const updatePrice = (itemId: string, supplierId: string, value: string) => {
    setPrices(prev => ({ ...prev, [itemId]: { ...prev[itemId], [supplierId]: value } }));
  };

  const handleSaveSupplier = async (col: SupplierColumn) => {
    if (!col.valid_until) {
      toast.error('Informe a validade da cotação desse fornecedor');
      return;
    }
    setSavingSupplier(col.supplier_id);
    try {
      const quotePayload = {
        quote_request_id: quoteRequestId,
        supplier_id: col.supplier_id,
        valid_until: col.valid_until,
        payment_terms: col.payment_terms || null,
        delivery_time_days: col.delivery_time_days ? parseInt(col.delivery_time_days, 10) : null,
        total_amount: items.reduce((sum, item) => {
          const p = parseFloat(prices[item.id]?.[col.supplier_id] || '0');
          return sum + (isNaN(p) ? 0 : p * item.quantity);
        }, 0),
      };

      let supplierQuoteId = col.supplier_quote_id;
      if (supplierQuoteId) {
        const { error } = await supabase.from('supplier_quotes').update(quotePayload).eq('id', supplierQuoteId);
        if (error) throw error;
        await supabase.from('supplier_quote_items').delete().eq('quote_id', supplierQuoteId);
      } else {
        const { data, error } = await supabase.from('supplier_quotes').insert(quotePayload).select().single();
        if (error) throw error;
        supplierQuoteId = data.id;
      }

      const rowsToInsert = items
        .map(item => {
          const priceStr = prices[item.id]?.[col.supplier_id];
          const unitPrice = parseFloat(priceStr || '');
          if (!priceStr || isNaN(unitPrice) || unitPrice <= 0) return null;
          return {
            quote_id: supplierQuoteId,
            quote_request_item_id: item.id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: unitPrice,
            total_price: unitPrice * item.quantity,
          };
        })
        .filter(Boolean);

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('supplier_quote_items').insert(rowsToInsert as any[]);
        if (error) throw error;
      }

      toast.success(`Preços de ${col.company_name} salvos`);
      await loadAll();
    } catch (error) {
      console.error('Erro ao salvar cotação do fornecedor:', error);
      toast.error(`Erro ao salvar preços de ${col.company_name}`);
    } finally {
      setSavingSupplier(null);
    }
  };

  const handleSelectWinner = async (col: SupplierColumn) => {
    if (!col.supplier_quote_id) {
      toast.error('Salve os preços desse fornecedor antes de selecioná-lo');
      return;
    }
    try {
      await supabase.from('supplier_quotes').update({ status: 'Selecionada' }).eq('id', col.supplier_quote_id);
      const otherIds = columns
        .filter(c => c.supplier_quote_id && c.supplier_quote_id !== col.supplier_quote_id)
        .map(c => c.supplier_quote_id as string);
      if (otherIds.length > 0) {
        await supabase.from('supplier_quotes').update({ status: 'Rejeitada' }).in('id', otherIds);
      }
      await supabase.from('quote_requests').update({ status: 'Concluída' }).eq('id', quoteRequestId);
      toast.success(`${col.company_name} selecionado como vencedor`);
      await loadAll();
    } catch (error) {
      console.error('Erro ao selecionar fornecedor:', error);
      toast.error('Erro ao selecionar fornecedor');
    }
  };

  const winnerColumn = columns.find(c => c.status === 'Selecionada') || null;

  const missingItemsCount = winnerColumn
    ? items.filter(item => {
        const p = parseFloat(prices[item.id]?.[winnerColumn.supplier_id] || '');
        return isNaN(p) || p <= 0;
      }).length
    : 0;

  const handleCreatePurchaseOrder = async () => {
    if (!winnerColumn?.supplier_quote_id) return;
    setCreatingOrder(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: sqItems, error: sqItemsError } = await supabase
        .from('supplier_quote_items')
        .select('*')
        .eq('quote_id', winnerColumn.supplier_quote_id);
      if (sqItemsError) throw sqItemsError;
      if (!sqItems || sqItems.length === 0) {
        toast.error('Esse fornecedor não tem preços salvos — nada pra colocar no pedido.');
        return;
      }

      const totalAmount = sqItems.reduce((sum, i: any) => sum + Number(i.total_price), 0);

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          order_number: '',
          supplier_id: winnerColumn.supplier_id,
          quote_request_id: quoteRequestId,
          supplier_quote_id: winnerColumn.supplier_quote_id,
          expected_delivery_date: winnerColumn.valid_until || null,
          payment_terms: winnerColumn.payment_terms || null,
          total_amount: totalAmount,
          status: 'Pendente',
          created_by: user?.id,
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const orderItems = sqItems.map((i: any, idx: number) => ({
        purchase_order_id: order.id,
        material_id: i.material_id,
        quantity: i.quantity,
        unit: i.unit,
        unit_price: i.unit_price,
        total_price: i.total_price,
        position: idx + 1,
      }));
      const { error: itemsInsertError } = await supabase.from('purchase_order_items').insert(orderItems);
      if (itemsInsertError) throw itemsInsertError;

      // Fecha a rastreabilidade até a requisição de origem, se houver.
      if (header?.request_id) {
        await supabase.from('purchase_requests').update({ purchase_order_id: order.id }).eq('id', header.request_id);
        const { data: req } = await supabase
          .from('purchase_requests')
          .select('requirement_id')
          .eq('id', header.request_id)
          .single();
        if (req?.requirement_id) {
          await supabase.from('purchase_requirements').update({ status: 'ordered' }).eq('id', req.requirement_id);
        }
      }

      toast.success(`Pedido de Compra ${order.order_number} criado com sucesso!`);
      setExistingOrderNumber(order.order_number);
    } catch (error) {
      console.error('Erro ao criar pedido de compra:', error);
      toast.error('Erro ao criar pedido de compra');
    } finally {
      setCreatingOrder(false);
    }
  };

  const cheapestSupplierFor = (itemId: string): string | null => {
    const row = prices[itemId];
    if (!row) return null;
    let best: { supplierId: string; value: number } | null = null;
    Object.entries(row).forEach(([supplierId, value]) => {
      const v = parseFloat(value);
      if (!isNaN(v) && v > 0 && (!best || v < best.value)) best = { supplierId, value: v };
    });
    return best?.supplierId ?? null;
  };

  if (loading) return <p className="text-sm text-muted-foreground p-6">Carregando...</p>;
  if (!header) return <p className="text-sm text-muted-foreground p-6">Cotação não encontrada.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <Badge variant="outline" className="font-mono">{header.quote_number}</Badge>
        <Badge variant={header.status === 'Concluída' ? 'default' : 'secondary'}>{header.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Pedido</CardTitle>
          <CardDescription>
            Prazo limite: {new Date(header.deadline_date + 'T00:00:00').toLocaleDateString('pt-BR')}
            {header.delivery_location && ` · Entrega em: ${header.delivery_location}`}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fornecedores em Comparação</CardTitle>
          <CardDescription>Adicione os fornecedores que você está cotando e digite o preço que cada um passou.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs text-muted-foreground mb-1 block">Adicionar fornecedor</Label>
              <Select value={supplierToAdd} onValueChange={setSupplierToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSuppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" size="sm" onClick={handleAddSupplier} disabled={!supplierToAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
              Nenhum fornecedor adicionado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b min-w-[200px]">Material</th>
                    {columns.map(col => (
                      <th key={col.supplier_id} className="p-2 border-b border-l min-w-[180px]">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold">{col.company_name}</span>
                          <button type="button" onClick={() => handleRemoveSupplier(col.supplier_id)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {col.status === 'Selecionada' && (
                          <Badge className="mt-1 bg-green-600"><Trophy className="h-3 w-3 mr-1" />Vencedor</Badge>
                        )}
                        {col.status === 'Rejeitada' && (
                          <Badge variant="outline" className="mt-1 text-muted-foreground">Rejeitada</Badge>
                        )}
                        <div className="space-y-1 mt-2 font-normal">
                          <Input
                            type="date"
                            value={col.valid_until}
                            onChange={(e) => updateColumn(col.supplier_id, 'valid_until', e.target.value)}
                            className="h-7 text-xs"
                            title="Validade da cotação"
                          />
                          <Input
                            placeholder="Prazo entrega (dias)"
                            value={col.delivery_time_days}
                            onChange={(e) => updateColumn(col.supplier_id, 'delivery_time_days', e.target.value.replace(/\D/g, ''))}
                            className="h-7 text-xs"
                          />
                          <Input
                            placeholder="Cond. pagamento"
                            value={col.payment_terms}
                            onChange={(e) => updateColumn(col.supplier_id, 'payment_terms', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const cheapest = cheapestSupplierFor(item.id);
                    return (
                      <tr key={item.id}>
                        <td className="p-2 border-b">
                          <div className="font-medium">{item.material_name}</div>
                          <div className="text-xs text-muted-foreground">{item.quantity} {item.unit}</div>
                        </td>
                        {columns.map(col => (
                          <td key={col.supplier_id} className={`p-2 border-b border-l ${cheapest === col.supplier_id ? 'bg-green-50' : ''}`}>
                            <NumericInput
                              step="0.01"
                              min="0"
                              value={prices[item.id]?.[col.supplier_id] || ''}
                              onChange={(e) => updatePrice(item.id, col.supplier_id, e.target.value)}
                              className={`h-8 text-sm ${cheapest === col.supplier_id ? 'font-semibold text-green-700' : ''}`}
                              placeholder={`R$ / ${item.unit}`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="p-2" />
                    {columns.map(col => (
                      <td key={col.supplier_id} className="p-2 border-l">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            onClick={() => handleSaveSupplier(col)}
                            disabled={savingSupplier === col.supplier_id}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {savingSupplier === col.supplier_id ? 'Salvando...' : 'Salvar'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleSelectWinner(col)}
                            disabled={!col.supplier_quote_id || col.status === 'Selecionada'}
                          >
                            <Trophy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {winnerColumn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedido de Compra
            </CardTitle>
            <CardDescription>
              {existingOrderNumber
                ? `Pedido ${existingOrderNumber} já criado com ${winnerColumn.company_name}.`
                : `Fornecedor vencedor: ${winnerColumn.company_name}.`}
            </CardDescription>
          </CardHeader>
          {!existingOrderNumber && (
            <CardContent className="space-y-3">
              {missingItemsCount > 0 && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {missingItemsCount} {missingItemsCount === 1 ? 'item' : 'itens'} da lista não tem preço salvo com esse fornecedor
                    e vai ficar de fora do pedido. Confira antes de criar, ou crie assim mesmo se for intencional.
                  </span>
                </div>
              )}
              <Button onClick={handleCreatePurchaseOrder} disabled={creatingOrder}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                {creatingOrder ? 'Criando...' : 'Criar Pedido de Compra'}
              </Button>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};
