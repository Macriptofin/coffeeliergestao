import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface MaterialQuickCreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  purchaseUnit: string;
  onSuccess: (materialId: string) => void;
}

export const MaterialQuickCreate = ({
  open,
  onOpenChange,
  itemName,
  purchaseUnit,
  onSuccess
}: MaterialQuickCreateProps) => {
  const [formData, setFormData] = useState({
    name: itemName,
    code: '',
    usageUnit: purchaseUnit,
    conversionFactor: 1,
    category: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name || !formData.usageUnit || !formData.category) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const { data: material, error } = await supabase
        .from('materials')
        .insert([{
          name: formData.name,
          code: formData.code || null,
          category: formData.category,
          purchase_unit: purchaseUnit,
          usage_unit: formData.usageUnit,
          conversion_factor: formData.conversionFactor,
          price_per_purchase_unit: 0,
          is_archived: false
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Material cadastrado',
        description: 'Material cadastrado com sucesso!'
      });

      onSuccess(material.id);
      onOpenChange(false);

    } catch (error) {
      console.error('Erro ao cadastrar material:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao cadastrar material',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadastro Rápido de Material</DialogTitle>
          <DialogDescription>
            Cadastre o material para poder vincular ao item da nota fiscal
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Material *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ex: Banana Catarina"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Código</Label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({...formData, code: e.target.value})}
              placeholder="Ex: BAN001"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade de Compra *</Label>
              <Input
                value={purchaseUnit}
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Da nota fiscal</p>
            </div>
            
            <div className="space-y-2">
              <Label>Unidade de Uso *</Label>
              <Select
                value={formData.usageUnit}
                onValueChange={(value) => setFormData({...formData, usageUnit: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg (quilograma)</SelectItem>
                  <SelectItem value="g">g (grama)</SelectItem>
                  <SelectItem value="L">L (litro)</SelectItem>
                  <SelectItem value="mL">mL (mililitro)</SelectItem>
                  <SelectItem value="un">un (unidade)</SelectItem>
                  <SelectItem value="cx">cx (caixa)</SelectItem>
                  <SelectItem value="pc">pc (pacote)</SelectItem>
                  <SelectItem value="sc">sc (saco)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Fator de Conversão *</Label>
            <Input
              type="number"
              step="0.001"
              value={formData.conversionFactor}
              onChange={(e) => setFormData({...formData, conversionFactor: parseFloat(e.target.value) || 1})}
            />
            <p className="text-xs text-muted-foreground">
              1 {purchaseUnit} = {formData.conversionFactor} {formData.usageUnit}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({...formData, category: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Insumo">Insumo</SelectItem>
                <SelectItem value="Embalagem">Embalagem</SelectItem>
                <SelectItem value="Produto Acabado">Produto Acabado</SelectItem>
                <SelectItem value="Produto Composto">Produto Composto</SelectItem>
                <SelectItem value="Produto Intermediário">Produto Intermediário</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.name || !formData.usageUnit || !formData.category || saving}
          >
            {saving ? 'Cadastrando...' : 'Cadastrar e Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
