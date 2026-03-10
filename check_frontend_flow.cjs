const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

(async () => {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id,name,status,updated_at')
    .in('status', ['paused','draft'])
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error || !campaigns || campaigns.length === 0) {
    console.error('No paused/draft campaign found', error?.message || '');
    process.exit(1);
  }

  const campaign = campaigns[0];
  console.log('Using campaign:', campaign.id, campaign.name, campaign.status);

  try {
    const startResp = await fetch(`${supabaseUrl}/functions/v1/start-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({ campaignId: campaign.id }),
      signal: AbortSignal.timeout(20000)
    });

    const txt = await startResp.text();
    console.log('start-campaign status:', startResp.status);
    console.log('start-campaign body:', txt.slice(0, 800));
  } catch (err) {
    console.log('start-campaign fetch error:', err.name, err.message);
  }

  await new Promise(r => setTimeout(r, 4000));

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('bot_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .gte('created_at', since);

  console.log('bot_sessions created in last 10m for campaign:', count || 0);
})();
