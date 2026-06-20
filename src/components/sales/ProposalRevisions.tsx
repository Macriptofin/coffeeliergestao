import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { formatLocalDate } from '@/lib/date-utils';

interface RevisionRow {
  id: string;
  revision: number;
  total_amount: number | null;
  total_cost: number | null;
  number_of_people: number | null;
  status: string | null;
  created_at: string | null;
  data: any;
}

// Histórico de revisões enviadas de uma proposta (snapshots de auditoria).
export function ProposalRevisions({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: revisions = [] } = useQuery({
    queryKey: ['proposal-revisions', proposalId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposal_revisions')
        .select('id, revision, total_amount, total_cost, number_of_people, status, created_at, data')
        .eq('proposal_id', proposalId)
        .order('revision', { ascending: false });
      if (error) throw error;
      return (data || []) as RevisionRow[];
    },
  });

  const margin = (r: RevisionRow) =>
    r.total_cost != null && r.total_amount && r.total_amount > 0
      ? (r.total_amount - r.total_cost) / r.total_amount
      : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Revisões
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de revisões</DialogTitle>
        </DialogHeader>

        {revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma revisão registrada ainda. A cada envio ao cliente, uma revisão é gravada aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {revisions.map(r => {
              const isOpen = expanded === r.id;
              const comps = r.data?.compositions ?? [];
              return (
                <div key={r.id} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Badge variant="secondary">Rev. {r.revision}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {r.created_at ? formatLocalDate(r.created_at) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium">{formatCurrency(r.total_amount)}</span>
                      <span className={`text-xs ${(margin(r) ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        {margin(r) != null ? `margem ${formatPercent(margin(r))}` : '—'}
                      </span>
                      <span className="text-xs text-muted-foreground">{r.number_of_people ?? '—'} pess.</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t space-y-3">
                      {comps.length === 0 && (
                        <p className="text-xs text-muted-foreground">Sem detalhe de composição neste snapshot.</p>
                      )}
                      {comps.map((c: any, ci: number) => (
                        <div key={ci}>
                          <p className="text-xs font-semibold">
                            {c.name || `Composição ${ci + 1}`}
                            {c.people ? ` · ${c.people} pessoas` : ''}
                            {c.price_per_person ? ` · ${formatCurrency(c.price_per_person)}/pessoa` : ''}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {(c.items ?? []).map((it: any, ii: number) => (
                              <li key={ii} className="text-xs text-muted-foreground flex gap-2">
                                <span className="font-mono">
                                  {it.qty_per_person != null ? `${it.qty_per_person}/pess` : `${it.fixed_qty} fixo`}
                                </span>
                                <span>{it.material}</span>
                                <span className="opacity-50">({it.section})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
