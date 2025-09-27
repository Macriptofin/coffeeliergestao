// Estrutura hierárquica de categorias de materiais
// Baseada na proposta de reestruturação para expansão da operação

export interface CategoryStructure {
  label: string;
  value: string;
  color: string;
  icon: string;
  description: string;
  subcategories?: SubcategoryStructure[];
}

export interface SubcategoryStructure {
  label: string;
  value: string;
  description: string;
}

export const materialCategories: CategoryStructure[] = [
  {
    label: "Insumos",
    value: "Insumo",
    color: "blue",
    icon: "Package",
    description: "Ingredientes básicos para produção",
    subcategories: [
      { label: "Grãos & Cereais", value: "graos_cereais", description: "Farinhas, aveia, quinoa, arroz, etc." },
      { label: "Laticínios", value: "laticinios", description: "Leite, queijos, creme de leite, manteiga, etc." },
      { label: "Carnes & Proteínas", value: "carnes_proteinas", description: "Carnes, peixes, ovos, proteínas vegetais, etc." },
      { label: "Hortifruti", value: "hortifruti", description: "Frutas, legumes, verduras frescas e congeladas" },
      { label: "Condimentos & Temperos", value: "condimentos_temperos", description: "Sal, pimenta, ervas, especiarias, etc." },
      { label: "Açúcares & Adoçantes", value: "acucares_adocantes", description: "Açúcar refinado, cristal, mel, adoçantes, etc." },
      { label: "Óleos & Gorduras", value: "oleos_gorduras", description: "Óleo vegetal, azeite, margarina, banha, etc." },
      { label: "Conservas & Enlatados", value: "conservas_enlatados", description: "Molhos industrializados, conservas, enlatados" },
      { label: "Bebidas & Líquidos", value: "bebidas_liquidos", description: "Sucos, vinhos para cozinha, caldos, etc." }
    ]
  },
  {
    label: "Embalagens",
    value: "Embalagem",
    color: "green",
    icon: "Package",
    description: "Materiais de embalagem e apresentação",
    subcategories: [
      { label: "Primárias", value: "primarias", description: "Contato direto com alimento (filme, papel contact, potes)" },
      { label: "Secundárias", value: "secundarias", description: "Caixas, sacolas, kits de transporte" },
      { label: "Apresentação", value: "apresentacao", description: "Tags, fitas, decoração, elementos visuais" }
    ]
  },
  {
    label: "Produtos Intermediários",
    value: "Produto Intermediário",
    color: "amber",
    icon: "Tag",
    description: "Receitas-base reutilizáveis",
    subcategories: [
      { label: "Massas & Bases", value: "massas_bases", description: "Massas de bolo, torta, pizza, pães base" },
      { label: "Recheios & Coberturas", value: "recheios_coberturas", description: "Brigadeiros, geleias, cremes, glacês" },
      { label: "Caldas & Molhos", value: "caldas_molhos", description: "Caldas de açúcar, molhos doces e salgados" }
    ]
  },
  {
    label: "Produtos Acabados",
    value: "Produto Acabado",
    color: "purple",
    icon: "Tag",
    description: "Produtos finais prontos para venda"
    // Sem subcategorias no primeiro momento
  },
  {
    label: "Produtos Compostos",
    value: "Produto Composto",
    color: "orange",
    icon: "Tag",
    description: "Produtos feitos com outros materiais"
    // Sem subcategorias no primeiro momento
  },
  {
    label: "Equipamentos & Utensílios",
    value: "Equipamentos & Utensílios",
    color: "slate",
    icon: "Wrench",
    description: "Ferramentas e equipamentos de trabalho",
    subcategories: [
      { label: "Equipamentos", value: "equipamentos", description: "Fornos, freezers, garrafas térmicas, batedeiras" },
      { label: "Utensílios", value: "utensilios", description: "Facas, colheres, formas, pegadores, peneiras" },
      { label: "Têxteis & Apoios", value: "texteis_apoios", description: "Toalhas, aventais, mantas térmicas, panos" }
    ]
  },
  {
    label: "Infraestrutura & Eventos",
    value: "Infraestrutura & Eventos",
    color: "emerald",
    icon: "Building",
    description: "Materiais para montagem e estrutura de eventos",
    subcategories: [
      { label: "Móveis & Estruturas", value: "moveis_estruturas", description: "Mesas, estantes, suportes, tendas" },
      { label: "Itens de Montagem", value: "itens_montagem", description: "Bandejas, displays, totens, decoração" },
      { label: "Utilidades Operacionais", value: "utilidades_operacionais", description: "Caixas térmicas, carrinhos, extensões, organizadores" }
    ]
  }
];

// Função para obter categoria por valor
export const getCategoryByValue = (value: string): CategoryStructure | undefined => {
  return materialCategories.find(cat => cat.value === value);
};

// Função para obter subcategoria por valor dentro de uma categoria
export const getSubcategoryByValue = (categoryValue: string, subcategoryValue: string): SubcategoryStructure | undefined => {
  const category = getCategoryByValue(categoryValue);
  return category?.subcategories?.find(sub => sub.value === subcategoryValue);
};

// Função para obter todas as subcategorias de uma categoria
export const getSubcategoriesByCategory = (categoryValue: string): SubcategoryStructure[] => {
  const category = getCategoryByValue(categoryValue);
  return category?.subcategories || [];
};

// Função para obter lista plana de todas as categorias (para compatibilidade)
export const getFlatCategories = () => {
  return materialCategories.map(cat => ({
    value: cat.value,
    label: cat.label,
    color: cat.color
  }));
};

// Função para validar se uma combinação categoria/subcategoria é válida
export const isValidCategorySubcategory = (category: string, subcategory?: string): boolean => {
  const cat = getCategoryByValue(category);
  if (!cat) return false;
  
  if (!subcategory) return true; // Categoria sem subcategoria é válida
  
  if (!cat.subcategories) return false; // Categoria não suporta subcategorias
  
  return cat.subcategories.some(sub => sub.value === subcategory);
};