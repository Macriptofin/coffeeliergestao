// Compartilhado entre os dois pontos do funil de faturamento:
// ProposalBillingCard (lote de contrato) e ClientBillingManager (lote
// consolidado por cliente, Financeiro → Contas a Receber).

export const BILLING_STATUS_META: Record<string, { label: string; cls: string }> = {
  preparada:            { label: 'Pré-fatura',            cls: 'bg-muted text-muted-foreground' },
  aguardando_aprovacao: { label: 'Aguardando aprovação',  cls: 'bg-amber-100 text-amber-700' },
  aprovada_faturamento: { label: 'Aprovada — emitir NF',  cls: 'bg-blue-100 text-blue-700' },
  faturada:             { label: 'NF emitida',            cls: 'bg-blue-100 text-blue-700' },
  lancada:              { label: 'Lançada no cliente',    cls: 'bg-emerald-100 text-emerald-700' },
  reprovada:            { label: 'Reprovada',             cls: 'bg-red-100 text-red-700' },
  cancelada:            { label: 'Cancelada',             cls: 'bg-muted text-muted-foreground' },
};

// KQ15 (regra de pagamento da CMPC): fecha a quinzena da data de lançamento
// e soma 15 dias.
export function suggestDueKQ15(postedISO: string): string {
  const d = new Date(postedISO + 'T12:00:00');
  const day = d.getDate();
  const quinzenaEnd = day <= 15
    ? new Date(d.getFullYear(), d.getMonth(), 15, 12)
    : new Date(d.getFullYear(), d.getMonth() + 1, 0, 12); // último dia do mês
  quinzenaEnd.setDate(quinzenaEnd.getDate() + 15);
  return quinzenaEnd.toISOString().slice(0, 10);
}
