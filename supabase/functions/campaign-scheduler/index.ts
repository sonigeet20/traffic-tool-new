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
    const puppeteerServerUrl = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Campaign scheduler triggered at:', new Date().toISOString());

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: stuckSessions } = await supabase
      .from('bot_sessions')
      .select('id')
      .eq('status', 'running')
      .lt('started_at', fiveMinutesAgo);

    if (stuckSessions && stuckSessions.length > 0) {
      console.log(`Found ${stuckSessions.length} stuck sessions, marking as failed`);
      await supabase
        .from('bot_sessions')
        .update({
          status: 'failed',
          error_message: 'Session timeout - exceeded 5 minutes',
          completed_at: new Date().toISOString(),
        })
        .eq('status', 'running')
        .lt('started_at', fiveMinutesAgo);
    }

    const { data: activeCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active');

    if (campaignsError || !activeCampaigns || activeCampaigns.length === 0) {
      console.log('No active campaigns found');
      return new Response(
        JSON.stringify({ message: 'No active campaigns', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${activeCampaigns.length} active campaigns`);
    const results = [];

    for (const campaign of activeCampaigns) {
      try {
        const { count: allSessionsCount } = await supabase
          .from('bot_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .in('status', ['completed', 'failed', 'running']);

        const totalSessionsCreated = allSessionsCount || 0;

        if (totalSessionsCreated >= campaign.total_sessions) {
          const { count: runningCount } = await supabase
            .from('bot_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('status', 'running');

          const stillRunning = runningCount || 0;

          if (stillRunning === 0) {
            await supabase
              .from('campaigns')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', campaign.id);

            console.log(`Campaign ${campaign.id} completed: All ${totalSessionsCreated} sessions finished`);
            results.push({ campaignId: campaign.id, status: 'completed', totalSessions: totalSessionsCreated, running: 0 });
          } else {
            console.log(`Campaign ${campaign.id}: Target reached (${totalSessionsCreated}/${campaign.total_sessions}), waiting for ${stillRunning} running sessions to complete`);
            results.push({
              campaignId: campaign.id,
              status: 'waiting_for_completion',
              totalSessions: totalSessionsCreated,
              running: stillRunning
            });
          }
          continue;
        }

        const { count: completedCount } = await supabase
          .from('bot_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'completed');

        const totalSessionsCompleted = completedCount || 0;

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: completedThisHour } = await supabase
          .from('bot_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'completed')
          .gte('completed_at', oneHourAgo);

        const sessionsPerHour = campaign.sessions_per_hour || 10;
        const completedThisHourCount = completedThisHour || 0;

        if (completedThisHourCount >= sessionsPerHour) {
          console.log(`Campaign ${campaign.id}: Hourly target already met (${completedThisHourCount}/${sessionsPerHour})`);
          results.push({
            campaignId: campaign.id,
            status: 'hourly_target_met',
            completedThisHour: completedThisHourCount,
            hourlyTarget: sessionsPerHour
          });
          continue;
        }

        const remainingForHour = sessionsPerHour - completedThisHourCount;
        const remainingOverall = campaign.total_sessions - totalSessionsCreated;
        const sessionsToRun = Math.min(remainingForHour, remainingOverall);

        console.log(`Campaign ${campaign.id}: Creating ${sessionsToRun} new sessions (${totalSessionsCreated}/${campaign.total_sessions} total created, ${completedThisHourCount}/${sessionsPerHour} completed this hour)`);

        await executeHourlyBatch(supabase, campaign, sessionsToRun, puppeteerServerUrl);

        results.push({
          campaignId: campaign.id,
          status: 'processed',
          sessionsCreated: sessionsToRun,
          totalCreated: totalSessionsCreated + sessionsToRun,
          completedThisHour: completedThisHourCount,
          hourlyTarget: sessionsPerHour,
          totalTarget: campaign.total_sessions
        });
      } catch (error) {
        console.error(`Error processing campaign ${campaign.id}:`, error);
        results.push({ campaignId: campaign.id, status: 'error', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: activeCampaigns.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scheduler error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeHourlyBatch(
  supabase: any,
  campaign: any,
  sessionsToRun: number,
  puppeteerServerUrl: string
) {
  const targetGeoLocations = campaign.target_geo_locations || ['US'];
  const campaignType = campaign.campaign_type || 'direct'; // default to 'direct' for backward compatibility
  const searchKeywords = campaign.search_keywords || [];
  
  const extensionCrxUrl = campaign.extension_crx_url;
  const bounceRate = campaign.bounce_rate || 30;
  const sessionDurationMin = (campaign.session_duration_min || 30) * 1000;
  const sessionDurationMax = (campaign.session_duration_max || 120) * 1000;
  const customReferrer = campaign.custom_referrer;

  const { data: userJourney } = await supabase
    .from('user_journeys')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('step_order', { ascending: true });

  // ═══════════════════════════════════════════════════════════
  // Fetch credentials based on campaign type
  // ═══════════════════════════════════════════════════════════
  let browserApiConfig = null;
  let lunaProxyConfig = null;
  
  if (campaignType === 'search') {
    // Search campaigns use Browser API exclusively
    const { data: config } = await supabase
      .from('bright_data_serp_config')
      .select('browser_api_token, browser_zone, browser_customer_id, browser_username, browser_password, browser_endpoint, browser_port')
      .eq('user_id', campaign.user_id)
      .maybeSingle();
    
    if (config && config.browser_zone) {
      // Auto-extract customer ID from username if not explicitly set
      let customerId = config.browser_customer_id;
      if (!customerId && config.browser_username) {
        // Extract from format: brd-customer-hl_a908b07a-zone-scraping_browser1
        const match = config.browser_username.match(/(brd-customer-[a-z0-9_]+)/);
        customerId = match ? match[1] : null;
      }

      browserApiConfig = {
        browser_api_token: config.browser_api_token || null,
        browser_zone: config.browser_zone,
        browser_customer_id: customerId || null,
        browser_username: config.browser_username || null,
        browser_password: config.browser_password || null,
        browser_endpoint: config.browser_endpoint || 'brd.superproxy.io',
        browser_port: config.browser_port || '9222'
      };
      console.log(`[SCHEDULER] ✓ Search Campaign - Browser API Zone: ${config.browser_zone}`);
      console.log(`[SCHEDULER]   - Customer ID: ${customerId ? 'YES' : 'NO'}`);
      console.log(`[SCHEDULER]   - Username: ${config.browser_username ? 'YES' : 'NO'}`);
      console.log(`[SCHEDULER]   - Password: ${config.browser_password ? 'YES' : 'NO'}`);
    } else {
      console.error(`[SCHEDULER] ✗ Search campaign ${campaign.id} missing Browser API credentials`);
      return; // Cannot proceed without Browser API for search campaigns
    }
  } else {
    // Direct campaigns use Luna Proxy exclusively
    if (campaign.proxy_username && campaign.proxy_password) {
      lunaProxyConfig = {
        proxy: `http://${campaign.proxy_host || 'pr.lunaproxy.com'}:${campaign.proxy_port || '12233'}`,
        proxyUsername: campaign.proxy_username,
        proxyPassword: campaign.proxy_password
      };
      console.log(`[SCHEDULER] ✓ Direct Campaign - Luna Proxy: ${campaign.proxy_host}`);
    } else {
      console.error(`[SCHEDULER] ✗ Direct campaign ${campaign.id} missing Luna proxy credentials`);
      return; // Cannot proceed without Luna credentials for direct campaigns
    }
  }

  const getGeoCode = (location: string) => {
    const geoMap: Record<string, string> = {
      'US': 'us', 'CA': 'ca', 'GB': 'gb', 'DE': 'de', 'FR': 'fr',
      'AU': 'au', 'JP': 'jp', 'IN': 'in', 'BR': 'br', 'MX': 'mx'
    };
    return geoMap[location] || 'us';
  };

  for (let i = 0; i < sessionsToRun; i++) {
    const sessionId = crypto.randomUUID();
    const geoLocation = targetGeoLocations[Math.floor(Math.random() * targetGeoLocations.length)];
    
    // Traffic source is determined by campaign type
    const trafficSource = campaignType; // 'search' or 'direct'
    const searchKeyword = campaignType === 'search' && searchKeywords.length > 0
      ? searchKeywords[Math.floor(Math.random() * searchKeywords.length)]
      : null;

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    let proxyIP = 'None';
    let proxyType = 'none';

    // Set proxy info based on campaign type
    if (campaignType === 'search' && browserApiConfig) {
      proxyIP = `Browser API (${browserApiConfig.browser_zone})`;
      proxyType = 'browser_api';
    } else if (campaignType === 'direct' && lunaProxyConfig) {
      proxyIP = lunaProxyConfig.proxy;
      proxyType = 'luna_residential';
    }

    const shouldBounce = Math.random() * 100 < bounceRate;
    const bounceDuration = shouldBounce ? Math.floor(Math.random() * 4000) + 1000 : null;

    const sessionDuration = Math.floor(Math.random() * (sessionDurationMax - sessionDurationMin + 1)) + sessionDurationMin;

    await supabase.from('bot_sessions').insert({
      id: sessionId,
      campaign_id: campaign.id,
      status: 'running',
      user_agent: userAgent,
      geo_location: geoLocation,
      proxy_type: proxyType,
      traffic_source: trafficSource,
      search_keyword: searchKeyword,
      referrer: trafficSource === 'search' ? `https://www.google.com/search?q=${searchKeyword}` : null,
      is_bounced: shouldBounce,
      bounce_duration_ms: bounceDuration,
      session_duration_sec: sessionDuration,
      started_at: new Date().toISOString(),
    });

    const waitTime = shouldBounce ? bounceDuration : sessionDuration;

    const requestPayload: any = {
      url: campaign.target_url,
      actions: [{ type: 'wait', duration: waitTime }],
      geoLocation: geoLocation,
      waitUntil: 'networkidle2',
      extensionCrxUrl: extensionCrxUrl,
      extensionId: extensionCrxUrl, // Pass as extensionId for automatic download
      userJourney: shouldBounce ? [] : (userJourney || []),
      sessionId: sessionId,
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      customReferrer: customReferrer || null,
      sessionDurationMin: campaign.session_duration_min || 30,
      sessionDurationMax: campaign.session_duration_max || 120,
      userId: campaign.user_id,
      campaignType: campaignType, // Add campaign type to payload
    };

    // Add credentials based on campaign type
    if (campaignType === 'search' && browserApiConfig) {
      requestPayload.browser_api_token = browserApiConfig.browser_api_token;
      requestPayload.browser_zone = browserApiConfig.browser_zone;
      requestPayload.browser_customer_id = browserApiConfig.browser_customer_id;
      requestPayload.browser_username = browserApiConfig.browser_username;
      requestPayload.browser_password = browserApiConfig.browser_password;
      requestPayload.browser_endpoint = browserApiConfig.browser_endpoint;
      requestPayload.browser_port = browserApiConfig.browser_port;
      requestPayload.searchKeyword = searchKeyword; // Required for search campaigns
      
      console.log(`[SCHEDULER] Session ${sessionId.substring(0, 8)} - Search campaign via Browser API (keyword: ${searchKeyword})`);
    } else if (campaignType === 'direct' && lunaProxyConfig) {
      requestPayload.proxy = lunaProxyConfig.proxy;
      requestPayload.proxyUsername = lunaProxyConfig.proxyUsername;
      requestPayload.proxyPassword = lunaProxyConfig.proxyPassword;
      
      console.log(`[SCHEDULER] Session ${sessionId.substring(0, 8)} - Direct campaign via Luna Proxy`);
    }

    fetch(`${puppeteerServerUrl}/api/automate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    }).catch(() => {});

    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: 'pageview',
      page_url: campaign.target_url,
      timestamp: new Date().toISOString(),
    });
  }
}
