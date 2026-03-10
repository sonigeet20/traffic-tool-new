const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: existingCampaign } = await supabase
    .from('campaigns')
    .select('user_id')
    .limit(1)
    .single();
  
  const userId = existingCampaign.user_id;
  
  console.log('Creating 100-session campaign...');
  
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      name: 'HIGH VOLUME: 100 Sessions - ' + new Date().toLocaleTimeString(),
      target_url: 'https://techdim.com/',
      user_id: userId,
      total_sessions: 100,
      status: 'active',
      campaign_type: 'direct',
      proxy_host: 'brd.superproxy.io',
      proxy_port: '33335',
      proxy_username: 'brd-customer-hl_a908b07a-zone-isp',
      proxy_password: 'mihmos3ifhay',
      proxy_provider: 'brightdata',
      proxy_override_enabled: true
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n✅ Campaign Created!');
  console.log('ID:', campaign.id);
  console.log('Sessions:', campaign.total_sessions);
  console.log('Proxy: Bright Data port 33335');
  console.log('\n🔥 Sessions starting in ~1 minute\n');
  
  require('fs').writeFileSync('/tmp/bulk_campaign_id.txt', campaign.id);
})();
