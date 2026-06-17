import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Calendar, Users, MapPin, Package } from "lucide-react";

// ─── Paleta Coffeelier ────────────────────────────────────────────────────────
const C = {
  oliva:    '#626432',
  creme:    '#FCE8D0',
  cafe:     '#552D19',
  textMuted:'#6B4226',
  text:     '#2C1810',
  olive10:  'rgba(98,100,50,0.08)',
  olive25:  'rgba(98,100,50,0.25)',
  cremedark:'rgba(252,232,208,0.75)',
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : '—';

interface ProposalPublic {
  id:                      string;
  proposal_number:         string;
  event_category:          string;
  number_of_people:        number;
  event_date:              string;
  total_amount:            number;
  target_weight_per_person:number;
  status:                  string;
  client_name:             string;
  department_name:         string;
  unit_name:               string;
  room_name:               string;
  contact_name:            string;
  contact_email:           string;
  categories: {
    category_label: string;
    items: { name: string; qty_per_person: number; fixed_qty: number; unit: string }[];
  }[];
}

type PageState = 'loading' | 'loaded' | 'approved' | 'already_approved' | 'error' | 'approving';

export default function PropostaAprovacao() {
  const { token } = useParams<{ token: string }>();
  const [proposal,    setProposal]    = useState<ProposalPublic | null>(null);
  const [state,       setState]       = useState<PageState>('loading');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');

  useEffect(() => {
    if (token) loadProposal();
  }, [token]);

  const loadProposal = async () => {
    try {
      const { data: rawData, error } = await supabase.rpc('get_proposal_by_token', { p_token: token });
      const data = rawData as any;
      if (error || !data || data.error) {
        setState('error');
        setErrorMsg(data?.error || 'Não foi possível carregar a proposta.');
        return;
      }
      // Tanto o aceite do cliente quanto a aprovação final da equipe contam como "já aceita".
      if (data.status === 'Aprovada pelo Cliente' || data.status === 'Aprovada') {
        setProposal(data);
        setState('already_approved');
        return;
      }
      setProposal(data);
      setState('loaded');
    } catch {
      setState('error');
      setErrorMsg('Erro de conexão. Tente novamente.');
    }
  };

  const handleApprove = async () => {
    setState('approving');
    try {
      const { data, error } = await supabase.rpc('approve_proposal_by_token', { p_token: token });
      const result = data as any;
      if (error || !result?.success) {
        setState('error');
        setErrorMsg(result?.error || 'Erro ao aprovar a proposta.');
        return;
      }
      // O RPC registra o aceite comercial (status 'Aprovada pelo Cliente') — a equipe fará a revisão final.
      setSuccessMsg(result?.message || 'Proposta aceita! Nossa equipe fará a revisão final e a confirmação.');
      setState('approved');
    } catch {
      setState('error');
      setErrorMsg('Erro de conexão. Tente novamente.');
    }
  };

  const numPeople      = proposal?.number_of_people || 1;
  const pricePerPerson = (proposal?.total_amount || 0) > 0 ? (proposal?.total_amount || 0) / numPeople : 0;

  // ── Telas de estado ────────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', background: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 style={{ width: 40, height: 40, color: C.oliva, margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: C.textMuted, fontFamily: 'Arial, sans-serif' }}>Carregando proposta...</p>
      </div>
    </div>
  );

  if (state === 'error') return (
    <div style={{ minHeight: '100vh', background: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <XCircle style={{ width: 64, height: 64, color: '#dc2626', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8, fontFamily: 'Arial, sans-serif' }}>
          Link inválido ou expirado
        </h2>
        <p style={{ color: C.textMuted, fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}>{errorMsg}</p>
        <p style={{ color: C.textMuted, fontFamily: 'Arial, sans-serif', fontSize: 13, marginTop: 12 }}>
          Entre em contato com a Coffeelier para solicitar um novo link.
        </p>
      </div>
    </div>
  );

  if (state === 'approved') return (
    <div style={{ minHeight: '100vh', background: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <CheckCircle2 style={{ width: 80, height: 80, color: C.oliva, margin: '0 auto 20px' }} />
        <h2 style={{ fontSize: 28, fontWeight: 900, color: C.oliva, marginBottom: 12, fontFamily: 'Arial, sans-serif' }}>
          Proposta Aceita!
        </h2>
        <p style={{ color: C.textMuted, fontFamily: 'Arial, sans-serif', lineHeight: 1.7, marginBottom: 20 }}>
          {successMsg || 'Proposta aceita! Nossa equipe fará a revisão final e a confirmação.'}<br />
          Em breve entraremos em contato para alinhar os detalhes do evento.
        </p>
        <div style={{ background: C.oliva, color: C.creme, borderRadius: 8, padding: '12px 24px', fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
          Proposta <strong>{proposal?.proposal_number}</strong> — {proposal?.event_category}
        </div>
        <p style={{ marginTop: 24, fontSize: 12, color: C.textMuted, fontFamily: 'Arial, sans-serif' }}>
          Coffeelier Gastronomia de Experiências · Cada detalhe importa, porque nos importa o que você sente quando percebe.
        </p>
      </div>
    </div>
  );

  if (state === 'already_approved') return (
    <div style={{ minHeight: '100vh', background: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <CheckCircle2 style={{ width: 64, height: 64, color: C.oliva, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8, fontFamily: 'Arial, sans-serif' }}>
          Proposta já aceita
        </h2>
        <p style={{ color: C.textMuted, fontFamily: 'Arial, sans-serif' }}>
          Esta proposta ({proposal?.proposal_number}) já foi aceita anteriormente. Nosso time está cuidando de tudo!
        </p>
      </div>
    </div>
  );

  if (!proposal) return null;

  // ── Tela principal da proposta ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f0ede6', fontFamily: 'Arial, Helvetica, sans-serif' }}>

      {/* Header */}
      <div style={{ background: C.oliva, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="/logo-coffeelier.png" alt="Coffeelier" style={{ height: 40, objectFit: 'contain' }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: C.cremedark, letterSpacing: 2, textTransform: 'uppercase' }}>Proposta Comercial</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.creme }}>{proposal.proposal_number}</div>
        </div>
      </div>
      <div style={{ height: 3, background: `linear-gradient(to right, ${C.oliva}, rgba(98,100,50,0.4))` }} />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>

        {/* Saudação */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, marginBottom: 6 }}>
            Olá{proposal.contact_name ? `, ${proposal.contact_name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>
            Preparamos esta proposta especialmente para <strong style={{ color: C.text }}>{proposal.client_name}</strong>.
            Revise os detalhes abaixo e, se tudo estiver certo, clique em <strong>Aprovar Proposta</strong>.
          </p>
        </div>

        {/* Dados do Evento */}
        <div style={{ background: C.creme, borderRadius: 12, padding: 20, marginBottom: 20, border: `1px solid ${C.olive25}` }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Detalhes do Evento
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { icon: Calendar, label: 'Data', value: fmtDate(proposal.event_date) },
              { icon: Package,  label: 'Serviço', value: proposal.event_category },
              { icon: Users,    label: 'Pessoas', value: `${numPeople} convidados` },
              { icon: MapPin,   label: 'Local', value: [proposal.room_name, proposal.unit_name].filter(Boolean).join(' — ') || '—' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, background: C.oliva, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 16, height: 16, color: C.creme }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 1 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Composição */}
        {(proposal.categories || []).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Composição
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: (proposal.categories || []).length <= 2 ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
              {(proposal.categories || []).map(cat => (
                <div key={cat.category_label} style={{ background: C.oliva, borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 14px', fontSize: 10, fontWeight: 800, color: C.cremedark, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {cat.category_label}
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    {(cat.items || []).map((it, i) => {
                      const qty = it.qty_per_person > 0 ? `${it.qty_per_person} ${it.unit}/pessoa` : `${it.fixed_qty} ${it.unit}`;
                      return (
                        <div key={i} style={{
                          fontSize: 12, color: 'rgba(252,232,208,0.85)',
                          padding: '3px 0',
                          borderBottom: i < cat.items.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
                          display: 'flex', justifyContent: 'space-between',
                        }}>
                          <span>{it.name}</span>
                          <span style={{ opacity: 0.6, fontSize: 10 }}>{qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Valores */}
        <div style={{ background: C.creme, borderRadius: 12, padding: 20, marginBottom: 24, border: `1px solid ${C.olive25}` }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: C.oliva, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Investimento
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: C.textMuted }}>Serviço completo · {numPeople} pessoas</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{fmt(pricePerPerson)} por pessoa</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.oliva }}>{fmt(proposal.total_amount)}</div>
          </div>
          <div style={{ borderTop: `1px solid ${C.olive25}`, paddingTop: 12, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
            Inclui montagem da mesa, transporte, recolhimento e todos os acessórios necessários.
            Validade desta proposta: <strong>15 dias</strong>.
          </div>
        </div>

        {/* Botão de aprovação */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleApprove}
            disabled={state === 'approving'}
            style={{
              background: state === 'approving' ? '#9ca3af' : C.oliva,
              color: C.creme,
              border: 'none',
              borderRadius: 10,
              padding: '16px 48px',
              fontSize: 16,
              fontWeight: 800,
              cursor: state === 'approving' ? 'not-allowed' : 'pointer',
              width: '100%',
              maxWidth: 360,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              margin: '0 auto',
              fontFamily: 'Arial, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            {state === 'approving' ? (
              <><Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> Aprovando...</>
            ) : (
              <><CheckCircle2 style={{ width: 20, height: 20 }} /> Aprovar Proposta</>
            )}
          </button>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12, fontFamily: 'Arial, sans-serif' }}>
            Ao clicar, confirmo que li e aceito os termos desta proposta.
          </p>
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: 40, paddingTop: 20, borderTop: `1px solid ${C.olive25}` }}>
          <img src="/logo-coffeelier.png" alt="Coffeelier" style={{ height: 28, objectFit: 'contain', marginBottom: 8, opacity: 0.7 }} />
          <p style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>
            Cada detalhe importa, porque nos importa o que você sente quando percebe.
          </p>
          <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
            Coffeelier Gastronomia de Experiências · CNPJ 54.556.922/0001-09
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
