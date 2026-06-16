import { useState, useEffect, useRef } from 'react';
import { todayLocalISO, formatLocalDate } from '@/lib/date-utils';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, X } from 'lucide-react';

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

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProposalData {
  id: string;
  proposal_number: string;
  event_category: string;
  number_of_people: number;
  event_date: string;
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

interface MenuItem {
  name: string;
  qty_per_person: number;
  fixed_qty: number;
  unit: string;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

interface Composition {
  id: string;
  name: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  location: string | null;
  price_per_person: number;
  number_of_people: number;
  sections: MenuSection[];
}

interface Props {
  proposalId: string;
  onClose: () => void;
}

// Ordem canônica + mapa KEY -> LABEL das seções do cardápio
const SECTION_ORDER = ['salgados', 'doces', 'bebidas', 'frutas', 'sobremesas', 'lowfat'];
const SECTION_LABELS: Record<string, string> = {
  salgados:   'Salgados',
  doces:      'Doces',
  bebidas:    'Bebidas',
  frutas:     'Frutas',
  sobremesas: 'Sobremesas',
  lowfat:     'Low Fat / Fitness',
};

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

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const PageHeader = ({ num, proposal }: { num: string; proposal: ProposalData }) => (
  <>
    <div style={{
      background: C.oliva, padding: '14px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <img
        src="/logo-coffeelier.png"
        alt="Coffeelier"
        style={{ height: 36, objectFit: 'contain' }}
      />
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 7, letterSpacing: 2, color: C.cremedark, textTransform: 'uppercase', marginBottom: 2 }}>
          Proposta Comercial
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.creme, lineHeight: 1 }}>
          {proposal.proposal_number}
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

// ─── Componente principal ─────────────────────────────────────────────────────
export function ProposalPDF({ proposalId, onClose }: Props) {
  const [proposal,     setProposal]     = useState<ProposalData | null>(null);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading,      setLoading]      = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, [proposalId]);

  const loadData = async () => {
    try {
      const [propRes, compsRes, catsRes] = await Promise.all([
        supabase
          .from('proposals')
          .select(`
            id, proposal_number, event_category, number_of_people,
            event_date, total_amount, target_weight_per_person, status,
            clients(name, cnpj_cpf),
            client_departments(name),
            client_units(name, address),
            client_rooms(name),
            client_contacts(name, email, phone)
          `)
          .eq('id', proposalId)
          .single(),
        supabase
          .from('proposal_compositions')
          .select(`
            id, name, scheduled_date, scheduled_time, location,
            sort_order, price_per_person, number_of_people
          `)
          .eq('proposal_id', proposalId)
          .order('sort_order'),
        supabase
          .from('proposal_categories')
          .select(`
            category_label, sort_order, composition_id,
            proposal_category_items(qty_per_person, fixed_qty, materials(name, usage_unit))
          `)
          .eq('proposal_id', proposalId)
          .order('sort_order'),
      ]);

      if (propRes.data) {
        const p = propRes.data as any;
        setProposal({
          id: p.id,
          proposal_number: p.proposal_number,
          event_category: p.event_category,
          number_of_people: p.number_of_people,
          event_date: p.event_date,
          total_amount: parseFloat(p.total_amount || 0),
          target_weight_per_person: parseFloat(p.target_weight_per_person || 0),
          status: p.status,
          client_name: p.clients?.name || '—',
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

      // ── Agrupa categorias por composição (momento) → seção → itens ──────────
      const rawCats: any[] = catsRes.data || [];
      const rawComps: any[] = compsRes.data || [];

      // Converte uma linha de categoria em MenuSection (apenas se tiver itens).
      const toSection = (c: any): MenuSection | null => {
        const items: MenuItem[] = (c.proposal_category_items || []).map((it: any) => ({
          name: it.materials?.name || '—',
          qty_per_person: parseFloat(it.qty_per_person || 0),
          fixed_qty: parseFloat(it.fixed_qty || 0),
          unit: it.materials?.usage_unit || 'un',
        }));
        if (items.length === 0) return null;
        const key = (c.category_label || '').toLowerCase();
        // KEY conhecida → label canônica; legado/desconhecida → label cru.
        const label = SECTION_LABELS[key] || c.category_label || '—';
        return { label, items };
      };

      // Ordena seções de uma composição pela ordem canônica; desconhecidas no fim.
      const orderSections = (cats: any[]): MenuSection[] => {
        const sorted = [...cats].sort((a, b) => {
          const ka = (a.category_label || '').toLowerCase();
          const kb = (b.category_label || '').toLowerCase();
          const ia = SECTION_ORDER.indexOf(ka);
          const ib = SECTION_ORDER.indexOf(kb);
          const ra = ia === -1 ? SECTION_ORDER.length : ia;
          const rb = ib === -1 ? SECTION_ORDER.length : ib;
          if (ra !== rb) return ra - rb;
          return (a.sort_order || 0) - (b.sort_order || 0);
        });
        return sorted.map(toSection).filter(Boolean) as MenuSection[];
      };

      let comps: Composition[];

      if (rawComps.length > 0) {
        // Caso normal: múltiplas composições (momentos).
        comps = rawComps.map((cp: any) => ({
          id: cp.id,
          name: cp.name || '',
          scheduled_date: cp.scheduled_date || null,
          scheduled_time: cp.scheduled_time || null,
          location: cp.location || null,
          price_per_person: parseFloat(cp.price_per_person || 0),
          number_of_people: cp.number_of_people || 0,
          sections: orderSections(rawCats.filter((c) => c.composition_id === cp.id)),
        }));

        // Categorias órfãs (composition_id NULL) viram uma composição implícita.
        const orphanCats = rawCats.filter((c) => !c.composition_id);
        const orphanSections = orderSections(orphanCats);
        if (orphanSections.length > 0) {
          comps.push({
            id: '__legacy__',
            name: '',
            scheduled_date: null,
            scheduled_time: null,
            location: null,
            price_per_person: 0,
            number_of_people: 0,
            sections: orphanSections,
          });
        }

        // Remove composições sem nenhuma seção com itens.
        comps = comps.filter((c) => c.sections.length > 0);
      } else {
        // Legado: nenhuma composição — uma composição implícita com todas as categorias.
        const sections = orderSections(rawCats);
        comps = sections.length > 0
          ? [{
              id: '__legacy__',
              name: '',
              scheduled_date: null,
              scheduled_time: null,
              location: null,
              price_per_person: 0,
              number_of_people: 0,
              sections,
            }]
          : [];
      }

      setCompositions(comps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Proposta_Coffeelier_${proposal?.proposal_number || ''}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }
      @media print {
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  });

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!proposal) return <p className="p-8 text-muted-foreground">Proposta não encontrada.</p>;

  const numPeople      = proposal.number_of_people || 1;
  const pricePerPerson = proposal.total_amount > 0 ? proposal.total_amount / numPeople : 0;

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
    <div>
      {/* Controles */}
      <div className="flex items-center justify-between p-4 border-b bg-background print:hidden">
        <div>
          <p className="font-semibold">{proposal.proposal_number} — {proposal.client_name}</p>
          <p className="text-sm text-muted-foreground">
            {proposal.event_category} · {numPeople} pessoas · {fmtDate(proposal.event_date)}
          </p>
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

      {/* Preview */}
      <div style={{ background: '#888', padding: 24, overflowY: 'auto', maxHeight: '85vh' }}>
        <div ref={printRef}>

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
                  display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
                }}>
                  {[
                    { label: 'Data',     value: fmtDate(proposal.event_date) },
                    { label: 'Serviço',  value: proposal.event_category },
                    { label: 'Pessoas',  value: String(numPeople) },
                    { label: 'Local',    value: proposal.room_name || proposal.unit_name || '—' },
                    { label: 'Peso/pp',  value: `~${proposal.target_weight_per_person || 300}g` },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 6, letterSpacing: 0.8, color: C.cremedark, textTransform: 'uppercase', marginBottom: 2 }}>
                        {f.label}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: C.creme, lineHeight: 1.2 }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Composição — agrupada por momento (composição) → seção → itens */}
              <div style={{ marginBottom: 12 }}>
                <SectionTitle>Composição</SectionTitle>

                {compositions.length === 0 && (
                  <div style={{ fontSize: 8, color: C.textMuted, fontStyle: 'italic' }}>
                    A compor
                  </div>
                )}

                {compositions.map((comp, ci) => {
                  // Linha-cabeçalho do momento: nome · DD/MM · HH:MM · local
                  const meta = [
                    fmtDateShort(comp.scheduled_date),
                    fmtTime(comp.scheduled_time),
                    comp.location || '',
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
                            {comp.name && (
                              <div style={{ fontSize: 9.5, fontWeight: 800, color: C.oliva, lineHeight: 1.2 }}>
                                {comp.name}
                              </div>
                            )}
                            {meta && (
                              <div style={{ fontSize: 7.5, color: C.textMuted, marginTop: 1 }}>
                                {meta}
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

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 8 }}>
                  <thead>
                    <tr style={{ background: C.oliva }}>
                      {['Descrição do Serviço', 'Pessoas', 'R$ Unit.', 'V. Total'].map((h, i) => (
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
                        Serviço de {proposal.event_category.toLowerCase()} — entrega completa
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: C.text }}>
                        {numPeople}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', color: C.text }}>
                        {fmtMoney(pricePerPerson)}
                      </td>
                      <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: C.oliva, fontSize: 11 }}>
                        {fmtMoney(proposal.total_amount)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.oliva}` }}>
                      <td colSpan={3} style={{ padding: '7px 8px', fontWeight: 700, color: C.textMuted }}>Total geral</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 900, fontSize: 13, color: C.oliva }}>
                        {fmtMoney(proposal.total_amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

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
                      ['Prazo',         'KQ15 — fora quinzena + 15 dias'],
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
      </div>
    </div>
  );
}
