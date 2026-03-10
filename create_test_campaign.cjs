const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestCampaign() {
  // Get existing user and check campaign structure
  const { data: existingCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1)
    .single();
  
  const userId = existingCampaign.user_id;
  
  console.log('Creating test campaign...');
  
  // Create test campaign matching existing structure
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      name: 'TEST: Bright Data - ' + new Date().toLocaleTimeString(),
      target_url: 'https://techdim.com/',
      user_id: userId,
      total_sessions: 10,
      status: 'active',
      campaign_type: 'direct',
      proxy_host: 'brd.superproxy.io',
      proxy_port: '33335',
      proxy_username: 'brd-customer-hl_a908b07a-zone-isp',
      proxy_password: 'mihmos3ifhay',
      proxy_provider: 'brightdata'
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('\n✅ Test Campaign Created!\n');
  console.log('Campaign ID:', campaign.id);
  console.log('Name:', campaign.name);
  console.log('Target:', campaign.target_url);
  console.log('Sessions:', campaign.total_sessions);
  console.log('\nProxy Config:');
  console.log('  Host:', campaign.proxy_host);
  console.log('  Port:', campaign.proxy_port);
  console.log('  Password:', campaign.proxy_password);
  console.log('\n⏳ Campaign scheduler runs every 1 minute');
  console.log('   Sessions should start within 1-2 minutes\n');
  
  // Save campaign ID for monitoring
  require('fs').writeFileSync('/tmp/test_campaign_id.txt', campaign.id);
  console.log('📝 Campaign ID saved to /tmp/test_campaign_id.txt\n');
}

createTestCampaign().catch(console.error);
