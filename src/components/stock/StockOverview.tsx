import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Plus, Package, Search, FileText } from "lucide-react";
import type { StockItem } from "@/pages/Stock";
import { materialCategories } from "@/lib/material-categories";

interface StockOverviewProps {
  stockItems: StockItem[];
  onRefresh: () => void;
}

export function StockOverview({ stockItems, onRefresh }: StockOverviewProps) {
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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

  const getStockStatusColor = (item: StockItem) => {
    if (item.currentQuantity === 0 || item.currentQuantity < item.minimumQuantity) {
      return 'text-red-600 dark:text-red-400 font-semibold';
    }
    if (item.currentQuantity === item.minimumQuantity) {
      return 'text-yellow-600 dark:text-yellow-400 font-semibold';
    }
    return 'text-green-600 dark:text-green-400 font-semibold';
  };

  const isFromTechnicalSheet = (materialType: string) => {
    return materialType === 'finished_product' || materialType === 'intermediate_product';
  };

  // Filtrar itens pela busca e categoria
  const filteredItems = stockItems.filter(item => {
    const matchesSearch = item.ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.ingredient.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.ingredient.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Estoque Atual
              </CardTitle>
              <CardDescription>
                Controle de quantidade, preço médio e níveis mínimos de estoque
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar material ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {materialCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 && searchTerm ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum material encontrado com "{searchTerm}"</p>
            </div>
          ) : stockItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum item em estoque</p>
              <p className="text-sm text-muted-foreground">
                Itens serão criados automaticamente ao lançar compras
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map(item => {
                const stockColor = getStockStatusColor(item);
                const fromTechnicalSheet = isFromTechnicalSheet(item.ingredient.materialType);
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.ingredient.code}
                        </Badge>
                        <h3 className="font-medium">{item.ingredient.name}</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className={`block font-medium ${stockColor}`}>
                            {item.currentQuantity.toFixed(2)} {item.ingredient.usageUnit}
                          </span>
                          <span>Estoque Atual</span>
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
                    <div className="flex items-center gap-2 ml-4">
                      {fromTechnicalSheet && (
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          Ficha Técnica
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditStock(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
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