import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText } from 'lucide-react';
import { QuoteRequestForm } from './QuoteRequestForm';
import { QuoteRequestDetail } from './QuoteRequestDetail';

interface QuoteRequestRow {
  id: string;
  quote_number: string;
  deadline_date: string;
  status: string;
  supplier_count: number;
  quoted_count: number;
}

type View = { mode: 'list' } | { mode: 'create' } | { mode: 'detail'; id: string };

interface QuoteRequestsListProps {
  /** Requisição de compra aprovada de onde puxar os itens ao abrir já em modo criação. */
  initialFromRequestId?: string | null;
  /** Chamado assim que a requisição de origem é consumida (form aberto ou cancelado). */
  onConsumeFromRequest?: () => void;
}

export const QuoteRequestsList = ({ initialFromRequestId, onConsumeFromRequest }: QuoteRequestsListProps) => {
  const [view, setView] = useState<View>(() => initialFromRequestId ? { mode: 'create' } : { mode: 'list' });
  const [rows, setRows] = useState<QuoteRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from('quote_requests')
        .select('id, quote_number, deadline_date, status')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (requests || []).map(r => r.id);
      if (ids.length === 0) { setRows([]); return; }

      const [{ data: suppliers }, { data: quotes }] = await Promise.all([
        supabase.from('quote_request_suppliers').select('quote_request_id').in('quote_request_id', ids),
        supabase.from('supplier_quotes').select('quote_request_id').in('quote_request_id', ids),
      ]);

      const supplierCounts: Record<string, number> = {};
      (suppliers || []).forEach((s: any) => { supplierCounts[s.quote_request_id] = (supplierCounts[s.quote_request_id] || 0) + 1; });
      const quotedCounts: Record<string, number> = {};
      (quotes || []).forEach((q: any) => { quotedCounts[q.quote_request_id] = (quotedCounts[q.quote_request_id] || 0) + 1; });

      setRows((requests || []).map(r => ({
        ...r,
        supplier_count: supplierCounts[r.id] || 0,
        quoted_count: quotedCounts[r.id] || 0,
      })));
    } catch (error) {
      console.error('Erro ao carregar cotações:', error);
      toast.error('Erro ao carregar cotações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view.mode === 'list') loadRows();
  }, [view, loadRows]);

  if (view.mode === 'create') {
    return (
      <QuoteRequestForm
        fromRequestId={initialFromRequestId ?? undefined}
        onSuccess={(id) => { onConsumeFromRequest?.(); setView({ mode: 'detail', id }); }}
        onCancel={() => { onConsumeFromRequest?.(); setView({ mode: 'list' }); }}
      />
    );
  }

  if (view.mode === 'detail') {
    return (
      <QuoteRequestDetail
        quoteRequestId={view.id}
        onBack={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Cotações</CardTitle>
          <CardDescription>Solicite e compare preços entre fornecedores antes de comprar.</CardDescription>
        </div>
        <Button onClick={() => setView({ mode: 'create' })}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Cotação
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3" />
            <p>Nenhuma cotação criada ainda.</p>
            <p className="text-xs mt-1">Crie uma cotação pra comparar preços de vários fornecedores antes de comprar.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Fornecedores</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setView({ mode: 'detail', id: row.id })}>
                  <TableCell className="font-mono">{row.quote_number}</TableCell>
                  <TableCell>{new Date(row.deadline_date + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{row.quoted_count} de {row.supplier_count} com preço lançado</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'Concluída' ? 'default' : row.status === 'Cancelada' ? 'outline' : 'secondary'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setView({ mode: 'detail', id: row.id }); }}>
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
