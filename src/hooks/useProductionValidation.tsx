import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
  validation_passed: boolean;
  missing_materials: Array<{
    material_id: string;
    material_name: string;
    current_stock: number;
    required_quantity: number;
    missing_quantity: number;
    unit: string;
  }>;
  total_missing: number;
}

export function useProductionValidation() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const validateProductionStock = async (
    productionOrderId: string,
    productionOrderType: 'bom' | 'event'
  ): Promise<ValidationResult | null> => {
    setLoading(true);
    try {
      // Simular validação de estoque
      // Em uma implementação real, isso seria feito via RPC ou função do banco
      
      let missingMaterials: any[] = [];
      
      if (productionOrderType === 'bom') {
        // Buscar materiais consolidados da ordem BOM
        const { data: consolidatedMaterials, error: consolidatedError } = await supabase
          .from('bom_production_consolidated_materials')
          .select(`
            material_id,
            total_quantity,
            unit,
            material:materials(name)
          `)
          .eq('production_order_id', productionOrderId);

        if (consolidatedError) throw consolidatedError;

        // Verificar estoque de cada material
        for (const material of consolidatedMaterials || []) {
          const { data: stockData, error: stockError } = await supabase
            .from('stock_items')
            .select('current_quantity')
            .eq('material_id', material.material_id)
            .single();

          if (stockError && stockError.code !== 'PGRST116') throw stockError;

          const currentStock = stockData?.current_quantity || 0;
          
          if (currentStock < material.total_quantity) {
            const missingQuantity = material.total_quantity - currentStock;
            
            missingMaterials.push({
              material_id: material.material_id,
              material_name: material.material.name,
              current_stock: currentStock,
              required_quantity: material.total_quantity,
              missing_quantity: missingQuantity,
              unit: material.unit
            });

            // Criar necessidade de compra automaticamente
            await supabase
              .from('purchase_requirements')
              .insert({
                material_id: material.material_id,
                required_quantity: missingQuantity,
                required_unit: material.unit,
                source_type: 'production_order',
                source_id: productionOrderId,
                priority: 'high',
                required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: `Necessidade automática para ordem de produção BOM ${productionOrderId}`
              });
          }
        }
      }

      if (productionOrderType === 'event') {
        // Buscar materiais da ordem de evento
        const { data: eventOrder, error: eventError } = await supabase
          .from('event_production_orders')
          .select(`
            event_table:event_tables(
              attendees,
              items:event_table_items(
                material_id,
                fixed_quantity,
                quantity_per_person,
                unit_override,
                material:materials(name, usage_unit)
              )
            )
          `)
          .eq('id', productionOrderId)
          .single();

        if (eventError) throw eventError;

        // Verificar estoque de cada material do evento
        for (const item of eventOrder.event_table.items || []) {
          const requiredQuantity = item.fixed_quantity || 
            (item.quantity_per_person * eventOrder.event_table.attendees);
          
          const { data: stockData, error: stockError } = await supabase
            .from('stock_items')
            .select('current_quantity')
            .eq('material_id', item.material_id)
            .single();

          if (stockError && stockError.code !== 'PGRST116') throw stockError;

          const currentStock = stockData?.current_quantity || 0;
          
          if (currentStock < requiredQuantity) {
            const missingQuantity = requiredQuantity - currentStock;
            
            missingMaterials.push({
              material_id: item.material_id,
              material_name: item.material.name,
              current_stock: currentStock,
              required_quantity: requiredQuantity,
              missing_quantity: missingQuantity,
              unit: item.unit_override || item.material.usage_unit
            });

            // Criar necessidade de compra automaticamente
            await supabase
              .from('purchase_requirements')
              .insert({
                material_id: item.material_id,
                required_quantity: missingQuantity,
                required_unit: item.unit_override || item.material.usage_unit,
                source_type: 'production_order',
                source_id: productionOrderId,
                priority: 'high',
                required_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: `Necessidade automática para ordem de produção Evento ${productionOrderId}`
              });
          }
        }
      }

      // Registrar resultado da validação
      await supabase
        .from('production_stock_validations')
        .insert({
          production_order_id: productionOrderId,
          production_order_type: productionOrderType,
          validation_status: missingMaterials.length > 0 ? 'failed' : 'passed',
          missing_materials: missingMaterials
        });

      const result: ValidationResult = {
        validation_passed: missingMaterials.length === 0,
        missing_materials: missingMaterials,
        total_missing: missingMaterials.length
      };

      if (!result.validation_passed) {
        toast({
          title: "Estoque Insuficiente",
          description: `${result.total_missing} material(s) em falta. Necessidades de compra criadas automaticamente.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Validação OK",
          description: "Todos os materiais têm estoque suficiente para produção.",
        });
      }

      return result;
    } catch (error) {
      console.error('Error validating production stock:', error);
      toast({
        title: "Erro",
        description: "Erro ao validar estoque para produção.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    validateProductionStock,
    loading
  };
}