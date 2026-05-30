import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Loader2, CheckSquare, Package, ChefHat } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  material_name: string;
  total_quantity: number;
  unit: string;
  is_consumed: boolean;
  is_reserved: boolean;
  bom_name: string;
}

interface BomItem {
  id: string;
  bom_name: string;
  quantity: number;
  yield_quantity: number;
  yield_unit: string;
  item_cost: number;
}

interface Props {
  orderId: string;
  orderName: string;
  orderDate: string;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ProductionChecklist({ orderId, orderName, orderDate, onClose }: Props) {
  const [materials, setMaterials] = useState<ChecklistItem[]>([]);
  const [boms,      setBoms]      = useState<BomItem[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { loadData(); }, [orderId]);

  const loadData = async () => {
    try {
      const [matsRes, bomsRes] = await Promise.all([
        supabase
          .from('bom_production_consolidated_materials')
          .select(`
            total_quantity, is_consumed, is_reserved,
            materials:material_id (name, usage_unit),
            bom_production_orders:production_order_id (order_name)
          `)
          .eq('production_order_id', orderId)
          .order('is_consumed'),

        supabase
          .from('bom_production_order_items')
          .select(`
            id, quantity, multiplier, total_yield_quantity, item_cost,
            recipes_bom:bom_id (yield_unit, materials!finished_material_id(name))
          `)
          .eq('production_order_id', orderId),
      ]);

      setMaterials((matsRes.data || []).map((m: any) => ({
        material_name: m.materials?.name || '—',
        total_quantity: parseFloat(m.total_quantity || 0),
        unit:           m.materials?.usage_unit || '',
        is_consumed:    m.is_consumed,
        is_reserved:    m.is_reserved,
        bom_name:       m.bom_production_orders?.order_name || '',
      })));

      setBoms((bomsRes.data || []).map((b: any) => ({
        id:             b.id,
        bom_name:       b.recipes_bom?.materials?.name || '—',
        quantity:       b.quantity,
        yield_quantity: parseFloat(b.total_yield_quantity || 0),
        yield_unit:     b.recipes_bom?.yield_unit || 'un',
        item_cost:      parseFloat(b.item_cost || 0),
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between print:block">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Checklist de Produção
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {orderName} · {new Date(orderDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>

      {/* Produtos a Fabricar */}
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <ChefHat className="h-4 w-4" />
          Produtos a Fabricar ({boms.length})
        </h3>
        <div className="space-y-2">
          {boms.map((bom, i) => (
            <div key={bom.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border-2 border-muted-foreground print:border-gray-400 flex-shrink-0" />
                <div>
                  <span className="font-medium">{bom.bom_name}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {bom.quantity}× → {fmt(bom.yield_quantity)} {bom.yield_unit}
                  </span>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                R$ {fmt(bom.item_cost)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Materiais Necessários */}
      <div>
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" />
          Materiais Necessários ({materials.length})
        </h3>

        {/* Cabeçalho da tabela */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted rounded-t-lg text-xs font-semibold text-muted-foreground">
          <span className="col-span-1">✓</span>
          <span className="col-span-6">Material</span>
          <span className="col-span-3 text-right">Quantidade</span>
          <span className="col-span-2 text-center">Status</span>
        </div>

        <div className="border border-t-0 rounded-b-lg divide-y">
          {materials.map((mat, i) => (
            <div key={i} className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center text-sm ${mat.is_consumed ? 'opacity-50' : ''}`}>
              <div className="col-span-1">
                <div className={`w-5 h-5 rounded border-2 ${mat.is_consumed ? 'bg-green-500 border-green-500' : 'border-gray-400'} flex items-center justify-center`}>
                  {mat.is_consumed && <span className="text-white text-xs">✓</span>}
                </div>
              </div>
              <span className={`col-span-6 font-medium ${mat.is_consumed ? 'line-through text-muted-foreground' : ''}`}>
                {mat.material_name}
              </span>
              <span className="col-span-3 text-right">
                {fmt(mat.total_quantity)} <span className="text-muted-foreground text-xs">{mat.unit}</span>
              </span>
              <div className="col-span-2 flex justify-center">
                {mat.is_consumed ? (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Usado</Badge>
                ) : mat.is_reserved ? (
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Reservado</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Pendente</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assinatura */}
      <div className="hidden print:grid grid-cols-3 gap-8 mt-12 pt-8 border-t">
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 text-xs text-gray-600">Responsável pela Produção</div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 text-xs text-gray-600">Conferência</div>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 pt-2 text-xs text-gray-600">Data / Hora</div>
        </div>
      </div>
    </div>
  );
}
