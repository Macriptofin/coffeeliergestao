import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Receipt, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate, todayLocalISO } from '@/lib/date-utils';
import { usePrintWithTitle } from '@/hooks/usePrintWithTitle';
import { BILLING_STATUS_META, suggestDueKQ15 } from '@/components/sales/billing-utils';

// Faturamento CONSOLIDADO por cliente (caso real CMPC): um pedido de compras
// único cobrindo N fornecimentos de propostas diferentes (avulsas e/ou
// execuções de contrato). O lote tem proposal_id NULO — a rastreabilidade por
// proposta fica nos itens. Mesmo funil do lote de contrato
// (solicitar → aprovar → NF → lançar; reprovada → retrabalhar).

interface Supply {
  composition_id: string;
  proposal_id: string;
  proposal_number: string;
  proposal_event_name: string | null;
  origin: 'contrato' | 'avulsa';
  name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  number_of_people: number | null;
  price_per_person: number | null;
  value: number | null;
  event_status: string | null;
}

interface BatchItem {
  composition_id: string;
  quantity: number;
  unit_price: number;
  value: number;
  composition?: {
    name: string | null;
    scheduled_date: string | null;
    proposals?: { proposal_number: string } | null;
  } | null;
}

interface ClientBatch {
  id: string;
  status: string;
  client_id: string;
  purchase_order_number: string | null;
  client_process_number: string | null;
  total_quantity: number;
  total_value: number;
  invoice_number: string | null;
  invoice_issued_at: string | null;
  posted_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_at: string;
  clients?: { name: string } | null;
  items: BatchItem[];
  accounts_receivable: { status: string; due_date: string; received_amount: number | null } | null;
}

async function fetchClientBatches(): Promise<ClientBatch[]> {
  const { data, error } = await supabase
    .from('proposal_billing_batches' as any)
    .select(`*, clients (name),
      items:proposal_billing_items(composition_id, quantity, unit_price, value,
        composition:proposal_compositions(name, scheduled_date, proposals(proposal_number))),
      accounts_receivable (status, due_date, received_amount)`)
    .is('proposal_id', null)
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as any) || []) as ClientBatch[];
}

export function ClientBillingManager({ onChanged }: { onChanged?: () => void }) {
  const queryClient = useQueryClient();
  const queryKey = ['client-billing-batches'];
  const { data: batches = [], isPending } = useQuery({ queryKey, queryFn: fetchClientBatches });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-billing'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name');
      if (error) throw error;
      return (data || []) as { id: string; name: string }[];
    },
  });

  // Novo faturamento
  const [newOpen, setNewOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const { data: supplies = [], isPending: suppliesLoading } = useQuery({
    queryKey: ['client-billable-supplies', clientId],
    enabled: newOpen && !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_client_billable_supplies', {
        p_client_id: clientId,
      });
      if (error) throw error;
      return ((data as any) || []) as Supply[];
    },
  });

  // Transições do funil (mesmo padrão do lote de contrato)
  const [transition, setTransition] = useState<{ batch: ClientBatch; action: string } | null>(null);
  const [tForm, setTForm] = useState({ processNumber: '', invoiceNumber: '', issuedAt: '', postedAt: '', dueDate: '', reason: '' });
  const [mirrorBatch, setMirrorBatch] = useState<ClientBatch | null>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['client-billable-supplies'] });
    queryClient.invalidateQueries({ queryKey: ['proposal-billing-external'] });
    onChanged?.();
  };

  const handlePrintMirror = usePrintWithTitle({
    contentRef: mirrorRef,
    documentTitle: `Espelho_Faturamento_Consolidado`,
    pageStyle: '@page { size: A4 portrait; margin: 14mm; }',
  });

  const openNew = () => {
    setClientId('');
    setSelected(new Set());
    setPoNumber('');
    setNotes('');
    setNewOpen(true);
  };

  const selectedSupplies = supplies.filter(s => selected.has(s.composition_id));
  const selectedTotal = selectedSupplies.reduce((s, e) => s + (e.value || 0), 0);
  const selectedQty = selectedSupplies.reduce((s, e) => s + (e.number_of_people || 0), 0);
  const selectedProposals = new Set(selectedSupplies.map(s => s.proposal_id)).size;

  // Grupos: um por contrato (proposta guarda-chuva) + um de avulsas
  const groups: { key: string; label: string; supplies: Supply[] }[] = [];
  const avulsas = supplies.filter(s => s.origin === 'avulsa');
  if (avulsas.length) groups.push({ key: 'avulsas', label: 'Avulsas', supplies: avulsas });
  const contractIds = Array.from(new Set(supplies.filter(s => s.origin === 'contrato').map(s => s.proposal_id)));
  contractIds.forEach(pid => {
    const list = supplies.filter(s => s.origin === 'contrato' && s.proposal_id === pid);
    const first = list[0];
    groups.push({
      key: pid,
      label: `Contrato ${first.proposal_event_name || ''} — Prop. ${first.proposal_number}`.trim(),
      supplies: list,
    });
  });

  const createBatch = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('create_client_billing', {
        p_client_id: clientId,
        p_composition_ids: Array.from(selected),
        p_purchase_order_number: poNumber || null,
        p_notes: notes || null,
      });
      if (error) throw error;
      toast.success(`Pré-fatura consolidada criada: ${formatCurrency((data as any)?.total_value ?? 0)}. Imprima o espelho e solicite a aprovação no sistema do cliente.`);
      setNewOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível criar o faturamento.');
    } finally { setBusy(false); }
  };

  const openTransition = (batch: ClientBatch, action: string) => {
    const today = todayLocalISO();
    setTForm({
      processNumber: action === 'retrabalhar' ? (batch.purchase_order_number || '') : (batch.client_process_number || ''),
      invoiceNumber: batch.invoice_number || '',
      issuedAt: today,
      postedAt: today,
      dueDate: action === 'lancar' ? suggestDueKQ15(today) : '',
      reason: '',
    });
    setTransition({ batch, action });
  };

  const runTransition = async () => {
    if (!transition) return;
    setBusy(true);
    try {
      const payload: Record<string, string> = {};
      if (transition.action === 'solicitar' && tForm.processNumber) payload.client_process_number = tForm.processNumber;
      if (transition.action === 'faturar') {
        payload.invoice_number = tForm.invoiceNumber;
        if (tForm.issuedAt) payload.issued_at = tForm.issuedAt;
        if (tForm.dueDate) payload.due_date = tForm.dueDate;
      }
      if (transition.action === 'lancar') {
        if (tForm.postedAt) payload.posted_at = tForm.postedAt;
        if (tForm.dueDate) payload.due_date = tForm.dueDate;
      }
      if (transition.action === 'reprovar' && tForm.reason) payload.reason = tForm.reason;
      if (transition.action === 'retrabalhar' && tForm.processNumber) payload.purchase_order_number = tForm.processNumber;

      const { error } = await (supabase.rpc as any)('update_billing_status', {
        p_batch_id: transition.batch.id,
        p_action: transition.action,
        p_payload: payload,
      });
      if (error) throw error;
      toast.success('Faturamento atualizado.');
      setTransition(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível atualizar.');
    } finally { setBusy(false); }
  };

  const itemLabel = (it: BatchItem) =>
    `${it.composition?.name || 'Fornecimento'} — Prop. ${it.composition?.proposals?.proposal_number || '—'}`;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Faturamentos consolidados
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pedido único do cliente cobrindo fornecimentos de propostas diferentes (avulsas e execuções de contrato)
            </p>
          </div>
          <Button size="sm" className="rounded-lg gap-1.5 font-semibold" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo faturamento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending && <p className="text-sm text-muted-foreground text-center py-2">Carregando…</p>}
        {!isPending && batches.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhum faturamento consolidado. Os lotes de contrato seguem no painel de cada contrato (Vendas → Contratos).
          </p>
        )}
        {batches.map(b => {
          const meta = BILLING_STATUS_META[b.status] || { label: b.status, cls: 'bg-muted text-muted-foreground' };
          const arStatus = b.accounts_receivable?.status;
          const nProposals = new Set((b.items || []).map(i => i.composition?.proposals?.proposal_number).filter(Boolean)).size;
          return (
            <div key={b.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 text-sm">
                  <span className="font-semibold">{b.clients?.name || '—'}</span>
                  <span className="text-muted-foreground">
                    {' '}· {(b.items || []).length} fornecimento{(b.items || []).length !== 1 ? 's' : ''}
                    {nProposals > 1 && <> de {nProposals} propostas</>}
                    {' '}· {b.total_quantity} un · <span className="font-medium text-foreground">{formatCurrency(b.total_value)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`${meta.cls} border-transparent`}>{meta.label}</Badge>
                  {arStatus && b.status === 'lancada' && (
                    <Badge variant="outline" className={arStatus === 'Vencido' ? 'bg-red-100 text-red-700 border-transparent' : arStatus === 'Pago' ? 'bg-emerald-100 text-emerald-700 border-transparent' : 'bg-muted text-muted-foreground border-transparent'}>
                      {arStatus}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {b.purchase_order_number && <>Pedido {b.purchase_order_number} · </>}
                {b.client_process_number && <>Zeev {b.client_process_number} · </>}
                {b.invoice_number && <>NF {b.invoice_number}{b.invoice_issued_at ? ` (${formatLocalDate(b.invoice_issued_at)})` : ''} · </>}
                {b.posted_at && <>lançada {formatLocalDate(b.posted_at)} · </>}
                {b.accounts_receivable?.due_date && <>venc. {formatLocalDate(b.accounts_receivable.due_date)} · </>}
                criado {formatLocalDate(b.created_at)}
                {b.status === 'reprovada' && b.rejected_reason && <span className="text-destructive"> · motivo: {b.rejected_reason}</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {(b.items || []).map(itemLabel).join(' · ')}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setMirrorBatch(b); setTimeout(() => handlePrintMirror(), 100); }}>
                  <Printer className="h-3 w-3" /> Espelho
                </Button>
                {b.status === 'preparada' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransition(b, 'solicitar')}>
                    Solicitar aprovação
                  </Button>
                )}
                {b.status === 'reprovada' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransition(b, 'retrabalhar')}>
                    Retrabalhar
                  </Button>
                )}
                {b.status === 'aguardando_aprovacao' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransition(b, 'aprovar')}>
                    Marcar aprovada
                  </Button>
                )}
                {b.status === 'aprovada_faturamento' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransition(b, 'faturar')}>
                    Registrar NF emitida
                  </Button>
                )}
                {b.status === 'faturada' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransition(b, 'lancar')}>
                    Registrar lançamento
                  </Button>
                )}
                {['aguardando_aprovacao', 'aprovada_faturamento', 'faturada'].includes(b.status) && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => openTransition(b, 'reprovar')}>
                    Reprovada
                  </Button>
                )}
                {['preparada', 'aguardando_aprovacao', 'aprovada_faturamento', 'reprovada'].includes(b.status) && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => openTransition(b, 'cancelar')}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Espelho imprimível (oculto na tela) */}
        <div style={{ display: 'none' }}>
          <div ref={mirrorRef} style={{ fontFamily: 'Arial, sans-serif', color: '#000', fontSize: 12 }}>
            {mirrorBatch && (
              <div>
                <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, borderBottom: '2px solid #000', paddingBottom: 8 }}>
                  ESPELHO PARA EMISSÃO DE NFS-e
                </div>
                <div style={{ marginTop: 10, lineHeight: 1.6 }}>
                  <strong>Cliente:</strong> {mirrorBatch.clients?.name || '—'}<br />
                  <strong>Faturamento consolidado</strong> — fornecimentos de {new Set((mirrorBatch.items || []).map(i => i.composition?.proposals?.proposal_number).filter(Boolean)).size} proposta(s)<br />
                  {mirrorBatch.purchase_order_number && (<><strong>Pedido de compras:</strong> {mirrorBatch.purchase_order_number}<br /></>)}
                  {mirrorBatch.client_process_number && (<><strong>Solicitação (Zeev):</strong> {mirrorBatch.client_process_number}<br /></>)}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                      <th style={{ padding: '4px 0' }}>Fornecimento</th>
                      <th>Data</th>
                      <th style={{ textAlign: 'right' }}>Qtd</th>
                      <th style={{ textAlign: 'right' }}>Unit.</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(mirrorBatch.items || []).map(it => (
                      <tr key={it.composition_id} style={{ borderBottom: '1px dashed #999' }}>
                        <td style={{ padding: '4px 0' }}>{itemLabel(it)}</td>
                        <td>{it.composition?.scheduled_date ? formatLocalDate(it.composition.scheduled_date) : '—'}</td>
                        <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(it.unit_price)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(it.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #000', fontWeight: 800 }}>
                      <td colSpan={2} style={{ padding: '6px 0' }}>Total</td>
                      <td style={{ textAlign: 'right' }}>{mirrorBatch.total_quantity}</td>
                      <td />
                      <td style={{ textAlign: 'right' }}>{formatCurrency(mirrorBatch.total_value)}</td>
                    </tr>
                  </tfoot>
                </table>
                {mirrorBatch.notes && <p style={{ marginTop: 8 }}><strong>Obs.:</strong> {mirrorBatch.notes}</p>}
                <p style={{ marginTop: 14, fontStyle: 'italic', fontSize: 11 }}>
                  Documento de conferência para emissão de NFS-e — não possui valor fiscal.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dialog: novo faturamento consolidado */}
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo faturamento</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground -mt-1">
              Selecione o cliente e os fornecimentos que entram nesta nota. Cada um só pode estar em um faturamento vivo.
            </p>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {clientId && (
              <div className="space-y-3 max-h-[38vh] overflow-y-auto">
                {suppliesLoading && <p className="text-sm text-muted-foreground text-center py-3">Carregando fornecimentos…</p>}
                {!suppliesLoading && supplies.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Nenhum fornecimento faturável para este cliente.
                  </p>
                )}
                {groups.map(g => (
                  <div key={g.key} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex justify-between">
                      <span>{g.label}</span>
                      <span>{g.supplies.length} faturáve{g.supplies.length !== 1 ? 'is' : 'l'}</span>
                    </div>
                    {g.supplies.map(e => (
                      <label key={e.composition_id} className="flex items-center gap-3 text-sm border-t px-3 py-2 cursor-pointer">
                        <Checkbox
                          checked={selected.has(e.composition_id)}
                          onCheckedChange={(v) => {
                            setSelected(prev => {
                              const next = new Set(prev);
                              if (v) next.add(e.composition_id); else next.delete(e.composition_id);
                              return next;
                            });
                          }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium">{e.name || 'Fornecimento'}</span>
                          <span className="text-muted-foreground">
                            {e.origin === 'avulsa' ? ` · Prop. ${e.proposal_number}` : ''}
                            {e.scheduled_date ? ` · ${formatLocalDate(e.scheduled_date)}` : ''}
                            {` · ${e.number_of_people ?? 0} un`}
                          </span>
                          {e.event_status && (
                            <Badge variant="outline" className={`ml-1.5 text-[10px] py-0 ${e.event_status === 'Concluído' ? 'bg-emerald-100 text-emerald-700 border-transparent' : 'bg-muted text-muted-foreground border-transparent'}`}>
                              {e.event_status === 'Concluído' ? 'Entregue' : e.event_status}
                            </Badge>
                          )}
                        </span>
                        <span className="font-medium whitespace-nowrap">{formatCurrency(e.value || 0)}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Nº do pedido de compras (cliente)</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Ex: 4500222333" />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1">
              <span>
                {selected.size} selecionado{selected.size !== 1 ? 's' : ''} · {selectedQty} un
                {selectedProposals > 1 && <> · {selectedProposals} propostas</>}
              </span>
              <span>{formatCurrency(selectedTotal)}</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
              <Button onClick={createBatch} disabled={busy || !clientId || selected.size === 0}>Criar pré-fatura</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: transições do funil */}
        <Dialog open={!!transition} onOpenChange={(open) => { if (!open && !busy) setTransition(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {transition?.action === 'solicitar' && 'Solicitar aprovação no cliente'}
                {transition?.action === 'aprovar' && 'Marcar como aprovada'}
                {transition?.action === 'faturar' && 'Registrar NF emitida'}
                {transition?.action === 'lancar' && 'Registrar lançamento no cliente'}
                {transition?.action === 'reprovar' && 'Marcar como reprovada'}
                {transition?.action === 'retrabalhar' && 'Retrabalhar faturamento'}
                {transition?.action === 'cancelar' && 'Cancelar faturamento'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              {transition?.action === 'solicitar' && (
                <div className="space-y-1.5">
                  <Label>Nº único da solicitação (Zeev)</Label>
                  <Input value={tForm.processNumber} onChange={e => setTForm(f => ({ ...f, processNumber: e.target.value }))} placeholder="Ex: 721043" />
                  <p className="text-xs text-muted-foreground">Registre aqui o número que o Zeev gerar — é a chave de acompanhamento.</p>
                </div>
              )}
              {transition?.action === 'aprovar' && (
                <p className="text-muted-foreground">O cliente aprovou a solicitação — liberado emitir a NFS-e na prefeitura.</p>
              )}
              {transition?.action === 'faturar' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nº da nota fiscal *</Label>
                    <Input value={tForm.invoiceNumber} onChange={e => setTForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="Ex: 54" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Data de emissão</Label>
                      <Input type="date" value={tForm.issuedAt} onChange={e => setTForm(f => ({ ...f, issuedAt: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vencimento provisório</Label>
                      <Input type="date" value={tForm.dueDate} onChange={e => setTForm(f => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cria a conta a receber consolidada. O vencimento definitivo é confirmado no lançamento (KQ15).
                  </p>
                </>
              )}
              {transition?.action === 'lancar' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Data do lançamento</Label>
                      <Input type="date" value={tForm.postedAt}
                        onChange={e => setTForm(f => ({ ...f, postedAt: e.target.value, dueDate: e.target.value ? suggestDueKQ15(e.target.value) : f.dueDate }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vencimento (KQ15 sugerido)</Label>
                      <Input type="date" value={tForm.dueDate} onChange={e => setTForm(f => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sugestão pela regra KQ15: fecha a quinzena do lançamento + 15 dias. Ajuste se necessário.
                  </p>
                </>
              )}
              {transition?.action === 'reprovar' && (
                <div className="space-y-1.5">
                  <Label>Motivo (do Zeev/T09)</Label>
                  <Textarea rows={2} value={tForm.reason} onChange={e => setTForm(f => ({ ...f, reason: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">
                    A conta a receber desta NF é cancelada automaticamente (a NF será cancelada/reemitida).
                    Depois, use "Retrabalhar" no mesmo faturamento.
                  </p>
                </div>
              )}
              {transition?.action === 'retrabalhar' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nº do pedido de compras novo (cliente)</Label>
                    <Input value={tForm.processNumber} onChange={e => setTForm(f => ({ ...f, processNumber: e.target.value }))} placeholder="Ex: 4500123457" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mesmo lote, ciclo novo: volta pra pré-fatura pra solicitar de novo com o pedido corrigido
                    e emitir NF nova. O ciclo reprovado fica registrado nas observações.
                  </p>
                </>
              )}
              {transition?.action === 'cancelar' && (
                <p className="text-muted-foreground">
                  Cancela o faturamento e libera os fornecimentos pra entrarem em outro. Não afeta eventos nem ordens.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransition(null)} disabled={busy}>Voltar</Button>
              <Button onClick={runTransition}
                disabled={busy || (transition?.action === 'faturar' && !tForm.invoiceNumber.trim())}
                variant={['reprovar', 'cancelar'].includes(transition?.action || '') ? 'destructive' : 'default'}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
