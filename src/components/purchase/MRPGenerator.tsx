import { useState } from 'react';
import { todayLocalISO, addDaysLocalISO } from '@/lib/date-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp, Loader2, CheckCircle2, AlertTriangle,
  Calendar, Package, RefreshCcw
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MRPResult {
  material_id:    string;
  material_name:  string;
  required_qty:   number;
  unit:           string;
  current_stock:  number;
  gap:            number;
  source:         string;
  priority:       'alta' | 'media' | 'baixa';
}

interface Props {
  onGenerated?: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MRPGenerator({ onGenerated }: Props) {
  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState<MRPResult[]>([]);
  const [creating,  setCreating]  = useState(false);
  const [done,      setDone]      = useState(false);
  const [horizon,   setHorizon]   = useState(30); // dias

  const runMRP = async () => {
    try {
      setLoading(true);
      setResults([]);
      setDone(false);

      const today = todayLocalISO();
      const end = addDaysLocalISO(horizon);

      // 1. Buscar eventos nos próximos N dias
      const { data: events } = await supabase
        .from('event_tables')
        .select('id, event_code, attendees, date_start')
        .gte('date_start', today)
        .lte('date_start', end)
        .neq('status', 'cancelado');

      // 2. Buscar materiais abaixo do mínimo
      const { data: stockLow } = await supabase
        .from('vw_stock_available')
        .select('material_id, material_name, usage_unit, saldo_fisico, minimo')
        .in('status_estoque', ['critico', 'zerado']);

      const needs: Record<string, MRPResult> = {};

      // 2a. Necessidades por estoque abaixo do mínimo
      (stockLow || []).forEach((s: any) => {
        const gap = (s.minimo || 0) - (s.saldo_fisico || 0);
        if (gap > 0) {
          needs[s.material_id] = {
            material_id:   s.material_id,
            material_name: s.material_name,
            required_qty:  gap,
            unit:          s.usage_unit || 'un',
            current_stock: parseFloat(s.saldo_fisico || 0),
            gap,
            source:        'Estoque abaixo do mínimo',
            priority:      parseFloat(s.saldo_fisico || 0) <= 0 ? 'alta' : 'media',
          };
        }
      });

      // 2b. Necessidades por eventos futuros
      for (const event of (events || [])) {
        const { data: exploded } = await supabase
          .rpc('explode_event_requirements', {
            p_event_table_id:   event.id,
            p_explode_components: true,
          });

        (exploded || []).forEach((item: any) => {
          const id = item.material_id;
          const qty = parseFloat(item.planned_qty || 0);

          if (needs[id]) {
            needs[id].required_qty += qty;
            needs[id].source = 'Estoque + Evento';
          } else {
            needs[id] = {
              material_id:   id,
              material_name: item.material_name,
              required_qty:  qty,
              unit:          item.planned_unit || 'un',
              current_stock: 0,
              gap:           qty,
              source:        `Evento: ${event.event_code || event.id.slice(0, 8)}`,
              priority:      'media',
            };
          }
        });
      }

      const sorted = Object.values(needs).sort((a, b) => {
        const p = { alta: 0, media: 1, baixa: 2 };
        return p[a.priority] - p[b.priority];
      });

      setResults(sorted);

      if (sorted.length === 0) {
        toast.success('Ótimo! Nenhuma necessidade de compra identificada.');
      } else {
        toast.info(`${sorted.length} necessidades identificadas. Confirme para criar as requisições.`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao gerar MRP: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const createRequirements = async () => {
    if (!results.length) return;
    try {
      setCreating(true);

      const today = todayLocalISO();
      const due = addDaysLocalISO(7);

      const rows = results.map(r => ({
        material_id:       r.material_id,
        required_quantity: r.required_qty,
        required_unit:     r.unit,
        source_type:       'mrp',
        priority:          r.priority === 'alta' ? 'high' : r.priority === 'media' ? 'medium' : 'low',
        status:            'pending',
        required_date:     due,
        notes:             `Gerado pelo MRP — ${r.source}`,
      }));

      const { error } = await supabase.from('purchase_requirements').insert(rows);
      if (error) throw error;

      toast.success(`${rows.length} requisições de compra criadas!`);
      setDone(true);
      onGenerated?.();
    } catch (e: any) {
      toast.error('Erro ao criar requisições: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const priorityColor = (p: string) =>
    p === 'alta' ? 'bg-red-100 text-red-700 border-red-200'
    : p === 'media' ? 'bg-orange-100 text-orange-700 border-orange-200'
    : 'bg-blue-100 text-blue-700 border-blue-200';

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Gerador de Necessidades de Compra (MRP)
        </CardTitle>
        <CardDescription>
          Analisa estoque atual e eventos futuros para gerar automaticamente as requisições de compra.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Horizonte:</span>
            {[7, 14, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setHorizon(d)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  horizon === d ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <Button
            onClick={runMRP}
            disabled={loading}
            size="sm"
            className="ml-auto"
          >
            {loading
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <RefreshCcw className="h-4 w-4 mr-2" />
            }
            {loading ? 'Analisando...' : 'Analisar Necessidades'}
          </Button>
        </div>

        {/* Resultados */}
        {results.length > 0 && !done && (
          <>
            <Separator />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map(r => (
                <div key={r.material_id}
                  className="flex items-center justify-between p-2.5 border rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${priorityColor(r.priority)}`}>{r.priority}</Badge>
                      <span className="font-medium truncate">{r.material_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.source}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-semibold">{r.required_qty.toFixed(2)} {r.unit}</p>
                    <p className="text-xs text-muted-foreground">
                      estoque: {r.current_stock.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-muted-foreground">
                {results.filter(r => r.priority === 'alta').length} alta ·{' '}
                {results.filter(r => r.priority === 'media').length} média prioridade
              </span>
              <Button onClick={createRequirements} disabled={creating}>
                {creating
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Package className="h-4 w-4 mr-2" />
                }
                Criar {results.length} Requisições
              </Button>
            </div>
          </>
        )}

        {done && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Requisições criadas com sucesso. Acesse a aba Requisições para visualizar.
          </div>
        )}

        {!loading && results.length === 0 && !done && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Analisar Necessidades" para verificar o que precisa ser comprado.
          </p>
        )}

      </CardContent>
    </Card>
  );
}
