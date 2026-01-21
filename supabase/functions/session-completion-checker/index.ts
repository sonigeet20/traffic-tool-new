import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SESSION-COMPLETION-CHECKER] Starting check for stale sessions...');

    // Find all "running" sessions that started more than 5 minutes ago
    // These should have completed by now (max session duration is 240 seconds)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: staleSessions, error: fetchError } = await supabase
      .from('bot_sessions')
      .select('id, started_at, campaign_id')
      .eq('status', 'running')
      .lt('started_at', fiveMinutesAgo);

    if (fetchError) {
      console.error('[SESSION-COMPLETION-CHECKER] Error fetching stale sessions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions', details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!staleSessions || staleSessions.length === 0) {
      console.log('[SESSION-COMPLETION-CHECKER] No stale sessions found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No stale sessions to update',
          updatedCount: 0 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[SESSION-COMPLETION-CHECKER] Found ${staleSessions.length} stale sessions to mark as completed`);

    // Update all stale sessions to "completed" status
    const sessionIds = staleSessions.map(s => s.id);
    
    const { error: updateError } = await supabase
      .from('bot_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .in('id', sessionIds);

    if (updateError) {
      console.error('[SESSION-COMPLETION-CHECKER] Error updating sessions:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update sessions', details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[SESSION-COMPLETION-CHECKER] Successfully marked ${staleSessions.length} sessions as completed`);

    // Check if any campaigns should be marked as completed
    const campaignIds = [...new Set(staleSessions.map(s => s.campaign_id))];
    
    for (const campaignId of campaignIds) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('total_sessions')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        const { count: completedCount } = await supabase
          .from('bot_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaignId)
          .eq('status', 'completed');

        if (completedCount && completedCount >= campaign.total_sessions) {
          await supabase
            .from('campaigns')
            .update({ status: 'completed' })
            .eq('id', campaignId);
          
          console.log(`[SESSION-COMPLETION-CHECKER] Campaign ${campaignId} marked as completed (${completedCount}/${campaign.total_sessions} sessions)`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: staleSessions.length,
        sessionIds: sessionIds,
        message: `Marked ${staleSessions.length} sessions as completed`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[SESSION-COMPLETION-CHECKER] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
