export const formatCurrency = (value: number | null | undefined): string =>
  value == null ? 'R$ 0,00' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatPercent = (frac: number | null | undefined, digits = 1): string =>
  frac == null ? '—' : `${(Number(frac) * 100).toFixed(digits)}%`;
