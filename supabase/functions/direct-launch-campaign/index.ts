import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const AWS_AUTOMATE_URL = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';
const MAX_PER_INVOCATION = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function enqueueWithRetry(payload: any): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(AWS_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify(payload),
      });

      if (res.status === 200 || res.status === 202) {
        return true;
      }
    } catch {
      // Ignore and retry
    }

    await sleep(150 * attempt);
  }

  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { campaignId, runId: inputRunId, offset: inputOffset } = await req.json();
    const offset = Number(inputOffset || 0);

    if (!campaignId) {
      return new Response(JSON.stringify({ success: false, error: 'campaignId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ success: false, error: 'Campaign not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!campaign.proxy_username || !campaign.proxy_password || !campaign.proxy_host) {
      return new Response(JSON.stringify({ success: false, error: 'Campaign Bright Data proxy config is incomplete' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalSessions = Number(campaign.total_sessions || 0);
    if (totalSessions <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Campaign total_sessions must be > 0' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const runId = inputRunId || `direct-${campaign.id.substring(0, 8)}-${Date.now()}`;

    if (offset === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', campaign.id);
    }

    const geoLocations = campaign.target_geo_locations?.length ? campaign.target_geo_locations : ['US'];
    const targetUrl = campaign.target_url;
    const proxyUrl = `http://${campaign.proxy_host}:${campaign.proxy_port || '33335'}`;

    const start = offset;
    const endExclusive = Math.min(start + MAX_PER_INVOCATION, totalSessions);

    let accepted = 0;

    // Match the previously working method: sequential enqueue + retries + pacing
    for (let i = start; i < endExclusive; i++) {
      const sessionNum = i + 1;
      const sessionId = `${runId}-${sessionNum}`;
      const geoLocation = geoLocations[i % geoLocations.length];
      const url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}${runId}=${sessionNum}`;

      const campaignBandwidthKB = campaign.max_bandwidth_mb ? Math.round(campaign.max_bandwidth_mb * 1024) : 120;
      const boundedBandwidthKB = Math.min(Math.max(campaignBandwidthKB, 80), 180);

      const payload = {
        sessionId,
        campaignType: campaign.campaign_type || 'direct',
        url,
        targetUrl: url,
        geoLocation,
        proxy: proxyUrl,
        proxyUsername: campaign.proxy_username,
        proxyPassword: campaign.proxy_password,
        proxyProvider: 'brightdata',
        headlessMode: 'false',
        minPagesPerSession: 1,
        maxPagesPerSession: 2,
        sessionDurationMin: campaign.session_duration_min || 25,
        sessionDurationMax: campaign.session_duration_max || 40,
        // Hard clamp to keep bandwidth in a safe range
        maxBandwidthKB: boundedBandwidthKB,
      };

      const ok = await enqueueWithRetry(payload);
      if (ok) accepted += 1;

      await sleep(90);
    }

    const hasMore = endExclusive < totalSessions;

    if (hasMore) {
      fetch(`${supabaseUrl}/functions/v1/direct-launch-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaignId, runId, offset: endExclusive }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        accepted,
        dispatched: endExclusive,
        totalSessions,
        remaining: Math.max(0, totalSessions - endExclusive),
        hasMore,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('direct-launch-campaign error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
