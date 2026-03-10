import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark campaign as active
    await supabase.from('campaigns').update({
      status: 'active',
      started_at: new Date().toISOString(),
    }).eq('id', campaignId);

    // Trigger the scheduler to start processing immediately
    const schedulerUrl = `${supabaseUrl}/functions/v1/campaign-scheduler`;
    let schedulerResult: any = { status: 'triggered' };
    try {
      const schedulerResponse = await fetch(schedulerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!schedulerResponse.ok) {
        const errorText = await schedulerResponse.text();
        console.error('Failed to trigger scheduler:', errorText);
        schedulerResult = { status: 'error', error: errorText };
      } else {
        schedulerResult = await schedulerResponse.json();
      }
    } catch (schedulerError) {
      console.warn('Scheduler trigger timed out or failed, campaign remains active:', schedulerError?.message || schedulerError);
      schedulerResult = { status: 'queued', message: 'Scheduler invocation timed out; campaign is active and will be picked up on next run' };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Campaign started successfully',
        campaignId,
        status: 'active',
        schedulerResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Campaign start error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});