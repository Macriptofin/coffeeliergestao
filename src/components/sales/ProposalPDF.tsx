import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, X } from 'lucide-react';
import { ProposalPDFDocument } from './ProposalPDFDocument';
import { buildProposalData, buildCompositions, ProposalData, Composition } from '@/lib/proposalPdfViewModel';
import { useConfig } from '@/hooks/useConfig';

interface Props {
  proposalId: string;
  onClose: () => void;
}

async function fetchProposalPDFData(proposalId: string): Promise<{ proposal: ProposalData | null; compositions: Composition[] }> {
  const [propRes, compsRes, catsRes] = await Promise.all([
    supabase
      .from('proposals')
      .select(`
        id, proposal_number, revision, event_name, event_category, number_of_people,
        event_date, total_amount, target_weight_per_person, status, payment_terms,
        is_umbrella, umbrella_quota_quantity, umbrella_quota_unit_price,
        clients(name, cnpj_cpf, payment_terms),
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
        id, name, event_category, scheduled_date, scheduled_time, location,
        sort_order, price_per_person, number_of_people, service_code,
        client_rooms(name)
      `)
      .eq('proposal_id', proposalId)
      .order('sort_order'),
    supabase
      .from('proposal_categories')
      .select(`
        category_label, sort_order, composition_id,
        proposal_category_items(qty_per_person, fixed_qty, materials(name, usage_unit, unit_weight, category))
      `)
      .eq('proposal_id', proposalId)
      .order('sort_order'),
  ]);

  return {
    proposal: buildProposalData(propRes.data),
    compositions: buildCompositions(compsRes.data || [], catsRes.data || []),
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ProposalPDF({ proposalId, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isPending: loading } = useQuery({
    queryKey: ['proposal-pdf', proposalId],
    queryFn: () => fetchProposalPDFData(proposalId),
  });
  const proposal = data?.proposal ?? null;
  const compositions = data?.compositions ?? [];
  const { getConfigValue } = useConfig();
  const defaultServiceCode = getConfigValue('vendas', 'fiscal_service_code') || '';

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Proposta_${proposal?.event_name ? `${proposal.event_name.replace(/\s+/g, '_')}_` : ''}${proposal?.proposal_number || ''}${proposal && proposal.revision > 1 ? `_Rev${proposal.revision}` : ''}`,
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

  const numPeople = proposal.number_of_people || 1;

  return (
    <div>
      {/* Controles */}
      <div className="flex items-center justify-between p-4 border-b bg-background print:hidden">
        <div>
          <p className="font-semibold">
            {proposal.proposal_number}{proposal.revision > 1 ? ` · Rev. ${proposal.revision}` : ''} — {proposal.client_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {proposal.event_name ? `${proposal.event_name} · ` : ''}{numPeople} pessoas · {proposal.event_date ? new Date(proposal.event_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
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
        <ProposalPDFDocument ref={printRef} proposal={proposal} compositions={compositions} defaultServiceCode={defaultServiceCode} />
      </div>
    </div>
  );
}
