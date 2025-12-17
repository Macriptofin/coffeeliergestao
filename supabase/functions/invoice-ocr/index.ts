import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceItem {
  linha: number; // posição da linha na nota (1 = primeira linha do corpo)
  nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  preco_total: number;
  desconto?: number;
  desconto_percentual?: number;
  preco_com_desconto?: number;
  descricao_original?: string; // trecho literal da linha na nota (quando possível)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    console.log('Verificando OPENAI_API_KEY:', OPENAI_API_KEY ? 'Configurada' : 'NÃO configurada');
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('OPENAI_API_KEY não configurada. Por favor, configure a chave nas secrets do Supabase.');
    }

    const { image_base64, mime_type } = await req.json();

    if (!image_base64) {
      throw new Error('image_base64 is required');
    }

    // Detect file type - default to image/jpeg if not provided
    const detectedMimeType = mime_type || 'image/jpeg';
    const isPDF = detectedMimeType === 'application/pdf';
    
    console.log(`Processando nota fiscal com gpt-4o... Tipo: ${detectedMimeType}`);

    // Call OpenAI Vision API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em extrair dados de notas fiscais brasileiras. 
Extraia TODOS os itens da nota fiscal e retorne um JSON válido com a seguinte estrutura:
{
  "fornecedor": "nome do fornecedor",
  "data": "YYYY-MM-DD",
  "numero_nota": "número da nota fiscal",
  "itens": [
    {
      "linha": número inteiro sequencial (1 para a primeira linha de item),
      "nome": "nome do produto/material",
      "quantidade": número,
      "unidade": "unidade de medida (kg, un, cx, etc)",
      "preco_unitario": número,
      "preco_total": número,
      "desconto": número ou null (valor absoluto do desconto, se houver),
      "desconto_percentual": número ou null (percentual do desconto, se houver),
      "preco_com_desconto": número ou null (preço total já com desconto aplicado),
      "descricao_original": "texto literal da linha como aparece na nota (quando possível)"
    }
  ]
}

REGRAS CRÍTICAS:
- Extraia TODOS os itens, não omita nenhum
- CADA LINHA DA NOTA FISCAL deve ser um item separado no array
- NUNCA agrupe ou consolide itens com o mesmo nome
- É ESTRITAMENTE PROIBIDO somar quantidades de linhas diferentes do mesmo produto
- Se o mesmo produto aparece em 3 linhas diferentes, crie 3 itens separados no JSON (mantendo as respectivas quantidades)
- Mantenha a ORDEM EXATA das linhas conforme aparecem na nota (de cima para baixo)
- Preencha o campo "linha" com um inteiro sequencial considerando apenas as linhas de item (ignore cabeçalhos, subtotais, totais)
- Ignore linhas como "Subtotal", "Total", "Tributos" como itens; apenas associe descontos de linhas de desconto ao item imediatamente anterior
- Use números decimais com ponto (não vírgula)
- Se a unidade não estiver clara, use "un"
- Se algum valor não estiver legível, use 0
- DETECTE DESCONTOS: Se houver linhas de desconto logo após um item, capture o desconto e associe ao item
- Se desconto estiver em percentual (ex: -10,02%), capture também o percentual
- O preco_com_desconto deve ser preco_total - desconto
- Não reescreva nomes: quando possível, copie a descrição literal em "descricao_original"
- Retorne APENAS o JSON, sem texto adicional`
          },
          {
            role: 'user',
            content: isPDF 
              ? [
                  {
                    type: 'text',
                    text: 'Extraia todos os dados desta nota fiscal em PDF:'
                  },
                  {
                    type: 'file',
                    file: {
                      filename: 'nota_fiscal.pdf',
                      file_data: `data:application/pdf;base64,${image_base64}`
                    }
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: 'Extraia todos os dados desta nota fiscal:'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${detectedMimeType};base64,${image_base64}`,
                      detail: 'high'
                    }
                  }
                ]
          }
        ],
        max_tokens: 4096,
        temperature: 0.1
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const extractedText = openaiData.choices[0].message.content;
    
    console.log('Resposta do GPT-4o:', extractedText);

    // Parse JSON from response
    let invoiceData: InvoiceData;
    try {
      // Remove markdown code blocks if present
      const jsonText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      invoiceData = JSON.parse(jsonText);
    } catch (e) {
      console.error('Erro ao parsear JSON:', e);
      throw new Error('Não foi possível extrair dados estruturados da nota fiscal');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header from request
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      supabase.auth.setSession({ access_token: token, refresh_token: '' });
    }

    // Buscar fornecedor sugerido baseado em histórico
    console.log('Buscando sugestão de fornecedor...');
    let supplierSuggestion = null;
    
    try {
      const supplierTextNormalized = invoiceData.fornecedor.toLowerCase().trim();
      
      const { data: supplierHistory } = await supabase
        .from('invoice_supplier_matches')
        .select('supplier_id, match_count')
        .ilike('invoice_supplier_text_normalized', `%${supplierTextNormalized}%`)
        .order('match_count', { ascending: false })
        .limit(1);
      
      if (supplierHistory && supplierHistory.length > 0) {
        supplierSuggestion = supplierHistory[0].supplier_id;
        console.log('Fornecedor sugerido baseado em histórico:', supplierSuggestion);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico de fornecedor:', error);
    }

    // Suggest material matches for each item based on history
    console.log('Buscando sugestões de materiais...');
    
    for (const item of invoiceData.itens) {
      try {
        const itemNameNormalized = item.nome.toLowerCase().trim();
        
        // Buscar no histórico primeiro (com fornecedor se disponível)
        const { data: materialHistory } = await supabase
          .from('invoice_material_matches')
          .select('material_id, match_count, materials(id, name, purchase_unit, usage_unit)')
          .ilike('invoice_item_name_normalized', `%${itemNameNormalized}%`)
          .order('match_count', { ascending: false })
          .limit(1);

        if (materialHistory && materialHistory.length > 0 && materialHistory[0].materials) {
          const match = materialHistory[0].materials;
          item.material_sugerido_id = match.id;
          item.material_sugerido_nome = match.name;
          item.confianca_match = 0.9; // Higher confidence from history
          console.log(`Material sugerido do histórico para "${item.nome}":`, match.name);
        } else {
          // Fallback para busca simples se não houver histórico
          const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name, purchase_unit, usage_unit')
            .ilike('name', `%${item.nome.split(' ')[0]}%`)
            .limit(1);

          if (!error && materials && materials.length > 0) {
            const match = materials[0];
            item.material_sugerido_id = match.id;
            item.material_sugerido_nome = match.name;
            item.confianca_match = 0.6; // Lower confidence without history
          }
        }
      } catch (matchError) {
        console.error('Erro ao buscar material:', matchError);
        // Continue even if match fails
      }
    }

    console.log('OCR concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        data: invoiceData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Erro no invoice-ocr:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: 'Verifique se a OPENAI_API_KEY está configurada nas secrets do Supabase'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
