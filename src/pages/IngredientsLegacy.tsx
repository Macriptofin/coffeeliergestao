import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { IngredientForm } from "@/components/IngredientForm";
import { IngredientsList } from "@/components/IngredientsList";
import type { Ingredient } from "./Index";

const Ingredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      const formattedIngredients = data.map(item => ({
        id: item.id,
        name: item.name,
        purchaseUnit: item.purchase_unit,
        usageUnit: item.usage_unit,
        conversionFactor: parseFloat(item.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(item.price_per_purchase_unit.toString()),
        supplier: item.supplier || undefined
      }));
      
      setIngredients(formattedIngredients);
    } catch (error) {
      console.error('Erro ao carregar ingredientes:', error);
      toast.error('Erro ao carregar ingredientes');
    } finally {
      setLoading(false);
    }
  };

  const addIngredient = async (ingredient: Omit<Ingredient, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .insert({
          name: ingredient.name,
          purchase_unit: ingredient.purchaseUnit,
          usage_unit: ingredient.usageUnit,
          conversion_factor: ingredient.conversionFactor,
          price_per_purchase_unit: ingredient.pricePerPurchaseUnit,
          supplier: ingredient.supplier
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newIngredient: Ingredient = {
        id: data.id,
        name: data.name,
        purchaseUnit: data.purchase_unit,
        usageUnit: data.usage_unit,
        conversionFactor: parseFloat(data.conversion_factor.toString()),
        pricePerPurchaseUnit: parseFloat(data.price_per_purchase_unit.toString()),
        supplier: data.supplier || undefined
      };
      
      setIngredients([...ingredients, newIngredient]);
      setShowIngredientForm(false);
      toast.success('Ingrediente cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar ingrediente:', error);
      toast.error('Erro ao cadastrar ingrediente');
    }
  };

  const updateIngredient = async (updatedIngredient: Ingredient) => {
    try {
      const { error } = await supabase
        .from('materials')
        .update({
          name: updatedIngredient.name,
          purchase_unit: updatedIngredient.purchaseUnit,
          usage_unit: updatedIngredient.usageUnit,
          conversion_factor: updatedIngredient.conversionFactor,
          price_per_purchase_unit: updatedIngredient.pricePerPurchaseUnit,
          supplier: updatedIngredient.supplier
        })
        .eq('id', updatedIngredient.id);
      
      if (error) throw error;
      
      setIngredients(ingredients.map(ing => 
        ing.id === updatedIngredient.id ? updatedIngredient : ing
      ));
      setEditingIngredient(null);
      setShowIngredientForm(false);
      toast.success('Ingrediente atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar ingrediente:', error);
      toast.error('Erro ao atualizar ingrediente');
    }
  };

  const deleteIngredient = async (ingredientId: string) => {
    try {
      const { error } = await supabase
        .from('materials')
        .delete()
        .eq('id', ingredientId);
      
      if (error) throw error;
      
      setIngredients(ingredients.filter(ing => ing.id !== ingredientId));
      toast.success('Ingrediente excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir ingrediente:', error);
      toast.error('Erro ao excluir ingrediente');
    }
  };

  const handleIngredientSubmit = (ingredientData: Omit<Ingredient, 'id'>) => {
    if (editingIngredient) {
      updateIngredient({ ...ingredientData, id: editingIngredient.id });
    } else {
      addIngredient(ingredientData);
    }
  };

  const startEditingIngredient = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setShowIngredientForm(true);
  };

  const cancelIngredientForm = () => {
    setEditingIngredient(null);
    setShowIngredientForm(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gestão de Ingredientes</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os ingredientes da sua confeitaria</p>
        </div>
        <Button 
          onClick={() => setShowIngredientForm(true)}
          className="bg-gradient-primary hover:bg-primary/90 shadow-soft"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Ingrediente
        </Button>
      </div>

      {showIngredientForm && (
        <div className="mb-8">
          <IngredientForm 
            ingredient={editingIngredient}
            existingIngredients={ingredients}
            onSubmit={handleIngredientSubmit}
            onCancel={cancelIngredientForm}
          />
        </div>
      )}

      <IngredientsList 
        ingredients={ingredients} 
        onEdit={startEditingIngredient}
        onDelete={deleteIngredient}
      />
    </div>
  );
};

export default Ingredients;