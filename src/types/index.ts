// Legacy Ingredient interface - use Material from Materials page instead
export interface Ingredient {
  id: string;
  name: string;
  purchaseUnit: string; // Unidade de compra (ex: kg, pacote)
  usageUnit: string; // Unidade de uso nas receitas (ex: g, mL)
  conversionFactor: number; // Fator de conversão (ex: 1 kg = 1000g)
  pricePerPurchaseUnit: number; // Preço por unidade de compra
  supplier?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  preparationTime: number;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  yield: number;
  totalCost?: number;
  suggestedPrice?: number;
  profitMargin?: number;
}