import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Wallet, CalendarClock, ChevronDown, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';
import { LaunchUmbrellaExecutionDialog } from './LaunchUmbrellaExecutionDialog';
import { sectionLabel } from './ProposalDetailView';

interface Props {
  proposalId: string;
  onBack: () => void;
  onViewProposal?: (id: string) => void;
}

interface UmbrellaProposalHeader {
  id: string;
  proposal_number: string;
  event_name: string | null;
  status: string;
  is_umbrella: boolean;
  client_id: string;
  clients: { name: string } | null;
}

interface UmbrellaExecution {
  composition_id: string;
  name: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  number_of_people: number | null;
  price_per_person: number | null;
  value: number;
  event_id: string | null;
  event_status: string | null;
}

interface UmbrellaProgress {
  quota_quantity: number | null;
  quota_unit_price: number | null;
  quota_value_total: number;
  consumed_quantity: number;
  consumed_value: number;
  remaining_quantity: number;
  remaining_value: number;
  executions: UmbrellaExecution[];
}

interface MenuSection {
  label: string;
  items: { name: string; usage_unit: string | null; qty_per_person: number | null; fixed_qty: number | null }[];
}

// Cardápio de UMA execução, carregado sob demanda ao expandir a linha do extrato.
async function fetchExecutionMenu(compositionId: string): Promise<MenuSection[]> {
  const { data, error } = await supabase
    .from('proposal_categories')
    .select('category_label, sort_order, proposal_category_items(qty_per_person, fixed_qty, materials(name, usage_unit))')
    .eq('composition_id', compositionId)
    .order('sort_order');
  if (error) throw error;
  return ((data || []) as any[]).map(c => ({
    label: sectionLabel(c.category_label),
    items: (c.proposal_category_items || []).map((i: any) => ({
      name: i.materials?.name || '—',
      usage_unit: i.materials?.usage_unit || null,
      qty_per_person: i.qty_per_person,
      fixed_qty: i.fixed_qty,
    })),
  }));
}

function ExecutionMenu({ execution }: { execution: UmbrellaExecution }) {
  const { data: sections = [], isPending } = useQuery({
    queryKey: ['umbrella-execution-menu', execution.composition_id],
    queryFn: () => fetchExecutionMenu(execution.composition_id),
  });

  if (isPending) {
    return <div className="py-6 flex justify-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Composição de preço da execução */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Preço/pessoa: <strong className="text-foreground">{formatCurrency(execution.price_per_person ?? 0)}</strong>
        </span>
        <span className="text-muted-foreground">
          Pessoas: <strong className="text-foreground">{execution.number_of_people ?? '—'}</strong>
        </span>
        <span className="text-muted-foreground">
          Total: <strong className="text-foreground">{formatCurrency(execution.value)}</strong>
        </span>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta execução não tem itens de cardápio.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sections.map((sec, i) => (
            <div key={i} className="bg-background rounded-lg border p-3">
              <p className="font-semibold text-sm mb-1">{sec.label}</p>
              {sec.items.map((it, j) => (
                <div key={j} className="flex justify-between items-center py-1.5 border-t border-dashed border-border first:border-t-0 text-sm">
                  <span>{it.name}</span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {it.qty_per_person != null
                      ? `${it.qty_per_person} ${it.usage_unit || 'un'}/pessoa`
                      : `${it.fixed_qty ?? 0} ${it.usage_unit || 'un'}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function fetchUmbrellaPanelData(proposalId: string) {
  const [propRes, progressRes] = await Promise.all([
    supabase.from('proposals')
      .select('id, proposal_number, event_name, status, is_umbrella, client_id, clients(name)')
      .eq('id', proposalId)
      .single(),
    supabase.rpc('get_umbrella_progress', { p_proposal_id: proposalId }),
  ]);
  if (propRes.error) throw propRes.error;
  if (progressRes.error) throw progressRes.error;
  return {
    proposal: propRes.data as unknown as UmbrellaProposalHeader,
    progress: progressRes.data as UmbrellaProgress,
  };
}

export function ProposalUmbrellaPanel({ proposalId, onBack, onViewProposal }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryKey = ['proposal-umbrella-panel', proposalId];
  const { data, isPending, isError } = useQuery({
    queryKey,
    queryFn: () => fetchUmbrellaPanelData(proposalId),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey });

  if (isPending) {
    return <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-muted-foreground">Não foi possível carregar esta proposta guarda-chuva.</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar às propostas
        </Button>
      </div>
    );
  }

  const { proposal, progress } = data;
  const quotaQty = progress.quota_quantity ?? 0;
  const consumedQty = progress.consumed_quantity ?? 0;
  const pctQty = quotaQty > 0 ? Math.min(100, (consumedQty / quotaQty) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {proposal.event_name || `Proposta ${proposal.proposal_number}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              Prop. {proposal.proposal_number} · {proposal.clients?.name} · Guarda-chuva
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onViewProposal && (
            <Button variant="outline" onClick={() => onViewProposal(proposalId)}>
              <FileText className="h-4 w-4 mr-2" /> Ver proposta
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Lançar execução
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saldo da cota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Quantidade consumida</span>
              <span className="font-medium">{consumedQty} / {quotaQty || '—'}</span>
            </div>
            <Progress value={pctQty} />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Contratado</p>
              <p className="text-lg font-semibold">{quotaQty}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(progress.quota_value_total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consumido</p>
              <p className="text-lg font-semibold">{consumedQty}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(progress.consumed_value)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Restante</p>
              <p className="text-lg font-semibold text-primary">{progress.remaining_quantity}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(progress.remaining_value)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Extrato de execuções
          </CardTitle>
        </CardHeader>
        <CardContent>
          {progress.executions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução lançada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Execução</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.executions.map(ex => {
                  const isExpanded = expandedId === ex.composition_id;
                  return (
                    <React.Fragment key={ex.composition_id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : ex.composition_id)}>
                        <TableCell className="pr-0">
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                        </TableCell>
                        <TableCell className="font-medium">{ex.name}</TableCell>
                        <TableCell>
                          {ex.scheduled_date ? formatLocalDate(ex.scheduled_date) : '—'}
                          {ex.scheduled_time ? ` ${String(ex.scheduled_time).slice(0, 5)}` : ''}
                        </TableCell>
                        <TableCell className="text-right">{ex.number_of_people ?? '—'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(ex.value)}</TableCell>
                        <TableCell>
                          {ex.event_status ? (
                            <Badge variant="secondary">{ex.event_status}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">sem evento</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-0">
                            <ExecutionMenu execution={ex} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LaunchUmbrellaExecutionDialog
        proposalId={proposalId}
        clientId={proposal.client_id}
        eventName={proposal.event_name}
        matrixUnitPrice={progress.quota_unit_price ?? progress.executions[0]?.price_per_person ?? null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLaunched={refetch}
      />
    </div>
  );
}
