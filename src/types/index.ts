// Legacy Ingredient interface - use Material from Materials page instead
export interface Ingredient {
  id: string;
  name: string;
  purchaseUnit: string; // Unidade de compra (ex: kg, pacote)
  usageUnit: string; // Unidade de uso nas receitas (ex: g, mL)
  conversionFactor: number; // Fator de conversão (ex: 1 kg = 1000g)
  pricePerPurchaseUnit: number; // Preço por unidade de compra
  supplier?: string;
  unitWeight?: number; // Peso em gramas quando a unidade não é de peso
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

// Material interface for new hierarchical category system
export interface Material {
  id: string;
  name: string;
  description?: string;
  purchaseUnit: string;
  usageUnit: string;
  conversionFactor: number;
  pricePerPurchaseUnit: number;
  supplier?: string;
  allowedBrands?: string[];
  category: string;
  subcategory?: string; // New hierarchical subcategory
  typeTermId?: string; // Reference to material_type taxonomy term
  categoryTermId?: string; // Reference to material_category taxonomy term
  subcategoryTermId?: string; // Reference to material_subcategory taxonomy term
  code: string;
  materialType: 'ingredient' | 'packaging' | 'intermediate_product' | 'finished_product' | 'composite_product' | 'resale_product' | 'equipment' | 'supply';
  unitWeight?: number;
  isSellable?: boolean;
  costSource?: 'purchase' | 'production' | 'manual';
  manualPrice?: boolean;
  currentQuantity?: number;
  minimumQuantity?: number;
  // Campos fiscais
  ncm?: string;
  cfop?: string;
  cst?: string;
  origem?: number; // 0=Nacional, 1=Estrangeira direta, 2=Estrangeira mercado interno
  // Controle de estoque
  tracksInventory?: boolean; // false = não gera movimentação de estoque na NF (ex: combustível, descartáveis)
  // Restrições & características (tags do tipo material_restriction, via material_tags)
  restrictionTagIds?: string[];
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
  yieldUnit?: string; // Unidade de medida do rendimento
  totalCost?: number;
  totalWeight?: number; // Peso total em gramas
  suggestedPrice?: number;
  profitMargin?: number;
}