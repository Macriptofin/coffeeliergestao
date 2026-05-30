import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, X } from 'lucide-react';

// ─── Paleta oficial Coffeelier (MIV) ─────────────────────────────────────────
const C = {
  oliva:    '#626432',  // primária
  cafe:     '#552D19',  // escura / textos fortes
  caramelo: '#C06C3A',  // destaque / botões
  mocca:    '#DAAA73',  // secundária / acentos
  creme:    '#FCE8D0',  // fundo documentos
  white:    '#FFFFFF',
  text:     '#2C1810',  // texto principal (próximo do café)
  textMuted:'#6B4226',  // texto secundário
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProposalData {
  id: string;
  proposal_number: string;
  event_category: string;
  number_of_people: number;
  event_date: string;
  total_weight: number;
  total_amount: number;
  target_weight_per_person: number;
  status: string;
  client_name: string;
  cnpj_cpf: string;
  department_name: string;
  unit_name: string;
  unit_address: string;
  room_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

interface CategoryItem {
  category_label: string;
  items: { name: string; qty_per_person: number; fixed_qty: number; unit: string }[];
}

interface Props {
  proposalId: string;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Componente Logo texto ─────────────────────────────────────────────────
const LogoText = ({ color = C.creme, size = 28 }: { color?: string; size?: number }) => (
  <span style={{
    fontFamily: "'Dancing Script', cursive",
    fontSize: size,
    fontWeight: 700,
    color,
    letterSpacing: 0,
    lineHeight: 1,
  }}>
    Coffeelier
  </span>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export function ProposalPDF({ proposalId, onClose }: Props) {
  const [proposal,   setProposal]   = useState<ProposalData | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, [proposalId]);

  const loadData = async () => {
    try {
      const [propRes, catsRes] = await Promise.all([
        supabase
          .from('proposals')
          .select(`
            id, proposal_number, event_category, number_of_people,
            event_date, total_weight, total_amount, target_weight_per_person, status,
            clients(name, cnpj_cpf),
            client_departments(name),
            client_units(name, address),
            client_rooms(name),
            client_contacts(name, email, phone)
          `)
          .eq('id', proposalId)
          .single(),
        supabase
          .from('proposal_categories')
          .select(`
            category_label, sort_order,
            proposal_category_items(qty_per_person, fixed_qty, materials(name, usage_unit))
          `)
          .eq('proposal_id', proposalId)
          .order('sort_order'),
      ]);

      if (propRes.data) {
        const p = propRes.data as any;
        setProposal({
          id: p.id, proposal_number: p.proposal_number,
          event_category: p.event_category, number_of_people: p.number_of_people,
          event_date: p.event_date, total_weight: parseFloat(p.total_weight || 0),
          total_amount: parseFloat(p.total_amount || 0),
          target_weight_per_person: parseFloat(p.target_weight_per_person || 0),
          status: p.status, client_name: p.clients?.name || '—',
          cnpj_cpf: p.clients?.cnpj_cpf || '',
          department_name: p.client_departments?.name || '',
          unit_name: p.client_units?.name || '',
          unit_address: p.client_units?.address || '',
          room_name: p.client_rooms?.name || '',
          contact_name: p.client_contacts?.name || '',
          contact_email: p.client_contacts?.email || '',
          contact_phone: p.client_contacts?.phone || '',
        });
      }
      if (catsRes.data) {
        setCategories(catsRes.data.map((c: any) => ({
          category_label: c.category_label,
          items: (c.proposal_category_items || []).map((it: any) => ({
            name: it.materials?.name || '—',
            qty_per_person: parseFloat(it.qty_per_person || 0),
            fixed_qty: parseFloat(it.fixed_qty || 0),
            unit: it.materials?.usage_unit || 'un',
          })),
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Proposta_Coffeelier_${proposal?.proposal_number || ''}`,
    pageStyle: `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800;900&family=Dancing+Script:wght@400;600;700&display=swap');
      @page { size: A4 portrait; margin: 0; }
      @media print { body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    `,
  });

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!proposal) return <p>Proposta não encontrada.</p>;

  const numPeople    = proposal.number_of_people || 1;
  const pricePerPerson = numPeople > 0 ? proposal.total_amount / numPeople : 0;

  // ── Estilos base ──────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    width: '210mm', minHeight: '297mm',
    background: C.creme,
    fontFamily: "'Nunito', 'Arial Rounded MT Bold', Arial, sans-serif",
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    pageBreakAfter: 'always',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 9, fontWeight: 800, letterSpacing: 2,
    textTransform: 'uppercase', color: C.caramelo,
    borderBottom: `1px solid ${C.mocca}`,
    paddingBottom: 5, marginBottom: 10,
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 8, fontWeight: 600, color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  };

  const fieldValue: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.text,
  };

  const fieldValueMuted: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, color: C.textMuted,
  };

  return (
    <div>
      {/* Controles — não imprimem */}
      <div className="flex items-center justify-between p-4 border-b bg-background print:hidden">
        <div>
          <h2 className="font-bold">{proposal.proposal_number} — {proposal.client_name}</h2>
          <p className="text-sm text-muted-foreground">{proposal.event_category} · {numPeople} pessoas · {fmtDate(proposal.event_date)}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handlePrint()} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview — fundo cinza para contraste */}
      <div style={{ background: '#888', padding: 24, overflowY: 'auto', maxHeight: '85vh' }}>
        <div ref={printRef}>

          {/* ══════════════════════════════════════════════════
              PÁGINA 1 — Cliente + Evento + Composição
          ══════════════════════════════════════════════════ */}
          <div style={page}>

            {/* Header */}
            <div style={{
              background: C.oliva, padding: '18px 28px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <LogoText color={C.creme} size={32} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: C.mocca, textTransform: 'uppercase', marginBottom: 2 }}>
                  Proposta Comercial
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
                  {proposal.proposal_number}
                </div>
                <div style={{ fontSize: 9, color: C.mocca }}>
                  Emitida em {fmtDate(new Date().toISOString().split('T')[0])}
                </div>
              </div>
            </div>

            {/* Barra de acento */}
            <div style={{ height: 4, background: `linear-gradient(to right, ${C.caramelo}, ${C.mocca})` }} />

            {/* Corpo */}
            <div style={{ padding: '20px 28px' }}>

              {/* Dados do Cliente */}
              <div style={{ marginBottom: 18 }}>
                <div style={sectionTitle}>Cliente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={fieldLabel}>Empresa</div>
                    <div style={fieldValue}>{proposal.client_name}</div>
                    {proposal.cnpj_cpf && <div style={fieldValueMuted}>{proposal.cnpj_cpf}</div>}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={fieldLabel}>Contato</div>
                    <div style={fieldValue}>{proposal.contact_name || '—'}</div>
                    {proposal.contact_phone && <div style={fieldValueMuted}>{proposal.contact_phone}</div>}
                    {proposal.contact_email && <div style={{ ...fieldValueMuted, fontSize: 9 }}>{proposal.contact_email}</div>}
                  </div>
                  {proposal.department_name && (
                    <div>
                      <div style={fieldLabel}>Departamento</div>
                      <div style={fieldValueMuted}>{proposal.department_name}</div>
                    </div>
                  )}
                  {(proposal.unit_name || proposal.unit_address) && (
                    <div>
                      <div style={fieldLabel}>Unidade / Endereço</div>
                      <div style={fieldValueMuted}>{proposal.unit_name}{proposal.unit_address ? ` — ${proposal.unit_address}` : ''}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dados do Evento */}
              <div style={{ marginBottom: 18 }}>
                <div style={sectionTitle}>Evento</div>
                <div style={{
                  background: C.oliva, borderRadius: 8,
                  padding: '10px 16px',
                  display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
                }}>
                  {[
                    { label: 'Data', value: fmtDate(proposal.event_date) },
                    { label: 'Serviço', value: proposal.event_category },
                    { label: 'Pessoas', value: String(numPeople) },
                    { label: 'Local', value: proposal.room_name || proposal.unit_name || '—' },
                    { label: 'Peso/pessoa', value: `~${proposal.target_weight_per_person || 300}g` },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 7, letterSpacing: 1, color: C.mocca, textTransform: 'uppercase', marginBottom: 2 }}>
                        {f.label}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.white }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Composição */}
              <div style={{ marginBottom: 16 }}>
                <div style={sectionTitle}>Composição</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: categories.length <= 2 ? '1fr 1fr' : categories.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr',
                  gap: 8,
                }}>
                  {categories.length > 0 ? categories.map(cat => (
                    <div key={cat.category_label} style={{
                      background: C.oliva, borderRadius: 8, overflow: 'hidden',
                    }}>
                      <div style={{
                        background: C.cafe, padding: '6px 12px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: C.mocca, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {cat.category_label}
                        </span>
                      </div>
                      <div style={{ padding: '8px 12px' }}>
                        {cat.items.length > 0 ? cat.items.map((it, i) => {
                          const qty = it.qty_per_person > 0 ? it.qty_per_person : it.fixed_qty;
                          const qtyLabel = it.qty_per_person > 0 ? `${qty} ${it.unit}/pessoa` : `${qty} ${it.unit}`;
                          return (
                            <div key={i} style={{
                              fontSize: 10, color: '#F5EFE6',
                              padding: '2px 0',
                              borderBottom: i < cat.items.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
                              display: 'flex', justifyContent: 'space-between',
                            }}>
                              <span>{it.name}</span>
                              <span style={{ opacity: 0.6, fontSize: 8, marginLeft: 4 }}>{qtyLabel}</span>
                            </div>
                          );
                        }) : (
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                            Itens a definir
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    ['Salgados', 'Doces', 'Low Fat', 'Bebidas'].map(cat => (
                      <div key={cat} style={{ background: C.oliva, borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ background: C.cafe, padding: '6px 12px' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: C.mocca, textTransform: 'uppercase' }}>{cat}</span>
                        </div>
                        <div style={{ padding: '8px 12px', fontSize: 9, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                          A compor
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Nota de sustentabilidade */}
              <div style={{
                fontSize: 9, color: C.textMuted, fontStyle: 'italic',
                borderLeft: `3px solid ${C.mocca}`, paddingLeft: 10, marginTop: 8,
              }}>
                🌱 Mesa montada com utensílios de madeira ou papel — estética rústica, aconchego e responsabilidade ambiental.
              </div>
            </div>

            {/* Footer página 1 */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: C.oliva, padding: '8px 28px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 8, color: C.mocca, fontStyle: 'italic' }}>
                Cada detalhe importa, porque nos importa o que você sente quando percebe.
              </span>
              <span style={{ fontSize: 8, color: C.mocca }}>1 / 2</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════
              PÁGINA 2 — Orçamento + Condições + Assinatura
          ══════════════════════════════════════════════════ */}
          <div style={{ ...page, marginTop: 0 }}>

            {/* Header */}
            <div style={{
              background: C.oliva, padding: '18px 28px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <LogoText color={C.creme} size={32} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, letterSpacing: 2, color: C.mocca, textTransform: 'uppercase', marginBottom: 2 }}>
                  Proposta Comercial
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.white }}>
                  {proposal.proposal_number}
                </div>
                <div style={{ fontSize: 9, color: C.mocca }}>
                  Emitida em {fmtDate(new Date().toISOString().split('T')[0])}
                </div>
              </div>
            </div>
            <div style={{ height: 4, background: `linear-gradient(to right, ${C.caramelo}, ${C.mocca})` }} />

            <div style={{ padding: '20px 28px' }}>

              {/* Valores */}
              <div style={{ marginBottom: 18 }}>
                <div style={sectionTitle}>Orçamento</div>
                <p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
                  O valor contempla todos os elementos necessários para a entrega completa da experiência —
                  incluindo montagem, transporte, recolhimento e acessórios (tábuas, louças, utensílios e composição visual da mesa).
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={{ background: C.oliva }}>
                      {['Descrição do Serviço', 'Pessoas', 'R$ Unit.', 'V. Total'].map((h, i) => (
                        <th key={h} style={{
                          padding: '8px 10px', color: C.creme, fontWeight: 700, fontSize: 9,
                          textAlign: i === 0 ? 'left' : 'center',
                          textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: 'rgba(218,170,115,0.1)' }}>
                      <td style={{ padding: '10px', color: C.text }}>
                        Serviço de {proposal.event_category.toLowerCase()} — entrega completa
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: C.text }}>
                        {numPeople}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: C.text }}>
                        {fmtMoney(pricePerPerson)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, color: C.oliva, fontSize: 12 }}>
                        {fmtMoney(proposal.total_amount)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.oliva}` }}>
                      <td colSpan={3} style={{ padding: '8px 10px', fontWeight: 700, color: C.textMuted }}>
                        Total geral
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, fontSize: 14, color: C.caramelo }}>
                        {fmtMoney(proposal.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Validade */}
                <div style={{
                  display: 'flex', gap: 24, marginTop: 10,
                  padding: '8px 14px',
                  background: 'rgba(218,170,115,0.15)',
                  borderRadius: 6,
                  border: `1px solid ${C.mocca}`,
                }}>
                  <div>
                    <div style={fieldLabel}>Validade da proposta</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.oliva }}>15 dias a partir da emissão</div>
                  </div>
                  <div>
                    <div style={fieldLabel}>Emissão</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>
                      {fmtDate(new Date().toISOString().split('T')[0])}
                    </div>
                  </div>
                </div>
              </div>

              {/* Condições + Dados Bancários */}
              <div style={{ marginBottom: 18 }}>
                <div style={sectionTitle}>Condições &amp; Dados</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ background: 'rgba(98,100,50,0.08)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                      Condições de Pagamento
                    </div>
                    {[
                      ['Fluxo', 'Pedido de compras'],
                      ['Prazo', 'KQ15 — fora quinzena + 15 dias'],
                      ['À vista', 'Depósito em conta corrente'],
                      ['Cartão Amex', 'Acréscimo de 5%'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 9, color: C.text, marginBottom: 3, lineHeight: 1.5 }}>
                        <strong style={{ color: C.oliva }}>{k}:</strong> {v}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'rgba(98,100,50,0.08)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                      Dados Bancários
                    </div>
                    {[
                      ['Empresa', 'Coffeelier Gastronomia de Experiências LTDA'],
                      ['CNPJ', '54.556.922/0001-09'],
                      ['Banco', '0260 — Nu Pagamentos S.A.'],
                      ['Ag / Conta', '0001 / 203211769-6'],
                      ['Pix / CNPJ', '54556922000109'],
                      ['Cód. Fornecedor', '131855'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 9, color: C.text, marginBottom: 3, lineHeight: 1.5 }}>
                        <strong style={{ color: C.oliva }}>{k}:</strong> {v}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Texto final */}
              <div style={{
                fontSize: 10, color: C.textMuted, lineHeight: 1.7,
                borderLeft: `3px solid ${C.caramelo}`, paddingLeft: 12,
                marginBottom: 24, fontStyle: 'italic',
              }}>
                Após a confirmação, alinhamos os detalhes operacionais — espaço disponível, horários de chegada
                e recolhimento, infraestrutura e logística — para garantir que tudo aconteça da melhor forma possível.
                Cuidamos da expectativa. Surpreendemos com a entrega.
              </div>

              {/* Assinatura */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <div style={{
                  fontFamily: "'Dancing Script', cursive",
                  fontSize: 42, fontWeight: 700, color: C.oliva,
                  lineHeight: 1,
                }}>
                  Coffeelier
                </div>
                <div style={{ fontSize: 9, color: C.caramelo, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
                  Gastronomia de Experiências
                </div>
              </div>
            </div>

            {/* Footer página 2 */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: C.oliva, padding: '8px 28px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 8, color: C.mocca, fontStyle: 'italic' }}>
                Cada detalhe importa, porque nos importa o que você sente quando percebe.
              </span>
              <span style={{ fontSize: 8, color: C.mocca }}>2 / 2</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
