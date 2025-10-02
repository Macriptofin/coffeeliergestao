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

      // Call edge function
      const { data, error } = await supabase.functions.invoke('invoice-ocr', {
        body: { image_base64: base64 }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar nota fiscal');
      }

      setInvoiceData(data.data);
      toast.success('Nota fiscal processada com sucesso!');
      return data.data;

    } catch (error) {
      console.error('Erro ao processar nota fiscal:', error);
      toast.error('Erro ao processar nota fiscal');
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
