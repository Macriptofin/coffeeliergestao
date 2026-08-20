import { forwardRef } from 'react';
import { formatLocalDate, todayLocalISO } from '@/lib/date-utils';
import { ProposalData, Composition } from '@/lib/proposalPdfViewModel';

// ─── Paleta oficial Coffeelier (MIV) ─────────────────────────────────────────
const C = {
  oliva:    '#626432',
  cafe:     '#552D19',
  creme:    '#FCE8D0',
  text:     '#2C1810',
  textMuted:'#6B4226',
  olive10:  'rgba(98,100,50,0.08)',
  olive25:  'rgba(98,100,50,0.25)',
  olive20:  'rgba(98,100,50,0.20)',
  cremedark:'rgba(252,232,208,0.7)',
  cremedim: 'rgba(252,232,208,0.15)',
  white:    'rgba(255,255,255,0.08)',
};

// Fallback só pra cliente sem condição própria cadastrada (legado) — todo
// cliente novo já nasce com essa condição padrão em ClientForm.tsx, editável
// caso a caso (ex.: CMPC tem a própria condição, "KQ15 — fora quinzena + 15 dias").
const DEFAULT_PAYMENT_TERMS = '50% de sinal para reserva da data + 50% de saldo até o último dia útil antes do evento';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const todayStr = () => todayLocalISO();
// Data curta DD/MM via helper do projeto (evita offset de timezone)
const fmtDateShort = (d: string | null) => (d ? formatLocalDate(d, 'dd/MM') : '');
// Horário HH:MM (campo time chega como "HH:MM:SS")
const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : '');
// Junção natural em português: "A", "A e B", "A, B e C" — usado na descrição
// consolidada do serviço quando a proposta tem mais de um tipo de momento.
const joinPt = (items: string[]) => {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const PageHeader = ({ num, proposal }: { num: string; proposal: ProposalData }) => (
  <>
    <div style={{
      background: C.oliva, padding: '14px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div
        role="img"
        aria-label="Coffeelier"
        // Único arquivo de logo disponível é a versão oliva (mesma cor do fundo
        // desta barra) — sem isso, fica só um contorno quase invisível. Em vez de
        // inverter pra branco puro (destoa da paleta), usamos o PNG como máscara
        // e pintamos com a cor creme da marca — mesmo tom do texto desta barra.
        style={{
          height: 36, aspectRatio: '1920 / 367', backgroundColor: C.creme,
          WebkitMaskImage: 'url(/logo-coffeelier.png)', WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'left center',
          maskImage: 'url(/logo-coffeelier.png)', maskSize: 'contain',
          maskRepeat: 'no-repeat', maskPosition: 'left center',
        } as React.CSSProperties}
      />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 7, letterSpacing: 2, color: C.cremedark, textTransform: 'uppercase', marginBottom: 2 }}>
          Proposta Comercial
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.creme, lineHeight: 1 }}>
          {proposal.proposal_number}
          {proposal.revision > 1 && (
            <span style={{ fontSize: 10, fontWeight: 700 }}> · Revisão {proposal.revision}</span>
          )}
        </div>
        <div style={{ fontSize: 7, color: C.cremedark, marginTop: 2 }}>
          {fmtDate(todayStr())}
        </div>
      </div>
    </div>
    <div style={{ height: 2, background: C.oliva, opacity: 0.2 }} />
  </>
);

const PageFooter = ({ pageNum }: { pageNum: string }) => (
  <div style={{
    background: C.oliva, padding: '5px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }}>
    <span style={{ fontSize: 7, color: C.cremedark, fontStyle: 'italic' }}>
      Cada detalhe importa, porque nos importa o que você sente quando percebe.
    </span>
    <span style={{ fontSize: 7, color: C.cremedark }}>{pageNum}</span>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 7, fontWeight: 800, letterSpacing: 1.5,
    textTransform: 'uppercase', color: C.oliva,
    borderBottom: `1px solid ${C.olive25}`,
    paddingBottom: 4, marginBottom: 8,
  }}>
    {children}
  </div>
);

interface Props {
  proposal: ProposalData;
  compositions: Composition[];
  // Código de Serviço padrão da empresa (config vendas.fiscal_service_code) —
  // cada momento pode ter o próprio override (raro, ex.: kit vendido como produto).
  defaultServiceCode?: string;
}

// Conteúdo impresso (2 páginas A4) — sem toolbar, sem fetch. Usado tanto pelo
// gerador interno (Vendas) quanto pelo do Portal, cada um com sua própria busca
// de dados e seu próprio botão/useReactToPrint em volta.
export const ProposalPDFDocument = forwardRef<HTMLDivElement, Props>(({ proposal, compositions, defaultServiceCode }, ref) => {
  const numPeople = proposal.number_of_people || 1;
  const billableCompositions = compositions.filter(c => c.id !== '__legacy__' && c.number_of_people > 0);

  // Guarda-chuva (contrato recorrente): o Orçamento vira quantidade contratada ×
  // preço unitário (campo de referência, caindo pro preço/pessoa da composição-
  // molde — mesma cadeia de fallback de add_umbrella_execution no banco).
  const umbrellaUnitPrice = proposal.is_umbrella
    ? (proposal.umbrella_quota_unit_price ?? billableCompositions[0]?.price_per_person ?? 0)
    : 0;
  const isUmbrellaBudget = proposal.is_umbrella
    && (proposal.umbrella_quota_quantity ?? 0) > 0
    && umbrellaUnitPrice > 0;
  const budgetQty   = isUmbrellaBudget ? proposal.umbrella_quota_quantity! : 1;
  const budgetUnit  = isUmbrellaBudget ? umbrellaUnitPrice : proposal.total_amount;
  const budgetTotal = isUmbrellaBudget ? budgetQty * umbrellaUnitPrice : proposal.total_amount;

  // Descrição comercial padrão do serviço (linha da tabela de Orçamento) — segue
  // literalmente o padrão real já usado na emissão de NFS-e da Coffeelier (ex.:
  // "Prestação de serviço de alimentação (Coffee break secretaria do esporte
  // 17/07), incluindo fornecimento de alimentos, logística e atendimento."):
  // parênteses com tipo(s) + nome do evento + data(s) curta(s) (DD/MM, sem ano —
  // mesmo formato da NFS-e), fechando sempre com o mesmo texto fixo. Uma fórmula
  // só cobre único momento e multimomentos (a lista de tipos já resolve os dois
  // casos) — pensada pra ser copiada direto pro campo "Descrição do Serviço" da
  // NFS-e/pedido de compra do cliente, sem depender do parágrafo acima da tabela.
  const buildServiceDescription = () => {
    // Contrato recorrente: sem data única — descreve o fornecimento sob demanda.
    if (proposal.is_umbrella) {
      const paren = proposal.event_name ? ` (${proposal.event_name})` : '';
      return `Prestação recorrente de serviço de alimentação${paren}, fornecida sob demanda dentro da cota contratada, incluindo fornecimento de alimentos, logística e atendimento.`;
    }
    const types = Array.from(new Set(
      billableCompositions.map(c => c.event_category || c.name).filter(Boolean)
    ));
    const dates = Array.from(new Set(
      billableCompositions.map(c => c.scheduled_date).filter((d): d is string => !!d)
    )).sort();
    const dateLabel = dates.length === 0 ? ''
      : dates.length === 1 ? fmtDateShort(dates[0])
      : `${fmtDateShort(dates[0])} a ${fmtDateShort(dates[dates.length - 1])}`;

    const parenParts = [joinPt(types), proposal.event_name, dateLabel].filter(Boolean);
    const paren = parenParts.length > 0 ? ` (${parenParts.join(' ')})` : '';
    return `Prestação de serviço de alimentação${paren}, incluindo fornecimento de alimentos, logística e atendimento.`;
  };

  // ── Estilos de página ─────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    width: '210mm',
    minHeight: '297mm',
    background: C.creme,
    fontFamily: 'Arial, Helvetica, sans-serif',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    pageBreakAfter: 'always',
  };

  const bodyPad: React.CSSProperties = {
    padding: '16px 20px',
    flex: 1,
  };

  // ── Seções: grade adaptativa (por composição) ────────────────────────────
  const sectionCols = (n: number) =>
    n <= 2 ? '1fr 1fr' : n === 3 ? '1fr 1fr 1fr' : '1fr 1fr';

  return (
    <div ref={ref}>
      {/* @page injetado no conteúdo impresso → remove cabeçalho/rodapé do navegador
          (data, título e URL) de forma confiável. */}
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════════
          PÁG. 1 — Cliente · Evento · Composição
      ════════════════════════════════════════════ */}
      <div style={page}>
        <PageHeader num="1/2" proposal={proposal} />

        <div style={bodyPad}>

          {/* Cliente */}
          <div style={{ marginBottom: 14 }}>
            <SectionTitle>Cliente</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginBottom: 1 }}>Empresa</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{proposal.client_name}</div>
                {proposal.cnpj_cpf && <div style={{ fontSize: 8, color: C.textMuted }}>{proposal.cnpj_cpf}</div>}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginBottom: 1 }}>Contato</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{proposal.contact_name || '—'}</div>
                {proposal.contact_phone && <div style={{ fontSize: 8, color: C.textMuted }}>{proposal.contact_phone}</div>}
                {proposal.contact_email && <div style={{ fontSize: 7, color: C.textMuted }}>{proposal.contact_email}</div>}
              </div>
              {proposal.department_name && (
                <div>
                  <div style={{ fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginBottom: 1 }}>Departamento</div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>{proposal.department_name}</div>
                </div>
              )}
              {(proposal.unit_name || proposal.room_name) && (
                <div>
                  <div style={{ fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginBottom: 1 }}>Local</div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>
                    {[proposal.room_name, proposal.unit_name].filter(Boolean).join(' — ')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evento */}
          <div style={{ marginBottom: 14 }}>
            <SectionTitle>Evento</SectionTitle>
            <div style={{
              background: C.oliva, borderRadius: 6, padding: '10px 14px',
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            }}>
              {[
                { label: 'Evento',            value: proposal.event_name || '—' },
                { label: 'Data',               value: fmtDate(proposal.event_date) },
                { label: 'Pessoas Atendidas',  value: String(numPeople) },
                { label: 'Local',              value: proposal.unit_name || '—' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 6, letterSpacing: 0.8, color: C.cremedark, textTransform: 'uppercase', marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: C.creme, lineHeight: 1.2 }}>{f.value}</div>
                </div>
              ))}
            </div>
            {compositions.length > 1 && (
              <div style={{ fontSize: 6.5, color: C.textMuted, fontStyle: 'italic', marginTop: 4 }}>
                * Pessoas atendidas: somatório de pessoas de todos os momentos (não é a capacidade do evento).
              </div>
            )}
          </div>

          {/* Composição — agrupada por momento (composição) → seção → itens */}
          <div style={{ marginBottom: 12 }}>
            <SectionTitle>Composições</SectionTitle>

            {compositions.length === 0 && (
              <div style={{ fontSize: 8, color: C.textMuted, fontStyle: 'italic' }}>
                A compor
              </div>
            )}

            {compositions.map((comp, ci) => {
              // Linha-cabeçalho do momento: tipo · DD/MM · HH:MM · sala/local · nº pessoas
              const meta = [
                comp.event_category || '',
                fmtDateShort(comp.scheduled_date),
                fmtTime(comp.scheduled_time),
                [comp.room_name, comp.location].filter(Boolean).join(' — '),
                comp.number_of_people > 0 ? `${comp.number_of_people} pessoas` : '',
              ].filter(Boolean).join(' · ');
              // Consumo por pessoa do momento: comida (g) e bebida (mL).
              const cp = comp.number_of_people > 0 ? comp.number_of_people : 1;
              let foodG = 0, bevMl = 0;
              comp.sections.forEach(sec => sec.items.forEach(it => {
                const perPerson = it.qty_per_person > 0 ? it.qty_per_person : (it.fixed_qty / cp);
                if (it.is_beverage) bevMl += perPerson * it.unit_weight;
                else                foodG += perPerson * it.unit_weight;
              }));
              const consumo = [
                foodG > 0 ? `${Math.round(foodG)} g de comida/pessoa` : '',
                bevMl > 0 ? `${Math.round(bevMl)} mL de bebida/pessoa` : '',
              ].filter(Boolean).join(' · ');
              const showMomentHeader = !!comp.name || !!meta || comp.price_per_person > 0;

              return (
                <div key={comp.id} style={{ marginBottom: ci < compositions.length - 1 ? 12 : 0 }}>
                  {showMomentHeader && (
                    <div style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      gap: 8, marginBottom: 6,
                      borderLeft: `3px solid ${C.oliva}`, paddingLeft: 8,
                    }}>
                      <div>
                        {comp.id !== '__legacy__' && (
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.oliva, lineHeight: 1.2 }}>
                            {`Momento ${ci + 1}`}
                          </div>
                        )}
                        {meta && (
                          <div style={{ fontSize: 7.5, color: C.textMuted, marginTop: 1 }}>
                            {meta}
                          </div>
                        )}
                        {consumo && (
                          <div style={{ fontSize: 7.5, color: C.oliva, marginTop: 1, fontWeight: 600 }}>
                            {consumo}
                          </div>
                        )}
                      </div>
                      {comp.price_per_person > 0 && (
                        <div style={{ fontSize: 8.5, fontWeight: 700, color: C.oliva, whiteSpace: 'nowrap' }}>
                          {fmtMoney(comp.price_per_person)} por pessoa
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: sectionCols(comp.sections.length), gap: 6 }}>
                    {comp.sections.map(sec => (
                      <div key={sec.label} style={{ background: C.oliva, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{
                          background: 'rgba(0,0,0,0.22)', padding: '5px 10px',
                          fontSize: 7, fontWeight: 800, color: C.cremedark,
                          textTransform: 'uppercase', letterSpacing: 0.8,
                        }}>
                          {sec.label}
                        </div>
                        <div style={{ padding: '6px 10px' }}>
                          {sec.items.map((it, i) => {
                            const qty  = it.qty_per_person > 0 ? it.qty_per_person : it.fixed_qty;
                            const label = it.qty_per_person > 0 ? `${qty} ${it.unit}/pp` : `${qty} ${it.unit}`;
                            return (
                              <div key={i} style={{
                                fontSize: 8, color: 'rgba(252,232,208,0.85)',
                                padding: '2px 0',
                                borderBottom: i < sec.items.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
                                display: 'flex', justifyContent: 'space-between',
                              }}>
                                <span>{it.name}</span>
                                <span style={{ opacity: 0.55, fontSize: 7, marginLeft: 4 }}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nota */}
          <div style={{
            fontSize: 7.5, color: C.textMuted, fontStyle: 'italic',
            borderLeft: `2px solid ${C.oliva}`, paddingLeft: 9, lineHeight: 1.5,
          }}>
            Mesa montada com utensílios de madeira ou papel — estética rústica, aconchego e responsabilidade ambiental.
          </div>
        </div>

        <PageFooter pageNum="1 / 2" />
      </div>

      {/* ════════════════════════════════════════════
          PÁG. 2 — Orçamento · Condições · Assinatura
      ════════════════════════════════════════════ */}
      <div style={page}>
        <PageHeader num="2/2" proposal={proposal} />

        <div style={bodyPad}>

          {/* Orçamento */}
          <div style={{ marginBottom: 14 }}>
            <SectionTitle>Orçamento</SectionTitle>
            <p style={{ fontSize: 8.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
              O valor contempla todos os elementos necessários para a entrega completa — montagem, transporte,
              recolhimento e acessórios (tábuas, louças, utensílios e composição visual da mesa).
            </p>

            {/* Uma linha só, independente do nº de momentos: é UM serviço prestado
                (pagamento único, NF única). O detalhamento por momento — preço/pessoa,
                comida/bebida por pessoa — já está em "Composições" logo acima. */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 8 }}>
              <thead>
                <tr style={{ background: C.oliva }}>
                  {['Descrição do Serviço', 'Código de Serviço', 'Qtd.', 'R$ Unit.', 'V. Total'].map((h, i) => (
                    <th key={h} style={{
                      padding: '7px 8px', color: C.creme, fontSize: 7.5,
                      textAlign: i === 0 ? 'left' : 'center',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: C.olive10 }}>
                  <td style={{ padding: '9px 8px', color: C.text }}>
                    {buildServiceDescription()}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: C.text }}>
                    {billableCompositions.find(c => c.service_code)?.service_code || defaultServiceCode || '—'}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: C.text }}>
                    {budgetQty.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', color: C.text }}>
                    {fmtMoney(budgetUnit)}
                  </td>
                  <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: C.oliva, fontSize: 11 }}>
                    {fmtMoney(budgetTotal)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.oliva}` }}>
                  <td colSpan={4} style={{ padding: '7px 8px', fontWeight: 700, color: C.textMuted }}>Total geral</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 900, fontSize: 13, color: C.oliva }}>
                    {fmtMoney(budgetTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Contrato recorrente: como a cota é consumida */}
            {isUmbrellaBudget && (
              <p style={{ fontSize: 8, color: C.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
                Proposta de fornecimento recorrente: a quantidade contratada
                ({budgetQty.toLocaleString('pt-BR')} unidades a {fmtMoney(budgetUnit)} cada) é consumida
                conforme os eventos forem realizados, com faturamento conforme as condições de pagamento abaixo.
              </p>
            )}

            {/* Validade */}
            <div style={{
              display: 'flex', gap: 20, padding: '7px 12px',
              background: C.olive10, borderRadius: 5,
              border: `0.5px solid ${C.olive20}`,
            }}>
              <div>
                <div style={{ fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginBottom: 1 }}>Validade da proposta</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.oliva }}>15 dias a partir da emissão</div>
              </div>
              <div>
                <div style={{ fontSize: 7, letterSpacing: 0.8, textTransform: 'uppercase', color: C.textMuted, marginBottom: 1 }}>Emissão</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{fmtDate(todayStr())}</div>
              </div>
            </div>
          </div>

          {/* Condições + Dados */}
          <div style={{ marginBottom: 16 }}>
            <SectionTitle>Condições &amp; Dados</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: C.olive10, borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 7, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>
                  Condições de Pagamento
                </div>
                {[
                  ['Fluxo',         'Pedido de compras'],
                  ['Condição',      proposal.payment_terms || DEFAULT_PAYMENT_TERMS],
                  ['À vista',       'Depósito em conta corrente'],
                  ['Cartão Amex',   'Acréscimo de 5%'],
                ].map(([k, v]) => (
                  <div key={k} style={{ fontSize: 8, color: C.text, marginBottom: 3, lineHeight: 1.5 }}>
                    <strong style={{ color: C.oliva }}>{k}:</strong> {v}
                  </div>
                ))}
              </div>
              <div style={{ background: C.olive10, borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: 7, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>
                  Dados Bancários
                </div>
                {[
                  ['Empresa',         'Coffeelier Gastronomia de Experiências LTDA'],
                  ['CNPJ',            '54.556.922/0001-09'],
                  ['Banco',           '0260 — Nu Pagamentos S.A.'],
                  ['Ag / Conta',      '0001 / 203211769-6'],
                  ['Pix / CNPJ',      '54556922000109'],
                  ['Cód. Fornecedor', '131855'],
                ].map(([k, v]) => (
                  <div key={k} style={{ fontSize: 8, color: C.text, marginBottom: 3, lineHeight: 1.5 }}>
                    <strong style={{ color: C.oliva }}>{k}:</strong> {v}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Texto final */}
          <div style={{
            fontSize: 9, color: C.textMuted, lineHeight: 1.7, fontStyle: 'italic',
            borderLeft: `2px solid ${C.oliva}`, paddingLeft: 10, marginBottom: 20,
          }}>
            Após a confirmação, alinhamos os detalhes operacionais — espaço disponível, horários de chegada
            e recolhimento, infraestrutura e logística — para garantir que tudo aconteça da melhor forma possível.
            Cuidamos da expectativa. Surpreendemos com a entrega.
          </div>

          {/* Assinatura */}
          <div style={{ textAlign: 'center' }}>
            <img
              src="/logo-coffeelier.png"
              alt="Coffeelier"
              style={{ height: 48, objectFit: 'contain', marginBottom: 6 }}
            />
            <div style={{
              fontSize: 8, letterSpacing: 2, textTransform: 'uppercase',
              color: C.textMuted,
            }}>
              Gastronomia de Experiências
            </div>
          </div>
        </div>

        <PageFooter pageNum="2 / 2" />
      </div>
    </div>
  );
});
ProposalPDFDocument.displayName = 'ProposalPDFDocument';
