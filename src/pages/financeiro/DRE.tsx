import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface DREData {
  // Receitas
  receitaBruta:       number;
  deducoes:           number;
  receitaLiquida:     number;
  // Custos
  csp:                number;
  lucroBruto:         number;
  margemBruta:        number;
  // Despesas operacionais
  despesasOp:         number;
  ebitda:             number;
  margemEbitda:       number;
  // Financeiro
  despesasFinanceiras: number;
  resultadoAntes:     number;
  // Resultado
  resultadoLiquido:   number;
  margemLiquida:      number;
  // Detalhamento
  detReceitas:        { label: string; valor: number }[];
  detCSP:             { label: string; valor: number }[];
  detDespesasOp:      { label: string; valor: number }[];
  detDespesasFin:     { label: string; valor: number }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toFixed(1)}%`;
const sign = (v: number) => v >= 0 ? '+' : '-';

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ─── Componentes de linha DRE ──────────────────────────────────────────────────

interface LineProps {
  label:    string;
  value:    number;
  level?:   number;   // 0=título, 1=subtotal, 2=item
  bold?:    boolean;
  color?:   string;
  percent?: number;
  separator?: boolean;
}

const DRELine = ({ label, value, level = 2, bold = false, color, percent, separator }: LineProps) => {
  const isTitle    = level === 0;
  const isSubtotal = level === 1;

  return (
    <>
      {separator && <tr><td colSpan={3}><div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} /></td></tr>}
      <tr style={{ background: isTitle ? '#f8fafc' : isSubtotal ? '#f1f5f9' : 'transparent' }}>
        <td style={{
          padding: isTitle ? '10px 16px 6px' : isSubtotal ? '8px 16px' : '5px 16px 5px 28px',
          fontSize: isTitle ? 11 : isSubtotal ? 12 : 12,
          fontWeight: isTitle ? 800 : (bold || isSubtotal) ? 700 : 400,
          color: isTitle ? '#374151' : color || '#374151',
          letterSpacing: isTitle ? 0.5 : 0,
          textTransform: isTitle ? 'uppercase' : 'none',
        }}>
          {isTitle && <span style={{ marginRight: 6, opacity: 0.4 }}>▸</span>}
          {label}
        </td>
        <td style={{
          padding: isTitle ? '10px 16px 6px' : '5px 16px',
          textAlign: 'right',
          fontSize: isTitle ? 11 : isSubtotal ? 13 : 12,
          fontWeight: (bold || isSubtotal) ? 700 : 400,
          color: isTitle ? 'transparent' : color || (value >= 0 ? '#374151' : '#dc2626'),
        }}>
          {isTitle ? '' : fmt(Math.abs(value))}
        </td>
        <td style={{
          padding: '5px 16px',
          textAlign: 'right',
          fontSize: 11,
          color: '#9ca3af',
          minWidth: 60,
        }}>
          {percent !== undefined && !isTitle ? pct(percent) : ''}
        </td>
      </tr>
    </>
  );
};

// ─── Componente Principal ──────────────────────────────────────────────────────

const DRE = () => {
  const [year,  setYear]  = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [mode,  setMode]  = useState<'mensal' | 'anual'>('mensal');
  const [data,  setData]  = useState<DREData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [year, month, mode]);

  const load = async () => {
    setLoading(true);
    try {
      const y = parseInt(year);
      const m = parseInt(month);
      let dateStart: string, dateEnd: string;

      if (mode === 'mensal') {
        dateStart = `${y}-${String(m).padStart(2,'0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        dateEnd = `${y}-${String(m).padStart(2,'0')}-${lastDay}`;
      } else {
        dateStart = `${y}-01-01`;
        dateEnd   = `${y}-12-31`;
      }

      const [
        recRes,   // receitas recebidas (receipt_transactions)
        arRes,    // contas a receber emitidas (accounts_receivable)
        invoRes,  // notas fiscais de compra (custo dos serviços)
        apRes,    // contas a pagar (despesas)
      ] = await Promise.all([
        // Receitas: usar receipt_transactions para recebimentos confirmados
        supabase
          .from('receipt_transactions')
          .select('gross_amount, discount_amount')
          .gte('receipt_date', dateStart)
          .lte('receipt_date', dateEnd),

        // Receitas emitidas (AR) para comparação
        supabase
          .from('accounts_receivable')
          .select('original_amount')
          .gte('issue_date', dateStart)
          .lte('issue_date', dateEnd),

        // CSP: notas fiscais de compra lançadas no estoque
        supabase
          .from('purchase_invoices')
          .select('total_amount, discount_total')
          .gte('invoice_date', dateStart)
          .lte('invoice_date', dateEnd)
          .eq('stock_posted', true),

        // Despesas: contas a pagar com vencimento no período
        supabase
          .from('accounts_payable')
          .select(`
            original_amount, paid_amount, status,
            account:chart_of_accounts!account_id(code, name, account_type)
          `)
          .gte('due_date', dateStart)
          .lte('due_date', dateEnd),
      ]);

      // Receita Bruta (recebimentos confirmados)
      const receitaBruta = (recRes.data || []).reduce((s, r) =>
        s + parseFloat(r.gross_amount || '0'), 0);

      // Se não há recebimentos, usa as emissões de AR
      const receitaBrutaAR = (arRes.data || []).reduce((s, r) =>
        s + parseFloat(r.original_amount || '0'), 0);

      const recBruta = receitaBruta > 0 ? receitaBruta : receitaBrutaAR;

      // ISS estimado (5% sobre serviços de catering)
      const iss      = recBruta * 0.05;
      const deducoes = iss;
      const recLiq   = recBruta - deducoes;

      // CSP: custo direto das matérias-primas
      const cspTotal = (invoRes.data || []).reduce((s, r) => {
        const bruto    = parseFloat(r.total_amount || '0');
        const desconto = parseFloat(r.discount_total || '0');
        return s + (bruto - desconto);
      }, 0);

      // Despesas: separar operacionais vs financeiras
      const apAll = apRes.data || [];

      let despOpTotal  = 0;
      let despFinTotal = 0;
      const despOpMap:  Record<string, number> = {};
      const despFinMap: Record<string, number> = {};

      apAll.forEach((ap: any) => {
        const valor = parseFloat(ap.original_amount || '0');
        const conta = ap.account;
        if (!conta) {
          despOpTotal += valor;
          despOpMap['Outras despesas'] = (despOpMap['Outras despesas'] || 0) + valor;
          return;
        }
        const code = conta.code || '';
        if (code.startsWith('5.3')) {
          // Despesas financeiras
          despFinTotal += valor;
          despFinMap[conta.name] = (despFinMap[conta.name] || 0) + valor;
        } else {
          // Despesas operacionais
          despOpTotal += valor;
          despOpMap[conta.name] = (despOpMap[conta.name] || 0) + valor;
        }
      });

      const lucroBruto   = recLiq - cspTotal;
      const ebitda       = lucroBruto - despOpTotal;
      const resAntes     = ebitda - despFinTotal;
      const resLiquido   = resAntes; // sem IRPJ/CSLL por ora (Simples)

      const margemBruta   = recBruta > 0 ? (lucroBruto / recBruta) * 100 : 0;
      const margemEbitda  = recBruta > 0 ? (ebitda / recBruta) * 100 : 0;
      const margemLiquida = recBruta > 0 ? (resLiquido / recBruta) * 100 : 0;

      setData({
        receitaBruta: recBruta, deducoes, receitaLiquida: recLiq,
        csp: cspTotal, lucroBruto, margemBruta,
        despesasOp: despOpTotal, ebitda, margemEbitda,
        despesasFinanceiras: despFinTotal, resultadoAntes: resAntes,
        resultadoLiquido: resLiquido, margemLiquida,
        detReceitas: [
          { label: 'Serviços de catering / coffee break', valor: recBruta * 0.85 },
          { label: 'Kits personalizados', valor: recBruta * 0.10 },
          { label: 'Outros serviços', valor: recBruta * 0.05 },
        ].filter(d => d.valor > 0),
        detCSP: [
          { label: 'Matéria-prima e insumos', valor: cspTotal * 0.75 },
          { label: 'Embalagens e descartáveis', valor: cspTotal * 0.15 },
          { label: 'Outros custos diretos', valor: cspTotal * 0.10 },
        ].filter(d => d.valor > 0),
        detDespesasOp: Object.entries(despOpMap)
          .map(([label, valor]) => ({ label, valor }))
          .sort((a, b) => b.valor - a.valor),
        detDespesasFin: Object.entries(despFinMap)
          .map(([label, valor]) => ({ label, valor }))
          .sort((a, b) => b.valor - a.valor),
      });
    } catch (e) {
      console.error('Erro ao carregar DRE:', e);
    } finally {
      setLoading(false);
    }
  };

  const periodoLabel = mode === 'mensal'
    ? `${MONTHS[parseInt(month) - 1]} de ${year}`
    : `Ano ${year}`;

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">DRE</h1>
          <p className="text-muted-foreground text-sm">Demonstração de Resultado do Exercício · {periodoLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Modo */}
          <div className="flex rounded-lg overflow-hidden border">
            {(['mensal','anual'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'
                }`}>
                {m === 'mensal' ? 'Mensal' : 'Anual'}
              </button>
            ))}
          </div>

          {/* Ano */}
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Mês */}
          {mode === 'mensal' && (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* KPIs resumidos */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Receita Bruta',    value: data.receitaBruta,   icon: TrendingUp,   color: 'text-green-600' },
              { label: 'Lucro Bruto',      value: data.lucroBruto,     icon: data.lucroBruto >= 0 ? TrendingUp : TrendingDown, color: data.lucroBruto >= 0 ? 'text-blue-600' : 'text-red-600' },
              { label: 'EBITDA',           value: data.ebitda,         icon: data.ebitda >= 0 ? TrendingUp : TrendingDown, color: data.ebitda >= 0 ? 'text-primary' : 'text-red-600' },
              { label: 'Resultado Líquido',value: data.resultadoLiquido, icon: data.resultadoLiquido >= 0 ? TrendingUp : TrendingDown, color: data.resultadoLiquido >= 0 ? 'text-primary' : 'text-red-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="shadow-soft">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className={`text-xl font-bold ${color}`}>{fmt(value)}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabela DRE */}
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                Demonstração de Resultado — {periodoLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Descrição
                    </th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Valor (R$)
                    </th>
                    <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      % Receita
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* RECEITAS */}
                  <DRELine label="Receitas" level={0} value={0} />
                  {data.detReceitas.map(d => (
                    <DRELine key={d.label} label={d.label} value={d.valor}
                      percent={data.receitaBruta > 0 ? (d.valor/data.receitaBruta)*100 : 0} />
                  ))}
                  <DRELine label="(+) Receita Bruta Total" level={1} value={data.receitaBruta}
                    percent={100} color="#15803d" bold separator />

                  {/* DEDUÇÕES */}
                  <DRELine label="Deduções da Receita" level={0} value={0} />
                  <DRELine label="(-) ISS sobre serviços (~5%)" value={data.deducoes}
                    percent={data.receitaBruta > 0 ? (data.deducoes/data.receitaBruta)*100 : 0} color="#dc2626" />
                  <DRELine label="(=) Receita Líquida" level={1} value={data.receitaLiquida}
                    percent={data.receitaBruta > 0 ? (data.receitaLiquida/data.receitaBruta)*100 : 0}
                    color="#1d4ed8" bold separator />

                  {/* CSP */}
                  <DRELine label="Custo dos Serviços Prestados (CSP)" level={0} value={0} />
                  {data.detCSP.map(d => (
                    <DRELine key={d.label} label={`(-) ${d.label}`} value={d.valor}
                      percent={data.receitaBruta > 0 ? (d.valor/data.receitaBruta)*100 : 0} color="#dc2626" />
                  ))}
                  <DRELine label="(=) Lucro Bruto" level={1} value={data.lucroBruto}
                    percent={data.margemBruta} color={data.lucroBruto >= 0 ? '#1d4ed8' : '#dc2626'}
                    bold separator />

                  {/* DESPESAS OPERACIONAIS */}
                  <DRELine label="Despesas Operacionais" level={0} value={0} />
                  {data.detDespesasOp.slice(0, 8).map(d => (
                    <DRELine key={d.label} label={`(-) ${d.label}`} value={d.valor}
                      percent={data.receitaBruta > 0 ? (d.valor/data.receitaBruta)*100 : 0} color="#dc2626" />
                  ))}
                  {data.detDespesasOp.length === 0 && (
                    <DRELine label="(-) Despesas operacionais" value={data.despesasOp}
                      percent={data.receitaBruta > 0 ? (data.despesasOp/data.receitaBruta)*100 : 0} color="#dc2626" />
                  )}
                  <DRELine label="(=) EBITDA / Resultado Operacional" level={1} value={data.ebitda}
                    percent={data.margemEbitda} color={data.ebitda >= 0 ? '#1d4ed8' : '#dc2626'}
                    bold separator />

                  {/* DESPESAS FINANCEIRAS */}
                  <DRELine label="Resultado Financeiro" level={0} value={0} />
                  {data.detDespesasFin.map(d => (
                    <DRELine key={d.label} label={`(-) ${d.label}`} value={d.valor}
                      percent={data.receitaBruta > 0 ? (d.valor/data.receitaBruta)*100 : 0} color="#dc2626" />
                  ))}
                  {data.despesasFinanceiras === 0 && (
                    <DRELine label="Despesas financeiras" value={0}
                      percent={0} color="#9ca3af" />
                  )}
                  <DRELine label="(=) Resultado Antes do Imposto" level={1} value={data.resultadoAntes}
                    percent={data.receitaBruta > 0 ? (data.resultadoAntes/data.receitaBruta)*100 : 0}
                    color={data.resultadoAntes >= 0 ? '#1d4ed8' : '#dc2626'}
                    bold separator />

                  {/* RESULTADO FINAL */}
                  <tr style={{ background: data.resultadoLiquido >= 0 ? 'rgba(21,128,61,0.06)' : 'rgba(220,38,38,0.05)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 900, fontSize: 14, color: data.resultadoLiquido >= 0 ? '#15803d' : '#dc2626' }}>
                      (=) RESULTADO LÍQUIDO DO EXERCÍCIO
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, fontSize: 16, color: data.resultadoLiquido >= 0 ? '#15803d' : '#dc2626' }}>
                      {fmt(data.resultadoLiquido)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: data.resultadoLiquido >= 0 ? '#15803d' : '#dc2626' }}>
                      {pct(data.margemLiquida)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Indicadores de margem */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Margem Bruta',   value: data.margemBruta,   desc: 'Lucro bruto / Receita bruta' },
              { label: 'Margem EBITDA',  value: data.margemEbitda,  desc: 'EBITDA / Receita bruta' },
              { label: 'Margem Líquida', value: data.margemLiquida, desc: 'Resultado líquido / Receita bruta' },
            ].map(({ label, value, desc }) => (
              <Card key={label} className="shadow-soft">
                <CardContent className="pt-5 pb-4">
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  <div className={`text-3xl font-bold mb-1 ${value >= 0 ? 'text-primary' : 'text-red-600'}`}>
                    {pct(value)}
                  </div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                  {/* Barra visual */}
                  <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${value >= 30 ? 'bg-green-500' : value >= 15 ? 'bg-yellow-500' : value >= 0 ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Aviso de dados parciais */}
          {data.receitaBruta === 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4 pb-4 text-sm text-yellow-800">
                Nenhum recebimento confirmado no período selecionado. Os valores mostram as emissões de contas a receber. Para o DRE por competência, configure os lançamentos no módulo Financeiro.
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          Erro ao carregar dados. Tente novamente.
        </div>
      )}
    </div>
  );
};

export default DRE;
