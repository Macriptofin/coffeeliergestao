import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { image_base64 } = await req.json();

    if (!image_base64) {
      throw new Error('image_base64 is required');
    }

    console.log('Processando nota fiscal com gpt-4o...');

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
      "nome": "nome do produto/material",
      "quantidade": número,
      "unidade": "unidade de medida (kg, un, cx, etc)",
      "preco_unitario": número,
      "preco_total": número
    }
  ]
}

IMPORTANTE:
- Extraia TODOS os itens, não omita nenhum
- Use números decimais com ponto (não vírgula)
- Se a unidade não estiver clara, use "un"
- Se algum valor não estiver legível, use 0
- Retorne APENAS o JSON, sem texto adicional`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia todos os dados desta nota fiscal:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image_base64}`,
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

    // Suggest material matches for each item
    console.log('Buscando sugestões de materiais...');
    
    for (const item of invoiceData.itens) {
      try {
        const { data: materials, error } = await supabase
          .from('materials')
          .select('id, name, purchase_unit, usage_unit')
          .ilike('name', `%${item.nome.split(' ')[0]}%`)
          .limit(1);

        if (!error && materials && materials.length > 0) {
          const match = materials[0];
          item.material_sugerido_id = match.id;
          item.material_sugerido_nome = match.name;
          item.confianca_match = 0.7; // Simple confidence score
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
