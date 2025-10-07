import type { Ingredient } from "@/types";

// Função para calcular o preço por unidade de uso
export const getPricePerUsageUnit = (ingredient: Ingredient): number => {
  return ingredient.pricePerPurchaseUnit / ingredient.conversionFactor;
};

// Função para obter a unidade principal (para compatibilidade)
export const getMainUnit = (ingredient: Ingredient): string => {
  return ingredient.usageUnit;
};

// Função para calcular custo de uma quantidade específica
export const calculateIngredientCost = (ingredient: Ingredient, quantity: number): number => {
  const pricePerUsage = getPricePerUsageUnit(ingredient);
  return pricePerUsage * quantity;
};

// Função para calcular peso de uma quantidade específica em gramas
export const calculateIngredientWeight = (ingredient: Ingredient, quantity: number): number => {
  const weightUnits = ['kg', 'g'];
  const volumeUnits = ['ml', 'l'];
  
  const unit = ingredient.usageUnit.toLowerCase();
  const isWeightUnit = weightUnits.includes(unit);
  const isVolumeUnit = volumeUnits.includes(unit);
  
  if (isWeightUnit) {
    // Se a unidade já é de peso, converter para gramas
    if (unit === 'kg') {
      return quantity * 1000; // kg para gramas
    }
    return quantity; // já está em gramas
  } else if (isVolumeUnit) {
    // Se é unidade de volume, usar densidade se disponível
    // @ts-ignore - densityGPerMl pode não estar na interface Ingredient legada
    const density = ingredient.densityGPerMl || 1.0; // Default 1.0 (água)
    
    if (unit === 'l') {
      return quantity * 1000 * density; // L → mL → gramas
    }
    return quantity * density; // mL → gramas
  } else {
    // Se não é unidade de peso nem volume, usar o peso unitário
    return (ingredient.unitWeight || 0) * quantity;
  }
};

// Função para formatar exibição do ingrediente
export const formatIngredientDisplay = (ingredient: Ingredient) => {
  const pricePerUsage = getPricePerUsageUnit(ingredient).toFixed(4);
  return {
    unit: ingredient.usageUnit,
    pricePerUnit: parseFloat(pricePerUsage),
    displayText: `${ingredient.name} (R$ ${pricePerUsage}/${ingredient.usageUnit})`
  };
};