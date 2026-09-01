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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Receipt, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate, todayLocalISO } from '@/lib/date-utils';
import { usePrintWithTitle } from '@/hooks/usePrintWithTitle';
import { BILLING_STATUS_META, suggestDueKQ15 } from './billing-utils';

// Funil de faturamento do contrato (fluxo real SAP/Zeev do cliente):
// preparada → aguardando_aprovacao → aprovada_faturamento → faturada → lancada
// (+ reprovada/resolicitação; cancelada libera os fornecimentos).
// O sistema não emite NF — organiza o ciclo e lança a conta a receber.

interface ExecutionRef {
  composition_id: string;
  name: string;
  scheduled_date: string | null;
  number_of_people: number | null;
  price_per_person: number | null;
  event_status: string | null;
}

interface BillingItem {
  composition_id: string;
  quantity: number;
  unit_price: number;
  value: number;
}

interface BillingBatch {
  id: string;
  status: string;
  purchase_order_number: string | null;
  client_process_number: string | null;
  total_quantity: number;
  total_value: number;
  approval_requested_at: string | null;
  approved_at: string | null;
  invoice_number: string | null;
  invoice_issued_at: string | null;
  posted_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_at: string;
  items: BillingItem[];
  accounts_receivable: { status: string; due_date: string; received_amount: number | null } | null;
}

interface Props {
  proposalId: string;
  proposalNumber: string;
  eventName: string | null;
  clientName: string | null;
  clientPoNumber: string | null;
  executions: ExecutionRef[];
  onChanged?: () => void;
}

const STATUS_META = BILLING_STATUS_META;

async function fetchBillingBatches(proposalId: string): Promise<BillingBatch[]> {
  const { data, error } = await supabase
    .from('proposal_billing_batches')
    .select('*, items:proposal_billing_items(composition_id, quantity, unit_price, value), accounts_receivable(status, due_date, received_amount)')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as BillingBatch[];
}

export function ProposalBillingCard({ proposalId, proposalNumber, eventName, clientName, clientPoNumber, executions, onChanged }: Props) {
  const queryClient = useQueryClient();
  const queryKey = ['proposal-billing', proposalId];
  const { data: batches = [], isPending } = useQuery({ queryKey, queryFn: () => fetchBillingBatches(proposalId) });

  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // Dialogs de transição: {batch, action} + campos
  const [transition, setTransition] = useState<{ batch: BillingBatch; action: string } | null>(null);
  const [tForm, setTForm] = useState({ processNumber: '', invoiceNumber: '', issuedAt: '', postedAt: '', dueDate: '', reason: '' });
  const [mirrorBatch, setMirrorBatch] = useState<BillingBatch | null>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['proposal-billing-external', proposalId] });
    onChanged?.();
  };

  // Lotes vivos que tocam as execuções deste contrato — inclui os lotes
  // CONSOLIDADOS por cliente (proposal_id nulo, criados em Contas a Receber),
  // que a query por proposal_id acima não enxerga. Sem isso, uma execução já
  // faturada num consolidado apareceria como elegível aqui (a trava do banco
  // seguraria, mas com erro em vez de UI correta).
  const execIds = executions.map(e => e.composition_id);
  const { data: externalItems = [] } = useQuery({
    queryKey: ['proposal-billing-external', proposalId, execIds.slice().sort().join('|')],
    queryFn: async () => {
      if (!execIds.length) return [] as any[];
      const { data, error } = await supabase
        .from('proposal_billing_items' as any)
        .select('composition_id, batch:proposal_billing_batches(id, status, invoice_number, proposal_id)')
        .in('composition_id', execIds);
      if (error) throw error;
      return ((data as any) || []) as any[];
    },
  });
  const liveExternal = externalItems.filter((x: any) => x.batch && x.batch.status !== 'cancelada');
  const billedIds = new Set<string>(liveExternal.map((x: any) => x.composition_id));
  const eligible = executions.filter(e => e.event_status !== 'Cancelado' && !billedIds.has(e.composition_id));
  const billedInvoiceByComp = new Map<string, string>();
  liveExternal.forEach((x: any) => billedInvoiceByComp.set(x.composition_id, x.batch.invoice_number || ''));

  const selectedTotal = eligible
    .filter(e => selected.has(e.composition_id))
    .reduce((s, e) => s + (e.number_of_people || 0) * (e.price_per_person || 0), 0);
  const selectedQty = eligible
    .filter(e => selected.has(e.composition_id))
    .reduce((s, e) => s + (e.number_of_people || 0), 0);

  const handlePrintMirror = usePrintWithTitle({
    contentRef: mirrorRef,
    documentTitle: `Espelho_Faturamento_${proposalNumber}`,
    pageStyle: '@page { size: A4 portrait; margin: 14mm; }',
  });

  const openNew = () => {
    setSelected(new Set());
    setPoNumber(clientPoNumber || '');
    setNotes('');
    setNewOpen(true);
  };

  const createBatch = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('create_proposal_billing', {
        p_proposal_id: proposalId,
        p_composition_ids: Array.from(selected),
        p_purchase_order_number: poNumber || null,
        p_notes: notes || null,
      });
      if (error) throw error;
      toast.success(`Pré-fatura criada: ${formatCurrency((data as any)?.total_value ?? 0)}. Imprima o espelho e solicite a aprovação no sistema do cliente.`);
      setNewOpen(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível criar o faturamento.');
    } finally { setBusy(false); }
  };

  const openTransition = (batch: BillingBatch, action: string) => {
    const today = todayLocalISO();
    setTForm({
      // No retrabalho o campo de texto vira o Nº do pedido novo (pré-preenche o atual)
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

  const execName = (compId: string) => executions.find(e => e.composition_id === compId)?.name || 'Fornecimento';
  const execDate = (compId: string) => {
    const d = executions.find(e => e.composition_id === compId)?.scheduled_date;
    return d ? formatLocalDate(d) : '—';
  };

  const visibleBatches = batches.filter(b => b.status !== 'cancelada');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Faturamento
          </CardTitle>
          <Button size="sm" className="rounded-lg gap-1.5 font-semibold" onClick={openNew} disabled={eligible.length === 0}>
            <Plus className="h-4 w-4" /> Novo faturamento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending && <p className="text-sm text-muted-foreground text-center py-3">Carregando…</p>}
        {!isPending && visibleBatches.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">
            Nenhum faturamento ainda. Selecione fornecimentos em "Novo faturamento" para gerar a pré-fatura.
          </p>
        )}
        {visibleBatches.map(b => {
          const meta = STATUS_META[b.status] || { label: b.status, cls: 'bg-muted text-muted-foreground' };
          const arStatus = b.accounts_receivable?.status;
          return (
            <div key={b.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">
                    {(b.items || []).length} fornecimento{(b.items || []).length !== 1 ? 's' : ''} · {b.total_quantity} un · {formatCurrency(b.total_value)}
                  </span>
                  <span className="text-muted-foreground"> · criado {formatLocalDate(b.created_at)}</span>
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
                {b.accounts_receivable?.due_date && <>venc. {formatLocalDate(b.accounts_receivable.due_date)}</>}
                {b.status === 'reprovada' && b.rejected_reason && <span className="text-destructive"> · motivo: {b.rejected_reason}</span>}
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
                  // Reaproveita o MESMO lote: ciclo documental novo (pedido novo
                  // do cliente → nova solicitação → NF nova). AR antiga já foi
                  // cancelada automaticamente na reprovação.
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
                  <strong>Cliente:</strong> {clientName || '—'}<br />
                  <strong>Contrato:</strong> {eventName || ''} — Proposta {proposalNumber}<br />
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
                        <td style={{ padding: '4px 0' }}>{execName(it.composition_id)}</td>
                        <td>{execDate(it.composition_id)}</td>
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

        {/* Dialog: novo faturamento */}
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo faturamento</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground -mt-1">
              Selecione os fornecimentos a faturar. Cada um só pode entrar em um faturamento.
            </p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {eligible.map(e => (
                <label key={e.composition_id} className="flex items-center gap-3 text-sm border rounded-lg px-3 py-2 cursor-pointer">
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
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground">
                      {e.scheduled_date ? ` · ${formatLocalDate(e.scheduled_date)}` : ''}
                      {` · ${e.number_of_people ?? 0} un`}
                    </span>
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    {formatCurrency((e.number_of_people || 0) * (e.price_per_person || 0))}
                  </span>
                </label>
              ))}
              {eligible.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum fornecimento elegível.</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Nº do pedido de compras (cliente)</Label>
                <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="Ex: 4500123456" />
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-1">
              <span>{selected.size} selecionado{selected.size !== 1 ? 's' : ''} · {selectedQty} un</span>
              <span>{formatCurrency(selectedTotal)}</span>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
              <Button onClick={createBatch} disabled={busy || selected.size === 0}>Criar pré-fatura</Button>
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
                    Cria a conta a receber do contrato. O vencimento definitivo é confirmado no lançamento (KQ15).
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

export { type ExecutionRef as BillingExecutionRef };
