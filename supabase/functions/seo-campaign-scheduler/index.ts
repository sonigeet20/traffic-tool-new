import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const backendUrl = Deno.env.get('BACKEND_URL') || 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000';
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SEO+ SCHEDULER] Starting at:', new Date().toISOString());

    // Get active SEO+ campaigns
    const { data: campaigns, error } = await supabase
      .from('seo_campaigns')
      .select('*, seo_projects(website_url, target_country)')
      .eq('status', 'running');

    if (error || !campaigns || campaigns.length === 0) {
      console.log('[SEO+ SCHEDULER] No active campaigns');
      return new Response(
        JSON.stringify({ success: true, message: 'No active campaigns', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEO+ SCHEDULER] Found ${campaigns.length} active SEO+ campaigns`);
    const results = [];

    for (const campaign of campaigns) {
      try {
        // Get Browser API credentials from settings
        const { data: credentials } = await supabase
          .from('settings')
          .select('value')
          .eq('user_id', campaign.user_id)
          .in('key', ['browser_customer_id', 'browser_username', 'browser_password'])
          .limit(3);

        const browserCreds = credentials?.reduce((acc, c) => {
          acc[c.key] = c.value;
          return acc;
        }, {} as Record<string, string>);

        if (!browserCreds || !browserCreds.browser_customer_id) {
          console.log(`[SEO+ SCHEDULER] Campaign ${campaign.id}: Missing Browser API credentials`);
          continue;
        }

        // Check current progress
        const { count: totalSessions } = await supabase
          .from('seo_click_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id);

        if (totalSessions >= campaign.total_clicks_goal) {
          console.log(`[SEO+ SCHEDULER] Campaign ${campaign.id}: Goal reached (${totalSessions}/${campaign.total_clicks_goal})`);
          await supabase
            .from('seo_campaigns')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id);
          continue;
        }

        // Get sessions created today
        const today = new Date().toISOString().split('T')[0];
        const { count: todaySessions } = await supabase
          .from('seo_click_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .gte('executed_at', `${today}T00:00:00`);

        const dailyBudget = campaign.daily_click_budget || 10;
        if (todaySessions >= dailyBudget) {
          console.log(`[SEO+ SCHEDULER] Campaign ${campaign.id}: Daily budget reached (${todaySessions}/${dailyBudget})`);
          continue;
        }

        // Calculate sessions to create (max 10 per run)
        const remainingToday = dailyBudget - todaySessions;
        const remainingTotal = campaign.total_clicks_goal - totalSessions;
        const sessionsToCreate = Math.min(10, remainingToday, remainingTotal);

        console.log(`[SEO+ SCHEDULER] Campaign ${campaign.id}: Creating ${sessionsToCreate} sessions`);

        // Get campaign configuration
        const deviceMix = campaign.device_mix || { desktop: 60, mobile: 30, tablet: 10 };
        const geoTargets = campaign.geo_targets || ['US'];
        const impressionRatio = campaign.impression_ratio || 0;
        const maxSerpPages = campaign.max_serp_pages || 1;
        const clickDelayMin = campaign.click_delay_min || 15;
        const clickDelayMax = campaign.click_delay_max || 45;
        const sessionDurationMin = campaign.session_duration_min || 45;
        const sessionDurationMax = campaign.session_duration_max || 180;
        const bounceRateTarget = campaign.bounce_rate_target || 25;
        const pagesPerSessionMin = campaign.pages_per_session_min || 1;
        const pagesPerSessionMax = campaign.pages_per_session_max || 5;
        const scrollDepthTarget = campaign.scroll_depth_target || 75;
        const engagementLevel = campaign.engagement_level || 'medium';

        // Generate device distribution
        const devices = [];
        const totalPercentage = deviceMix.desktop + deviceMix.mobile + deviceMix.tablet;
        for (let i = 0; i < sessionsToCreate; i++) {
          const rand = Math.random() * 100;
          if (rand < (deviceMix.desktop / totalPercentage * 100)) {
            devices.push('desktop');
          } else if (rand < ((deviceMix.desktop + deviceMix.mobile) / totalPercentage * 100)) {
            devices.push('mobile');
          } else {
            devices.push('tablet');
          }
        }

        let sessionsCreated = 0;

        for (let i = 0; i < sessionsToCreate; i++) {
          const sessionId = crypto.randomUUID();
          const deviceType = devices[i];
          const geoLocation = geoTargets[Math.floor(Math.random() * geoTargets.length)];
          
          // Determine if impression-only (no click)
          const isImpressionOnly = Math.random() * 100 < impressionRatio;
          
          // Random SERP page (1 to maxSerpPages)
          const serpPage = Math.floor(Math.random() * maxSerpPages) + 1;
          const serpPosition = Math.floor(Math.random() * 10) + 1;
          
          // Click delay
          const clickDelay = Math.floor(Math.random() * (clickDelayMax - clickDelayMin + 1)) + clickDelayMin;
          
          // Session duration
          const sessionDuration = Math.floor(Math.random() * (sessionDurationMax - sessionDurationMin + 1)) + sessionDurationMin;
          
          // Bounce decision
          const shouldBounce = Math.random() * 100 < bounceRateTarget;
          const pagesVisited = shouldBounce ? 1 : Math.floor(Math.random() * (pagesPerSessionMax - pagesPerSessionMin + 1)) + pagesPerSessionMin;
          
          // Engagement metrics
          let mouseMovements = 0;
          let keyboardEvents = 0;
          let engagementScore = 0.5;
          
          if (engagementLevel === 'low') {
            mouseMovements = Math.floor(Math.random() * 10) + 5;
            keyboardEvents = Math.floor(Math.random() * 3);
            engagementScore = 0.2 + Math.random() * 0.3; // 0.2-0.5
          } else if (engagementLevel === 'medium') {
            mouseMovements = Math.floor(Math.random() * 30) + 20;
            keyboardEvents = Math.floor(Math.random() * 10) + 3;
            engagementScore = 0.4 + Math.random() * 0.3; // 0.4-0.7
          } else { // high
            mouseMovements = Math.floor(Math.random() * 50) + 40;
            keyboardEvents = Math.floor(Math.random() * 20) + 10;
            engagementScore = 0.6 + Math.random() * 0.4; // 0.6-1.0
          }
          
          const scrollDepth = shouldBounce 
            ? Math.floor(Math.random() * 30) + 10 // Bounced: 10-40%
            : Math.floor(Math.random() * 30) + (scrollDepthTarget - 15); // Normal: near target

          // Create session record
          const { error: insertError } = await supabase
            .from('seo_click_sessions')
            .insert({
              id: sessionId,
              campaign_id: campaign.id,
              project_id: campaign.project_id,
              user_id: campaign.user_id,
              keyword_id: campaign.keyword_id,
              search_keyword: campaign.search_keyword,
              clicked_url: campaign.seo_projects?.website_url || '',
              device_type: deviceType,
              geo_location: geoLocation,
              search_impression_only: isImpressionOnly,
              serp_page_number: serpPage,
              serp_position: serpPosition,
              session_duration_sec: sessionDuration,
              bounced: shouldBounce,
              pages_visited: pagesVisited,
              scroll_depth: scrollDepth,
              mouse_movements: mouseMovements,
              keyboard_events: keyboardEvents,
              engagement_score: engagementScore,
              status: 'pending',
              executed_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`[SEO+ SCHEDULER] Failed to insert session ${sessionId}:`, insertError.message);
            continue;
          }

          // Call backend API to execute session
          const payload = {
            sessionId: sessionId,
            campaignId: campaign.id,
            searchKeyword: campaign.search_keyword,
            targetUrl: campaign.seo_projects?.website_url,
            deviceType: deviceType,
            geoLocation: geoLocation,
            impressionOnly: isImpressionOnly,
            maxSerpPages: maxSerpPages,
            clickDelaySeconds: clickDelay,
            sessionDurationSeconds: sessionDuration,
            scrollDepthTarget: scrollDepth,
            engagementLevel: engagementLevel,
            mouseMovements: mouseMovements,
            keyboardEvents: keyboardEvents,
            // Browser API credentials
            browser_customer_id: browserCreds.browser_customer_id,
            browser_username: browserCreds.browser_username,
            browser_password: browserCreds.browser_password,
          };

          // Fire and forget to backend
          fetch(`${backendUrl}/api/seo/click-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch((err) => {
            console.error(`[SEO+ SCHEDULER] Failed to call backend for ${sessionId}:`, err);
          });

          sessionsCreated++;
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update campaign metrics
        await supabase
          .from('seo_campaigns')
          .update({ 
            total_clicks_delivered: totalSessions + sessionsCreated,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          sessionsCreated: sessionsCreated,
          totalSessions: totalSessions + sessionsCreated,
          dailyBudget: dailyBudget,
          totalGoal: campaign.total_clicks_goal,
        });

        console.log(`[SEO+ SCHEDULER] Campaign ${campaign.id}: Created ${sessionsCreated} sessions`);

      } catch (err) {
        console.error(`[SEO+ SCHEDULER] Error processing campaign ${campaign.id}:`, err);
        results.push({
          campaignId: campaign.id,
          error: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: campaigns.length,
        results: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEO+ SCHEDULER] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
