import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    
    // Update accounts_payable: set status to 'Vencido' where due_date < today and remaining_amount > 0
    // Only update if current status is 'Pendente' or 'Parcial'
    const { data: payableUpdated, error: payableError } = await supabase
      .from('accounts_payable')
      .update({ status: 'Vencido' })
      .lt('due_date', today)
      .gt('remaining_amount', 0)
      .in('status', ['Pendente', 'Parcial'])
      .select('id');

    if (payableError) {
      console.error('Error updating accounts_payable:', payableError);
      throw payableError;
    }

    // Update accounts_receivable: set status to 'Vencido' where due_date < today and remaining_amount > 0
    // Only update if current status is 'Pendente' or 'Parcial'
    const { data: receivableUpdated, error: receivableError } = await supabase
      .from('accounts_receivable')
      .update({ status: 'Vencido' })
      .lt('due_date', today)
      .gt('remaining_amount', 0)
      .in('status', ['Pendente', 'Parcial'])
      .select('id');

    if (receivableError) {
      console.error('Error updating accounts_receivable:', receivableError);
      throw receivableError;
    }

    const result = {
      success: true,
      updated_at: new Date().toISOString(),
      accounts_payable_updated: payableUpdated?.length || 0,
      accounts_receivable_updated: receivableUpdated?.length || 0
    };

    console.log('Overdue status update completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in update-overdue-status function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
