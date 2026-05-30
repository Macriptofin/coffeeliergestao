import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, X } from 'lucide-react';

// ─── Paleta da marca ──────────────────────────────────────────────────────────
const C = {
  bg:         '#F5EFE6',
  green:      '#4B5C2A',
  greenLight: '#8A9B5A',
  greenCard:  '#7A8F48',
  tan:        '#C4A882',
  tanLight:   '#D4B896',
  text:       '#2C2C1E',
  white:      '#FFFFFF',
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
  items: { name: string; qty_per_person: number; unit: string; fixed_qty: number }[];
}

interface Props {
  proposalId: string;
  onClose: () => void;
}

// ─── SVG Blobs decorativos ────────────────────────────────────────────────────
const BlobTopRight = () => (
  <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: 0, right: 0, width: 180, height: 180, opacity: 0.15 }}>
    <path fill={C.green} d="M150,20 C180,20 200,50 200,80 C200,120 170,150 140,160 C110,170 80,150 70,120 C55,85 80,40 110,25 C120,20 135,20 150,20Z" />
  </svg>
);
const BlobBottomLeft = () => (
  <svg viewBox="0 0 200 200" style={{ position: 'absolute', bottom: 0, left: 0, width: 160, height: 160, opacity: 0.18 }}>
    <path fill={C.green} d="M30,160 C10,140 0,110 10,80 C20,50 50,30 80,35 C110,40 130,65 125,95 C120,130 90,160 60,168 C50,170 38,168 30,160Z" />
  </svg>
);
const BlobBottomRight = () => (
  <svg viewBox="0 0 200 200" style={{ position: 'absolute', bottom: 0, right: 0, width: 140, height: 140, opacity: 0.22 }}>
    <path fill={C.tan} d="M160,170 C140,185 110,185 90,170 C70,155 65,125 75,100 C85,75 115,65 140,75 C165,85 178,110 175,135 C173,150 168,162 160,170Z" />
  </svg>
);
const CurveTopRight = () => (
  <svg viewBox="0 0 100 80" style={{ position: 'absolute', top: 20, right: 30, width: 80, height: 60, opacity: 0.25 }}>
    <path d="M10,10 Q50,5 70,30 Q85,50 75,70" stroke={C.green} strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

// ─── Logo texto ───────────────────────────────────────────────────────────────
const Logo = ({ size = 32, color = C.green }: { size?: number; color?: string }) => (
  <span style={{ fontFamily: 'Georgia, serif', fontSize: size, fontWeight: 900, color, letterSpacing: -1 }}>
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
            proposal_category_items(
              qty_per_person, fixed_qty,
              materials(name, usage_unit)
            )
          `)
          .eq('proposal_id', proposalId)
          .order('sort_order'),
      ]);

      if (propRes.data) {
        const p = propRes.data as any;
        setProposal({
          id:                      p.id,
          proposal_number:         p.proposal_number,
          event_category:          p.event_category,
          number_of_people:        p.number_of_people,
          event_date:              p.event_date,
          total_weight:            parseFloat(p.total_weight || 0),
          total_amount:            parseFloat(p.total_amount || 0),
          target_weight_per_person:parseFloat(p.target_weight_per_person || 0),
          status:                  p.status,
          client_name:             p.clients?.name || '—',
          cnpj_cpf:                p.clients?.cnpj_cpf || '',
          department_name:         p.client_departments?.name || '',
          unit_name:               p.client_units?.name || '',
          unit_address:            p.client_units?.address || '',
          room_name:               p.client_rooms?.name || '',
          contact_name:            p.client_contacts?.name || '',
          contact_email:           p.client_contacts?.email || '',
          contact_phone:           p.client_contacts?.phone || '',
        });
      }

      if (catsRes.data) {
        const cats: CategoryItem[] = catsRes.data.map((c: any) => ({
          category_label: c.category_label,
          items: (c.proposal_category_items || []).map((it: any) => ({
            name:          it.materials?.name || '—',
            qty_per_person:parseFloat(it.qty_per_person || 0),
            unit:          it.materials?.usage_unit || 'un',
            fixed_qty:     parseFloat(it.fixed_qty || 0),
          })),
        }));
        setCategories(cats);
      }
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
      @page { size: A4 landscape; margin: 0; }
      @media print { body { margin: 0; } }
    `,
  });

  if (loading) return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!proposal) return <p>Proposta não encontrada.</p>;

  const fmtDate = (d: string) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const fmtMoney = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const pricePerPerson = proposal.number_of_people > 0
    ? proposal.total_amount / proposal.number_of_people : 0;

  // ── Estilos base de página ───────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    width: '297mm',
    height: '210mm',
    background: C.bg,
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif',
    pageBreakAfter: 'always',
  };

  // ── CATEGORIA CARD ────────────────────────────────────────────────────────────
  const CategoryCard = ({ cat }: { cat: CategoryItem }) => (
    <div style={{
      background: C.greenCard,
      borderRadius: 12,
      padding: '14px 16px',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        fontWeight: 700, fontSize: 11, color: C.white,
        textTransform: 'uppercase', letterSpacing: 1,
        borderBottom: `1px solid rgba(255,255,255,0.3)`,
        paddingBottom: 6, marginBottom: 8,
      }}>
        {cat.category_label}
      </div>
      <div style={{ flex: 1 }}>
        {cat.items.map((it, i) => {
          const qty = it.qty_per_person > 0 ? it.qty_per_person : it.fixed_qty;
          const qtyLabel = it.qty_per_person > 0
            ? `${qty} ${it.unit}/pessoa`
            : `${qty} ${it.unit} total`;
          return (
            <div key={i} style={{ color: C.white, fontSize: 10.5, marginBottom: 4, lineHeight: 1.4 }}>
              • {it.name}
              <span style={{ opacity: 0.75, fontSize: 9.5, marginLeft: 4 }}>({qtyLabel})</span>
            </div>
          );
        })}
        {cat.items.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontStyle: 'italic' }}>
            Itens a definir
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Controles (não imprimem) */}
      <div className="flex items-center justify-between p-4 border-b bg-background print:hidden">
        <h2 className="font-semibold">Proposta {proposal.proposal_number} — {proposal.client_name}</h2>
        <div className="flex gap-2">
          <Button onClick={() => handlePrint()} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div style={{ background: '#888', padding: 24, overflowY: 'auto', maxHeight: '80vh' }}>
        <div ref={printRef}>

          {/* ══════════════════════════════════════════════════════
              PÁGINA 1 — CAPA
          ══════════════════════════════════════════════════════ */}
          <div style={pageStyle}>
            <BlobTopRight />
            <BlobBottomLeft />
            <BlobBottomRight />

            {/* Blob decorativo curva */}
            <CurveTopRight />

            {/* Metade esquerda — imagem placeholder */}
            <div style={{
              position: 'absolute', left: 0, top: 0,
              width: '50%', height: '100%',
              background: `linear-gradient(135deg, ${C.greenLight}55 0%, ${C.green}33 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Blob orgânico simulando a foto */}
              <div style={{
                width: 200, height: 240,
                borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
                background: `${C.greenLight}88`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48,
              }}>
                ☕
              </div>
            </div>

            {/* Metade direita — texto */}
            <div style={{
              position: 'absolute', right: 0, top: 0,
              width: '50%', height: '100%',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '0 48px',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.green, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                  Proposta
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.green, lineHeight: 1.1, marginBottom: 8 }}>
                  {proposal.event_category}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>
                  {proposal.client_name}
                  {proposal.department_name ? ` — ${proposal.department_name}` : ''}
                </div>
                {proposal.event_date && (
                  <div style={{ fontSize: 12, color: C.greenLight, marginTop: 6 }}>
                    {fmtDate(proposal.event_date)}
                  </div>
                )}
              </div>

              <Logo size={52} color={C.green} />
              <div style={{ fontSize: 10, color: C.greenLight, marginTop: 8, letterSpacing: 1 }}>
                Gastronomia de Experiências
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              PÁGINA 2 — CURADORIA
          ══════════════════════════════════════════════════════ */}
          <div style={{ ...pageStyle, padding: '28px 36px' }}>
            <BlobBottomRight />

            {/* Título */}
            <div style={{
              display: 'inline-block',
              background: C.green,
              color: C.white,
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 3,
              textTransform: 'uppercase',
              padding: '8px 24px',
              borderRadius: 8,
              marginBottom: 16,
            }}>
              Curadoria
            </div>

            {/* Texto introdutório */}
            <p style={{ fontSize: 10, color: C.text, lineHeight: 1.6, marginBottom: 16, maxWidth: '75%' }}>
              Um Coffee Break bem planejado acolhe, aproxima pessoas e cria o clima perfeito para conversas,
              conexões e uma experiência mais leve e prazerosa. Desenvolvemos uma composição prática, elegante
              e repleta de sabores, valorizando o momento e proporcionando uma recepção à altura do encontro.
            </p>

            {/* Composição */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Composição:
            </div>

            {/* Cards de categorias */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flex: 1 }}>
              {categories.length > 0 ? (
                categories.map(cat => <CategoryCard key={cat.category_label} cat={cat} />)
              ) : (
                ['Salgados', 'Doces', 'Low Fat', 'Bebidas'].map(cat => (
                  <CategoryCard key={cat} cat={{ category_label: cat, items: [] }} />
                ))
              )}
            </div>

            {/* Entrega */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, borderBottom: `2px solid ${C.green}`, paddingBottom: 4, marginBottom: 10 }}>
                Entrega:
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Data', 'Hora', 'Serviço', 'Nº Pessoas', 'Local'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontWeight: 700, color: C.text, paddingBottom: 4, paddingRight: 16 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ color: C.text, paddingRight: 16 }}>{fmtDate(proposal.event_date)}</td>
                    <td style={{ color: C.text, paddingRight: 16 }}>—</td>
                    <td style={{ color: C.text, paddingRight: 16 }}>{proposal.event_category}</td>
                    <td style={{ color: C.text, paddingRight: 16, fontWeight: 700 }}>{proposal.number_of_people}</td>
                    <td style={{ color: C.text }}>{proposal.room_name || proposal.unit_name || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Nota sustentabilidade */}
            <div style={{ marginTop: 12, fontSize: 9.5, color: C.greenLight, fontStyle: 'italic' }}>
              🌱 Uma mesa consciente, que utiliza utensílios de serviço de madeira ou papel, unindo estética rústica, aconchego e sustentabilidade.
            </div>

            {/* Logo canto */}
            <div style={{ position: 'absolute', bottom: 16, right: 36 }}>
              <Logo size={18} color={C.green} />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              PÁGINA 3 — ORÇAMENTO
          ══════════════════════════════════════════════════════ */}
          <div style={{ ...pageStyle, padding: '28px 36px' }}>
            <BlobBottomLeft />

            {/* Título */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              background: C.green,
              color: C.white,
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 3,
              textTransform: 'uppercase',
              padding: '12px 32px',
              borderRadius: '0 0 0 16px',
            }}>
              Orçamento
            </div>

            <div style={{ marginTop: 32 }}>
              {/* Texto descritivo */}
              <p style={{ fontSize: 10, color: C.text, lineHeight: 1.6, marginBottom: 20, maxWidth: '80%' }}>
                O valor apresentado contempla todos os elementos necessários para a entrega completa da
                experiência proposta, incluindo montagem da mesa, transporte, recolhimento e os acessórios
                essenciais para o consumo no local — como tábuas, louças, utensílios e itens de composição visual da mesa.
              </p>

              {/* Título valores */}
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, borderBottom: `2px solid ${C.green}`, paddingBottom: 4, marginBottom: 12 }}>
                Valores:
              </div>

              {/* Tabela de valores */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: C.green }}>
                    {['Descrição do Serviço', 'Código', 'Nº Pessoas', 'R$ Unit.', 'V. Total'].map((h, i) => (
                      <th key={h} style={{
                        color: C.white, padding: '8px 12px',
                        textAlign: i === 0 ? 'left' : 'center',
                        fontWeight: 700, fontSize: 10,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: '#fff8' }}>
                    <td style={{ padding: '10px 12px', color: C.text }}>
                      Serviço de alimentação em formato {proposal.event_category.toLowerCase()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: C.text }}>
                      {proposal.proposal_number}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: C.text }}>
                      {proposal.number_of_people}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: C.text }}>
                      {fmtMoney(pricePerPerson)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: C.text }}>
                      {fmtMoney(proposal.total_amount)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `1px dashed ${C.green}` }}>
                    <td colSpan={4} style={{ padding: '8px 12px', fontWeight: 700, color: C.text }}>Total:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 900, fontSize: 12, color: C.green }}>
                      {fmtMoney(proposal.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Div verde separador */}
              <div style={{ height: 6, background: C.greenLight, borderRadius: 3, marginBottom: 16, opacity: 0.4 }} />

              {/* Condições + Dados lado a lado */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Condições */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green, borderBottom: `1px solid ${C.green}`, paddingBottom: 4, marginBottom: 8 }}>
                    Condições:
                  </div>
                  <div style={{ fontSize: 10, color: C.text, lineHeight: 1.7 }}>
                    <div><strong>Fluxo de formalização:</strong> Pedido de compras</div>
                    <div><strong>Condição de pagamento:</strong> KQ15 (Fora quinzena + 15 dias)</div>
                    <div style={{ marginTop: 6 }}><strong>Formas:</strong></div>
                    <div>• À vista: Depósito em conta corrente</div>
                    <div>• Crédito Cartão Amex: Acréscimo 5%</div>
                  </div>
                </div>

                {/* Dados bancários */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green, borderBottom: `1px solid ${C.green}`, paddingBottom: 4, marginBottom: 8 }}>
                    Dados de Cadastro:
                  </div>
                  <div style={{ fontSize: 10, color: C.text, lineHeight: 1.7 }}>
                    <div><strong>Coffeelier Gastronomia de Experiências LTDA</strong></div>
                    <div>CNPJ: 54.556.922/0001-09</div>
                    <div>Banco: 0260 - Nu Pagamentos S.A.</div>
                    <div>Agência: 0001 | Conta: 203211769-6</div>
                    <div>Chave PIX/CNPJ: 54556922000109</div>
                    <div>Código fornecedor: 131855</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Logo canto */}
            <div style={{ position: 'absolute', bottom: 16, right: 36 }}>
              <Logo size={18} color={C.green} />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
              PÁGINA 4 — CONSIDERAÇÕES FINAIS
          ══════════════════════════════════════════════════════ */}
          <div style={{ ...pageStyle, padding: '48px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <BlobBottomLeft />
            <BlobBottomRight />
            <CurveTopRight />

            {/* Título */}
            <div style={{
              background: C.green,
              color: C.white,
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 3,
              textTransform: 'uppercase',
              padding: '10px 32px',
              borderRadius: 8,
              textAlign: 'center',
              alignSelf: 'center',
              marginBottom: 28,
            }}>
              Considerações Finais
            </div>

            {/* Texto */}
            <div style={{ flex: 1, maxWidth: 620, margin: '0 auto', textAlign: 'justify' }}>
              <p style={{ fontSize: 11, color: C.text, fontWeight: 600, lineHeight: 1.7, marginBottom: 16 }}>
                Esta proposta foi construída com base no nosso histórico de fornecimentos e na sensibilidade que
                desenvolvemos ao longo do tempo, projetando uma composição que acreditamos ser ideal para o perfil e
                as características deste momento. Mas nada aqui é engessado — toda e qualquer necessidade pode ser
                ajustada, ampliada ou personalizada para que o resultado final vá além das expectativas.
              </p>
              <p style={{ fontSize: 11, color: C.text, fontWeight: 600, lineHeight: 1.7, marginBottom: 16 }}>
                Cada detalhe foi pensado com intenção — não apenas para atender uma demanda, mas para criar
                sensações, despertar encantamento e fazer com que cada convidado sinta que está vivendo algo único.
              </p>
              <p style={{ fontSize: 11, color: C.text, fontWeight: 600, lineHeight: 1.7 }}>
                Sabemos que orçamentos fazem parte do processo, mas acreditamos que aquilo que é feito com verdade,
                propósito e cuidado tem um valor que vai além do número final. Estamos aqui para somar, facilitar e
                fazer acontecer — com leveza, comprometimento e afeto em cada entrega.
              </p>
            </div>

            {/* Assinatura */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                Vai ser um prazer construir essa experiência ao seu lado!
              </p>
              <p style={{ fontSize: 11, color: C.text, marginBottom: 12 }}>Atenciosamente,</p>
              <Logo size={56} color={C.green} />
              <div style={{
                fontSize: 11, fontWeight: 700, color: C.green, marginTop: 10,
                fontStyle: 'italic', letterSpacing: 0.5,
              }}>
                Cada detalhe importa, porque nos importa o que você sente quando percebe.
              </div>
            </div>
          </div>

        </div>{/* fim printRef */}
      </div>
    </div>
  );
}
