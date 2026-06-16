import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialEditor } from "@/components/MaterialEditor";
import { supabase } from "@/integrations/supabase/client";
import { Material } from "@/types";
import { toast } from "sonner";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select(`
      id,
      name,
      description,
      purchase_unit,
      usage_unit,
      conversion_factor,
      price_per_purchase_unit,
      allowed_brands,
      category,
      subcategory,
      code,
      material_type,
      unit_weight,
      is_sellable,
      type_term_id,
      category_term_id,
      subcategory_term_id
    `)
    .order('name');

  if (error) throw error;

  return (data || []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || undefined,
    purchaseUnit: item.purchase_unit,
    usageUnit: item.usage_unit,
    conversionFactor: parseFloat(item.conversion_factor?.toString() || '1'),
    pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit?.toString() || '0'),
    allowedBrands: item.allowed_brands || undefined,
    category: item.category,
    subcategory: item.subcategory || undefined,
    code: item.code,
    materialType: (item.material_type || 'ingredient') as Material['materialType'],
    unitWeight: item.unit_weight ? parseFloat(item.unit_weight.toString()) : undefined,
    isSellable: Boolean(item.is_sellable),
    typeTermId: item.type_term_id || undefined,
    categoryTermId: item.category_term_id || undefined,
    subcategoryTermId: item.subcategory_term_id || undefined,
  }));
}

export const MaterialEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: materials = [],
    isPending: loading,
    isError,
  } = useQuery({
    queryKey: ['materials'],
    queryFn: fetchMaterials,
  });

  const material = id ? materials.find((m) => m.id === id) ?? null : null;

  useEffect(() => {
    if (!id) {
      navigate('/ingredientes');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isError) {
      toast.error('Erro ao carregar material');
      navigate('/ingredientes');
    }
  }, [isError, navigate]);

  // After the list loads, ensure the requested material exists
  useEffect(() => {
    if (!loading && !isError && id && !material) {
      toast.error('Material não encontrado');
      navigate('/ingredientes');
    }
  }, [loading, isError, id, material, navigate]);

  const handleSave = async (updatedMaterial: Material) => {
    try {
      const { error } = await supabase
        .from('materials')
        .update({
          name: updatedMaterial.name,
          description: updatedMaterial.description,
          purchase_unit: updatedMaterial.purchaseUnit,
          usage_unit: updatedMaterial.usageUnit,
          conversion_factor: updatedMaterial.conversionFactor,
          price_per_purchase_unit: updatedMaterial.pricePerPurchaseUnit,
          supplier: updatedMaterial.supplier,
          allowed_brands: updatedMaterial.allowedBrands,
          category: updatedMaterial.category,
          subcategory: updatedMaterial.subcategory,
          material_type: updatedMaterial.materialType,
          unit_weight: updatedMaterial.unitWeight,
          is_sellable: updatedMaterial.isSellable || false,
          type_term_id: updatedMaterial.typeTermId,
          category_term_id: updatedMaterial.categoryTermId,
          subcategory_term_id: updatedMaterial.subcategoryTermId
        })
        .eq('id', updatedMaterial.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['material', updatedMaterial.id] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar material:', error);
      toast.error('Erro ao atualizar material');
    }
  };

  const handleClose = () => {
    navigate('/ingredientes');
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!material) return;

    const currentIndex = materials.findIndex(m => m.id === material.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < materials.length) {
      const newMaterial = materials[newIndex];
      navigate(`/estoque/materiais/${newMaterial.id}/editar`);
    }
  };

  const canNavigate = material ? {
    prev: materials.findIndex(m => m.id === material.id) > 0,
    next: materials.findIndex(m => m.id === material.id) < materials.length - 1
  } : { prev: false, next: false };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando material...</p>
        </div>
      </div>
    );
  }

  return (
    <MaterialEditor
      material={material}
      materials={materials}
      isOpen={true}
      onClose={handleClose}
      onSave={handleSave}
      onNavigate={handleNavigate}
      canNavigate={canNavigate}
    />
  );
};
