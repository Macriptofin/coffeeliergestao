import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceItem {
  nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  preco_total: number;
  material_sugerido_id?: string;
  material_sugerido_nome?: string;
  confianca_match?: number;
}

interface InvoiceData {
  fornecedor: string;
  data: string;
  numero_nota?: string;
  itens: InvoiceItem[];
}

// O GPT-4o é instruído a sempre preencher preço/quantidade com um número (0 quando
// ilegível), mas não segue essa regra 100% das vezes — em notas mais difíceis de ler
// às vezes omite o campo. A tela então tenta formatar undefined como moeda e quebra
// (tela "Algo deu errado"). Normaliza aqui, na entrada, pra nenhuma tela depender disso.
function normalizeInvoiceData(raw: InvoiceData): InvoiceData {
  const toNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    ...raw,
    itens: (raw.itens || []).map(item => ({
      ...item,
      quantidade: toNumber(item.quantidade),
      preco_unitario: toNumber(item.preco_unitario),
      preco_total: toNumber(item.preco_total),
    })),
  };
}

export const useInvoiceOCR = () => {
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const processInvoice = async (file: File): Promise<InvoiceData | null> => {
    setLoading(true);
    setInvoiceData(null);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Determine file type
      const isPDF = file.type === 'application/pdf';
      const mimeType = isPDF ? 'application/pdf' : file.type;

      // Call edge function
      const { data, error } = await supabase.functions.invoke('invoice-ocr', {
        body: { 
          image_base64: base64,
          mime_type: mimeType
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar nota fiscal');
      }

      const normalized = normalizeInvoiceData(data.data);
      setInvoiceData(normalized);
      toast.success('Nota fiscal processada com sucesso!');
      return normalized;

    } catch (error) {
      console.error('Erro ao processar nota fiscal:', error);
      
      // Mostrar mensagem mais específica
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('OPENAI_API_KEY')) {
        toast.error('Chave da OpenAI não configurada. Configure nas secrets do Supabase.');
      } else if (errorMessage.includes('Failed to send')) {
        toast.error('Falha ao conectar com a função. Aguarde alguns segundos e tente novamente.');
      } else {
        toast.error(`Erro ao processar nota fiscal: ${errorMessage}`);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearData = () => {
    setInvoiceData(null);
  };

  return {
    loading,
    invoiceData,
    processInvoice,
    clearData
  };
};
