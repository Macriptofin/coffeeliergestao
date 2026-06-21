// Linguagem ÚNICA de unidades de medida do sistema.
// Use SEMPRE esta lista nos seletores de unidade (compra, uso, ficha técnica, BOM, rendimento).
// 'un' é a unidade contável padrão (nunca 'unidade'). Mantém consistência com o banco.
export const MEASUREMENT_UNITS = [
  'un', 'g', 'kg', 'mg', 'mL', 'L', 'pacote', 'caixa', 'fardo', 'bandeja', 'saco', 'lata', 'dúzia', 'm',
] as const;

export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];
