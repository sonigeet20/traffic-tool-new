import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const AWS_AUTOMATE_URL = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';
const MAX_PER_INVOCATION = 1200;
const SUB_BATCH_SIZE = 60;

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

    for (let i = start; i < endExclusive; i += SUB_BATCH_SIZE) {
      const subEnd = Math.min(i + SUB_BATCH_SIZE, endExclusive);
      const requests: Promise<void>[] = [];

      for (let j = i; j < subEnd; j++) {
        const sessionNum = j + 1;
        const sessionId = `${runId}-${sessionNum}`;
        const geoLocation = geoLocations[j % geoLocations.length];
        const url = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}${runId}=${sessionNum}`;

        const payload = {
          sessionId,
          campaignType: campaign.campaign_type || 'direct',
          url,
          targetUrl: targetUrl,
          geoLocation,
          proxy: proxyUrl,
          proxyUsername: campaign.proxy_username,
          proxyPassword: campaign.proxy_password,
          proxyProvider: 'brightdata',
          headlessMode: 'false',
          maxBandwidthKB: campaign.max_bandwidth_mb ? Math.round(campaign.max_bandwidth_mb * 1024) : 220,
          minPagesPerSession: 1,
          maxPagesPerSession: 2,
          sessionDurationMin: campaign.session_duration_min || 20,
          sessionDurationMax: campaign.session_duration_max || 30,
          extensionId: 'hoklmmgfnpapgjgcpechhaamimifchmp',
        };

        requests.push(
          fetch(AWS_AUTOMATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then(async (res) => {
              const text = await res.text();
              if (res.ok && (text.includes('accepted') || text.includes('queued'))) {
                accepted += 1;
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(requests);
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
