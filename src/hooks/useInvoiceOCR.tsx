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

// PDF → imagens JPEG no navegador (pdfjs, carregado sob demanda). O caminho
// "arquivo PDF" da API da OpenAI não entrega páginas ESCANEADAS pro modelo de
// forma confiável (respondia "não consigo ler o arquivo" e inventava exemplo);
// rasterizar aqui manda o PDF pela via de imagem, que funciona.
async function rasterizePdfToJpegs(file: File, maxPages = 3): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  // @ts-expect-error — import de asset do Vite (?url) sem tipos
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  const pageCount = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    // ~2048px no lado maior: nítido o bastante pra letra miúda de DANFE
    const scale = 2048 / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport } as any).promise;
    pages.push(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
  }
  return pages;
}

export const useInvoiceOCR = () => {
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const processInvoice = async (file: File): Promise<InvoiceData | null> => {
    setLoading(true);
    setInvoiceData(null);

    try {
      const isPDF = file.type === 'application/pdf';

      let body: Record<string, unknown>;
      if (isPDF) {
        const pages = await rasterizePdfToJpegs(file);
        body = { images_base64: pages, mime_type: 'image/jpeg' };
      } else {
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
        body = { image_base64: base64, mime_type: file.type };
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('invoice-ocr', {
        body
      });

      if (error) {
        // FunctionsHttpError não expõe o corpo da resposta em error.message —
        // sem isso o usuário via só "Edge Function returned a non-2xx status
        // code" em vez da mensagem real (ex.: "foto ilegível, aproxime a câmera")
        let message = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) message = body.error;
        } catch { /* mantém a mensagem genérica */ }
        throw new Error(message);
      }

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
