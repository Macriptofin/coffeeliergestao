import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Plus, Package } from "lucide-react";
import type { StockItem } from "@/pages/Stock";

interface StockOverviewProps {
  stockItems: StockItem[];
  onRefresh: () => void;
}

export function StockOverview({ stockItems, onRefresh }: StockOverviewProps) {
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    minimumQuantity: 0,
    adjustmentQuantity: 0,
    adjustmentType: 'add' as 'add' | 'remove',
    notes: ''
  });

  const handleEditStock = (stock: StockItem) => {
    setEditingStock(stock);
    setFormData({
      minimumQuantity: stock.minimumQuantity,
      adjustmentQuantity: 0,
      adjustmentType: 'add',
      notes: ''
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingStock) return;

    try {
      // Atualizar estoque mínimo
      await supabase
        .from('stock_items')
        .update({ 
          minimum_quantity: formData.minimumQuantity 
        })
        .eq('id', editingStock.id);

      // Se há ajuste de quantidade, criar movimentação
      if (formData.adjustmentQuantity !== 0) {
        const adjustmentQuantity = formData.adjustmentType === 'add' 
          ? Math.abs(formData.adjustmentQuantity)
          : -Math.abs(formData.adjustmentQuantity);

        await supabase
          .from('stock_movements')
          .insert({
            material_id: editingStock.ingredient.id,
            movement_type: 'Ajuste',
            quantity: adjustmentQuantity,
            reference_type: 'Ajuste',
            notes: formData.notes || 'Ajuste manual de estoque'
          });

        // Atualizar quantidade atual
        const newQuantity = editingStock.currentQuantity + adjustmentQuantity;
        const newTotalValue = newQuantity * editingStock.averagePrice;

        await supabase
          .from('stock_items')
          .update({ 
            current_quantity: Math.max(0, newQuantity),
            total_value: Math.max(0, newTotalValue),
            last_movement_date: new Date().toISOString()
          })
          .eq('id', editingStock.id);
      }

      toast.success('Estoque atualizado com sucesso');
      setEditDialogOpen(false);
      setEditingStock(null);
      onRefresh();
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
      toast.error('Erro ao atualizar estoque');
    }
  };

  const getStockStatus = (item: StockItem) => {
    if (item.currentQuantity === 0) return { label: 'Zerado', variant: 'destructive' as const };
    if (item.currentQuantity <= item.minimumQuantity) return { label: 'Baixo', variant: 'secondary' as const };
    return { label: 'Normal', variant: 'default' as const };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Estoque Atual
          </CardTitle>
          <CardDescription>
            Controle de quantidade, preço médio e níveis mínimos de estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum item em estoque</p>
              <p className="text-sm text-muted-foreground">
                Itens serão criados automaticamente ao lançar compras
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stockItems.map(item => {
                const status = getStockStatus(item);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{item.ingredient.name}</h3>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="block font-medium text-foreground">
                            {item.currentQuantity.toFixed(2)} {item.ingredient.usageUnit}
                          </span>
                          <span>Quantidade Atual</span>
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">
                            {item.minimumQuantity.toFixed(2)} {item.ingredient.usageUnit}
                          </span>
                          <span>Estoque Mínimo</span>
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">
                            R$ {item.averagePrice.toFixed(4)}
                          </span>
                          <span>Preço Médio</span>
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">
                            R$ {item.totalValue.toFixed(2)}
                          </span>
                          <span>Valor Total</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditStock(item)}
                      className="ml-4"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>
              {editingStock?.ingredient.name} - Ajuste o estoque mínimo e faça correções de quantidade
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="minimumQuantity">Estoque Mínimo ({editingStock?.ingredient.usageUnit})</Label>
              <Input
                id="minimumQuantity"
                type="number"
                value={formData.minimumQuantity}
                onChange={(e) => setFormData(prev => ({ ...prev, minimumQuantity: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-base font-medium">Ajuste de Quantidade</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Atual: {editingStock?.currentQuantity || 0} {editingStock?.ingredient.usageUnit}
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Button
                  variant={formData.adjustmentType === 'add' ? 'default' : 'outline'}
                  onClick={() => setFormData(prev => ({ ...prev, adjustmentType: 'add' }))}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
                <Button
                  variant={formData.adjustmentType === 'remove' ? 'default' : 'outline'}
                  onClick={() => setFormData(prev => ({ ...prev, adjustmentType: 'remove' }))}
                  className="w-full"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              </div>
              
              <Input
                type="number"
                value={formData.adjustmentQuantity}
                onChange={(e) => setFormData(prev => ({ ...prev, adjustmentQuantity: parseFloat(e.target.value) || 0 }))}
                placeholder="Quantidade a ajustar"
                className="mb-3"
              />
              
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observações do ajuste (opcional)"
              />
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="flex-1">
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}