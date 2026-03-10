/**
 * SEO+ Rank Crawler - Edge Function
 * 
 * Smart ranking crawler that:
 * 1. Fetches all active SEO projects
 * 2. Batches keywords by tier (daily top 20, 3x/week 20-50, weekly 50+)
 * 3. Calls backend /api/seo/crawl-rankings for each batch
 * 4. Stores results in seo_rank_snapshots
 * 5. Updates seo_keywords with current rank
 * 6. Triggers rank alerts for significant changes
 * 
 * Scheduled via cron: 
 * - Daily at 8am UTC (top tier crawl)
 * - 3x/week (Mon/Wed/Fri) for mid tier
 * - Weekly Sunday for bottom tier
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const BACKEND_URL = Deno.env.get('BACKEND_URL') || 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CrawlTierConfig {
  tier: string;
  schedule: string; // cron expression
  shouldCrawlToday: boolean;
}

/**
 * Determine if we should crawl this tier today based on smart scheduling
 */
function shouldCrawlTier(tier: string, today: Date): boolean {
  const dayOfWeek = today.getUTCDay(); // 0=Sunday, 6=Saturday
  const dayOfMonth = today.getUTCDate();

  switch (tier) {
    case 'tier1':
      // Tier 1: Daily crawls (top 20 keywords)
      return true;
    
    case 'tier2':
      // Tier 2: 3x/week (Monday, Wednesday, Friday) - keywords 20-50
      return [1, 3, 5].includes(dayOfWeek);
    
    case 'tier3':
      // Tier 3: Weekly (Sundays) - keywords 50+
      return dayOfWeek === 0;
    
    default:
      return false;
  }
}

/**
 * Get all keywords to crawl for a project based on tier and schedule
 */
async function getKeywordsToCrawl(projectId: string, today: Date) {
  const { data: keywords, error } = await supabase
    .from('seo_keywords')
    .select('id, keyword, tier, current_rank, target_rank, status')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .order('tier', { ascending: true });

  if (error) {
    console.error(`Error fetching keywords: ${error.message}`);
    return { tier1: [], tier2: [], tier3: [] };
  }

  // Group by tier and filter by schedule
  const grouped = {
    tier1: [] as typeof keywords,
    tier2: [] as typeof keywords,
    tier3: [] as typeof keywords
  };

  keywords?.forEach(kw => {
    const tier = kw.tier || 'tier2';
    if (shouldCrawlTier(tier, today)) {
      grouped[tier as keyof typeof grouped].push(kw);
    }
  });

  return grouped;
}

/**
 * Fetch Browser API credentials from project
 */
async function getBrowserAPICredentials(projectId: string, userId: string) {
  const { data: campaigns, error } = await supabase
    .from('seo_campaigns')
    .select('browser_customer_id, browser_username, browser_password, browser_zone')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .not('browser_customer_id', 'is', null)
    .limit(1)
    .single();

  if (error || !campaigns) {
    console.warn(`No Browser API credentials found for project ${projectId}`);
    return null;
  }

  return campaigns;
}

/**
 * Call backend /api/seo/crawl-rankings
 */
async function crawlKeywordRankings(
  projectId: string,
  keywords: any[],
  credentials: any,
  geoLocation: string,
  sessionId: string
) {
  console.log(`[CRAWLER] Crawling ${keywords.length} keywords for project ${projectId}`);

  try {
    const response = await fetch(`${BACKEND_URL}/api/seo/crawl-rankings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        keywords: keywords.map(kw => ({
          id: kw.id,
          keyword: kw.keyword,
          targetDomain: 'example.com' // Would come from project settings
        })),
        geoLocation,
        deviceType: 'desktop',
        sessionId,
        browser_customer_id: credentials.browser_customer_id,
        browser_username: credentials.browser_username,
        browser_password: credentials.browser_password,
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_SERVICE_ROLE_KEY
      })
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`[CRAWLER] Backend request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Store ranking snapshot in database
 */
async function storeRankingSnapshot(
  projectId: string,
  keywordId: string,
  userId: string,
  rankData: any
) {
  const { data, error } = await supabase
    .from('seo_rank_snapshots')
    .insert({
      project_id: projectId,
      keyword_id: keywordId,
      user_id: userId,
      rank_position: rankData.currentRank,
      rank_url: rankData.rankingData?.targetUrl || null,
      rank_title: rankData.rankingData?.targetTitle || null,
      search_engine: 'google',
      snapshot_date: new Date().toISOString().split('T')[0],
      snapshot_time: new Date().toISOString(),
      crawl_method: 'browser_api'
    })
    .select()
    .single();

  if (error) {
    console.error(`Error storing snapshot: ${error.message}`);
    return null;
  }

  return data;
}

/**
 * Update keyword's current rank
 */
async function updateKeywordRank(keywordId: string, newRank: number | null) {
  const { error } = await supabase
    .from('seo_keywords')
    .update({
      current_rank: newRank,
      current_rank_updated_at: new Date().toISOString()
    })
    .eq('id', keywordId);

  if (error) {
    console.error(`Error updating keyword: ${error.message}`);
  }
}

/**
 * Create rank alert if significant change detected
 */
async function checkAndCreateAlert(
  projectId: string,
  keywordId: string,
  userId: string,
  newRank: number | null,
  previousRank: number | null
) {
  if (newRank === null || previousRank === null) return;

  const rankChange = previousRank - newRank;
  
  // Only alert on significant changes
  if (Math.abs(rankChange) >= 5) {
    const alertType = rankChange > 0 ? 'rank_gain' : 'rank_drop';
    
    const { error } = await supabase
      .from('seo_rank_alerts')
      .insert({
        project_id: projectId,
        keyword_id: keywordId,
        user_id: userId,
        alert_type: alertType,
        trigger_description: `Rank ${rankChange > 0 ? 'improved' : 'dropped'} from #${previousRank} to #${newRank}`,
        previous_rank: previousRank,
        new_rank: newRank,
        rank_change: rankChange
      });

    if (!error) {
      console.log(`[ALERT] Created ${alertType} alert: #${previousRank} → #${newRank}`);
    }
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('OK', { headers: corsHeaders });
  }

  try {
    console.log(`[CRAWLER] Starting SEO rank crawl cycle at ${new Date().toISOString()}`);

    const today = new Date();
    const sessionId = crypto.randomUUID();

    // Get all active projects
    const { data: projects, error: projectsError } = await supabase
      .from('seo_projects')
      .select('id, user_id, name, target_country, crawl_frequency')
      .eq('status', 'active');

    if (projectsError || !projects || projects.length === 0) {
      console.log('[CRAWLER] No active projects to crawl');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active projects',
        projectsCrawled: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log(`[CRAWLER] Found ${projects.length} active projects`);

    const results = {
      projectsCrawled: 0,
      keywordsCrawled: 0,
      snapshots: 0,
      errors: 0,
      projects: [] as any[]
    };

    // Process each project
    for (const project of projects) {
      console.log(`[CRAWLER] Processing project: ${project.name}`);

      try {
        // Get credentials
        const credentials = await getBrowserAPICredentials(project.id, project.user_id);
        if (!credentials) {
          console.warn(`[CRAWLER] Skipping ${project.name} - no Browser API credentials`);
          continue;
        }

        // Get keywords to crawl by tier
        const keywordsByTier = await getKeywordsToCrawl(project.id, today);
        
        // Crawl each tier
        const projectResult = {
          projectId: project.id,
          projectName: project.name,
          tiersCrawled: [] as any[]
        };

        for (const tier of ['tier1', 'tier2', 'tier3'] as const) {
          const keywords = keywordsByTier[tier];
          if (keywords.length === 0) continue;

          console.log(`[CRAWLER] Tier ${tier}: ${keywords.length} keywords`);

          try {
            // Crawl this tier
            const crawlResult = await crawlKeywordRankings(
              project.id,
              keywords,
              credentials,
              project.target_country || 'US',
              sessionId
            );

            // Store snapshots and update keyword ranks
            for (const rankResult of crawlResult.results) {
              if (rankResult.success) {
                // Store snapshot
                await storeRankingSnapshot(
                  project.id,
                  rankResult.keywordId,
                  project.user_id,
                  rankResult
                );

                // Update keyword
                const oldRank = keywords.find(k => k.id === rankResult.keywordId)?.current_rank;
                await updateKeywordRank(rankResult.keywordId, rankResult.currentRank);
                
                // Check for alerts
                if (oldRank) {
                  await checkAndCreateAlert(
                    project.id,
                    rankResult.keywordId,
                    project.user_id,
                    rankResult.currentRank,
                    oldRank
                  );
                }

                results.snapshots++;
              } else {
                results.errors++;
              }
            }

            results.keywordsCrawled += keywords.length;
            projectResult.tiersCrawled.push({
              tier,
              keywords: keywords.length,
              success: crawlResult.successCount === keywords.length
            });

          } catch (error) {
            console.error(`[CRAWLER] Error crawling tier ${tier}: ${error.message}`);
            results.errors++;
          }
        }

        results.projectsCrawled++;
        results.projects.push(projectResult);

      } catch (error) {
        console.error(`[CRAWLER] Error processing project ${project.name}: ${error.message}`);
        results.errors++;
      }
    }

    console.log(`[CRAWLER] Cycle complete: ${results.projectsCrawled} projects, ${results.keywordsCrawled} keywords, ${results.snapshots} snapshots`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Ranking crawl completed',
      sessionId,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error(`[CRAWLER] Fatal error: ${error.message}`);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
