// Esquema de cores harmonizado para categorias e subcategorias
// Baseado em verde oliva com variações tonais

export const categoryColorScheme = {
  'Insumo': {
    primary: 'bg-green-100 text-green-800 border-green-200',
    secondary: 'bg-green-50 text-green-700 border-green-100',
    icon: 'text-green-600'
  },
  'Embalagem': {
    primary: 'bg-blue-100 text-blue-800 border-blue-200',
    secondary: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: 'text-blue-600'
  },
  'Produto Acabado': {
    primary: 'bg-purple-100 text-purple-800 border-purple-200',
    secondary: 'bg-purple-50 text-purple-700 border-purple-100',
    icon: 'text-purple-600'
  },
  'Produto Composto': {
    primary: 'bg-orange-100 text-orange-800 border-orange-200',
    secondary: 'bg-orange-50 text-orange-700 border-orange-100',
    icon: 'text-orange-600'
  },
  'Produto Intermediário': {
    primary: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    secondary: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    icon: 'text-indigo-600'
  }
} as const;

export const getCategoryStyles = (category: string, type: 'primary' | 'secondary' = 'primary') => {
  return categoryColorScheme[category as keyof typeof categoryColorScheme]?.[type] || 
         categoryColorScheme['Insumo'][type];
};

export const getCategoryIconStyle = (category: string) => {
  return categoryColorScheme[category as keyof typeof categoryColorScheme]?.icon || 
         categoryColorScheme['Insumo'].icon;
};