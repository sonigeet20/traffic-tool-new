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

    // Find all "running" sessions
    const { data: runningSessions, error: fetchError } = await supabase
      .from('bot_sessions')
      .select('id, started_at, campaign_id, session_duration_sec, is_bounced, bounce_duration_ms')
      .eq('status', 'running');

    if (fetchError) {
      console.error('[SESSION-COMPLETION-CHECKER] Error fetching running sessions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions', details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!runningSessions || runningSessions.length === 0) {
      console.log('[SESSION-COMPLETION-CHECKER] No running sessions found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No running sessions to check',
          updatedCount: 0 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Filter sessions that should have completed by now
    // Use session_duration_sec (or default 120) + 60 second buffer for network/processing delays
    const now = Date.now();
    const staleSessions = runningSessions.filter(session => {
      const startedAt = new Date(session.started_at).getTime();
      const expectedDuration = session.is_bounced 
        ? (session.bounce_duration_ms / 1000) // Convert ms to seconds
        : (session.session_duration_sec || 120); // Default to 120 seconds if not set
      const bufferSeconds = 60; // 1 minute buffer
      const elapsedSeconds = (now - startedAt) / 1000;
      
      return elapsedSeconds > (expectedDuration + bufferSeconds);
    });
    
    const { data: _unused, error: _unusedError } = await supabase
      .from('bot_sessions')
      .select('id')
      .limit(0);

    if (!staleSessions || staleSessions.length === 0) {
      console.log('[SESSION-COMPLETION-CHECKER] No stale sessions found (all sessions still within expected duration)');
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
