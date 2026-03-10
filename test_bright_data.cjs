const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTest() {
  console.log('🧪 Creating test campaign with Bright Data config...\n');
  
  // Get user
  const { data: existingSettings } = await supabase
    .from('campaigns')
    .select('user_id')
    .limit(1);
  
  const userId = existingSettings[0].user_id;
  
  // Create test campaign
  const { data: campaign, error: createError } = await supabase
    .from('campaigns')
    .insert({
      name: `Bright Data Test ${new Date().toLocaleString()}`,
      target_url: 'https://techdim.com/',
      user_id: userId,
      total_sessions: 50,
      sessions_per_day: 50,
      status: 'active',
      campaign_type: 'direct',
      proxy_host: 'brd.superproxy.io',
      proxy_port: 33335,
      proxy_username: 'brd-customer-hl_a908b07a-zone-isp',
      proxy_password: 'mihmos3ifhay',
      proxy_provider: 'brightdata',
      geo_location: 'US'
    })
    .select()
    .single();
  
  if (createError) {
    console.error('❌ Error creating campaign:', createError);
    return;
  }
  
  console.log('✅ Test Campaign Created Successfully!\n');
  console.log('Campaign Details:');
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Name: ${campaign.name}`);
  console.log(`   Target: ${campaign.target_url}`);
  console.log(`   Sessions: ${campaign.total_sessions}`);
  console.log('\nProxy Configuration:');
  console.log(`   Provider: Bright Data ISP`);
  console.log(`   Host: ${campaign.proxy_host}`);
  console.log(`   Port: ${campaign.proxy_port}`);
  console.log(`   Username: ${campaign.proxy_username}`);
  console.log(`   Password: ${campaign.proxy_password}`);
  console.log('\n✨ This campaign uses the WORKING configuration (port 33335)');
  console.log('   Sessions will navigate successfully and appear in Google Analytics');
  console.log('\n⏳ Campaign scheduler will automatically start sessions within 1-2 minutes');
}

runTest().catch(console.error);
