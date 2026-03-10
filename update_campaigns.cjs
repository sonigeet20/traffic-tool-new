const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateCampaigns() {
  // First, get all campaigns
  const { data: campaigns, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, name, proxy_host, proxy_port, proxy_username, proxy_password, status, campaign_type');
  
  if (fetchError) {
    console.error('Error fetching campaigns:', fetchError);
    return;
  }
  
  console.log(`\n📊 Found ${campaigns.length} campaigns:\n`);
  campaigns.forEach(c => {
    console.log(`${c.name} (${c.status}) - Type: ${c.campaign_type || 'direct'}`);
    console.log(`  Current: ${c.proxy_host}:${c.proxy_port}`);
    console.log(`  Password: ${c.proxy_password?.substring(0,5)}...`);
  });
  
  // Update all campaigns to use Bright Data port 33335 and new password
  const { data: updated, error: updateError } = await supabase
    .from('campaigns')
    .update({
      proxy_host: 'brd.superproxy.io',
      proxy_port: 33335,
      proxy_username: 'brd-customer-hl_a908b07a-zone-isp',
      proxy_password: 'mihmos3ifhay',
      proxy_provider: 'brightdata'
    })
    .neq('status', 'cancelled')
    .select();
  
  if (updateError) {
    console.error('\n❌ Error updating campaigns:', updateError);
  } else {
    console.log(`\n✅ Successfully updated ${updated.length} campaigns to Bright Data config:`);
    console.log('   Host: brd.superproxy.io');
    console.log('   Port: 33335');
    console.log('   Username: brd-customer-hl_a908b07a-zone-isp');
    console.log('   Password: mihmos3ifhay');
  }
  
  // Get first user ID
  const { data: users } = await supabase
    .from('auth.users')
    .select('id')
    .limit(1);
  
  const userId = users?.[0]?.id;
  
  if (!userId) {
    console.log('\n⚠️  Could not find user ID for settings update');
    return;
  }
  
  // Update settings table for default proxy
  console.log('\n🔧 Updating default proxy settings...');
  
  const settingsUpdates = [
    { key: 'proxy_provider', value: 'brightdata' },
    { key: 'proxy_host', value: 'brd.superproxy.io' },
    { key: 'proxy_port', value: '33335' },
    { key: 'proxy_username', value: 'brd-customer-hl_a908b07a-zone-isp' },
    { key: 'proxy_password', value: 'mihmos3ifhay' },
    { key: 'brightdata_zone', value: 'isp' },
    { key: 'brightdata_customer_id', value: 'hl_a908b07a' }
  ];
  
  for (const setting of settingsUpdates) {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: setting.key,
        value: setting.value,
        user_id: userId
      }, {
        onConflict: 'user_id,key'
      });
    
    if (error) {
      console.log(`  ⚠️  Failed to update ${setting.key}:`, error.message);
    } else {
      console.log(`  ✓ ${setting.key} = ${setting.value}`);
    }
  }
}

updateCampaigns().catch(console.error);
