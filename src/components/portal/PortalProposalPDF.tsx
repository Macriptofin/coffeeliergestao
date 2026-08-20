import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePrintWithTitle } from '@/hooks/usePrintWithTitle';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, X } from 'lucide-react';
import { ProposalPDFDocument } from '@/components/sales/ProposalPDFDocument';
import { buildProposalData, buildCompositions, ProposalData, Composition } from '@/lib/proposalPdfViewModel';
import { useConfig } from '@/hooks/useConfig';

interface Props {
  proposalId: string;
  onClose: () => void;
}

// Mesmo shape relacional que a versão interna (ProposalPDF.tsx) consome, mas
// buscado via RPC blindada do Portal (get_portal_proposal_pdf) — só o dono da
// visibilidade (portal_created_by) consegue ler, nunca expõe custo/margem.
async function fetchPortalProposalPDFData(proposalId: string): Promise<{ proposal: ProposalData | null; compositions: Composition[] }> {
  const { data, error } = await supabase.rpc('get_portal_proposal_pdf', { p_proposal_id: proposalId });
  if (error) throw error;
  const raw = data as any;
  if (raw?.error) throw new Error(raw.error);
  return {
    proposal: buildProposalData(raw?.proposal),
    compositions: buildCompositions(raw?.compositions || [], raw?.categories || []),
  };
}

// Documento formatado (mesmo layout do PDF interno) pro Portal do Cliente.
export function PortalProposalPDF({ proposalId, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isPending: loading } = useQuery({
    queryKey: ['portal-proposal-pdf', proposalId],
    queryFn: () => fetchPortalProposalPDFData(proposalId),
  });
  const proposal = data?.proposal ?? null;
  const compositions = data?.compositions ?? [];
  const { getConfigValue } = useConfig();
  const defaultServiceCode = getConfigValue('vendas', 'fiscal_service_code') || '';

  const pdfTitle = `Proposta_${proposal?.event_name ? `${proposal.event_name.replace(/\s+/g, '_')}_` : ''}${proposal?.proposal_number || ''}${proposal && proposal.revision > 1 ? `_Rev${proposal.revision}` : ''}`;
  const handlePrint = usePrintWithTitle({
    contentRef: printRef,
    documentTitle: pdfTitle,
    pageStyle: `
      @page { size: A4 portrait; margin: 0; }
      @media print {
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `,
  });

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Controles */}
      <div className="flex items-center justify-between p-4 border-b bg-background print:hidden shrink-0">
        <div>
          <p className="font-semibold">
            {proposal ? `${proposal.proposal_number}${proposal.revision > 1 ? ` · Rev. ${proposal.revision}` : ''}` : 'Carregando...'}
          </p>
          {proposal?.event_name && <p className="text-sm text-muted-foreground">{proposal.event_name}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handlePrint()} disabled={!proposal} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#888', padding: 24 }}>
        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
          </div>
        )}
        {!loading && !proposal && (
          <p className="p-8 text-center text-primary-foreground">Não foi possível carregar a proposta.</p>
        )}
        {proposal && (
          // Centraliza a folha no preview (fora do printRef — não vai pra impressão);
          // fit-content + margin auto não clipa a borda esquerda em tela estreita.
          <div style={{ width: 'fit-content', margin: '0 auto', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <ProposalPDFDocument ref={printRef} proposal={proposal} compositions={compositions} defaultServiceCode={defaultServiceCode} />
          </div>
        )}
      </div>
    </div>
  );
}
