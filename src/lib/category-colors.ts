// Esquema de cores harmonizado para categorias e subcategorias
// Baseado em verde oliva sutil da paleta Coffeelier

export const categoryColorScheme = {
  'Insumo': {
    primary: 'bg-primary/5 text-primary border-primary/10',
    secondary: 'bg-primary/3 text-primary/80 border-primary/5',
    icon: 'text-primary/70'
  },
  'Embalagem': {
    primary: 'bg-accent-coffee/8 text-accent-coffee border-accent-coffee/15',
    secondary: 'bg-accent-coffee/4 text-accent-coffee/80 border-accent-coffee/8',
    icon: 'text-accent-coffee/70'
  },
  'Produto Acabado': {
    primary: 'bg-secondary/8 text-secondary border-secondary/15',
    secondary: 'bg-secondary/4 text-secondary/80 border-secondary/8',
    icon: 'text-secondary/70'
  },
  'Produto Composto': {
    primary: 'bg-accent-mocca/8 text-accent-mocca-foreground border-accent-mocca/15',
    secondary: 'bg-accent-mocca/4 text-accent-mocca-foreground/80 border-accent-mocca/8',
    icon: 'text-accent-mocca-foreground/70'
  },
  'Produto Intermediário': {
    primary: 'bg-primary/6 text-primary border-primary/12',
    secondary: 'bg-primary/3 text-primary/80 border-primary/6',
    icon: 'text-primary/60'
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