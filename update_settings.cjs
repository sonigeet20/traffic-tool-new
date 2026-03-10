const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSettings() {
  // Query for users from the public schema
  const { data: authData, error: authError } = await supabase.rpc('get_user_id');
  
  if (authError) {
    console.log('Trying alternative method to get user...');
    // Alternative: query settings table to find existing user_id
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('user_id')
      .limit(1);
    
    if (!existingSettings || existingSettings.length === 0) {
      console.log('⚠️  No existing settings found. Will skip settings update.');
      console.log('Settings will be created when user logs in and creates first campaign.');
      return;
    }
    
    const userId = existingSettings[0].user_id;
    console.log(`Found user ID from existing settings: ${userId}\n`);
    
    await updateUserSettings(userId);
  } else {
    await updateUserSettings(authData);
  }
}

async function updateUserSettings(userId) {
  console.log('🔧 Updating default proxy settings for user:', userId);
  
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
      console.log(`  ⚠️  ${setting.key}: ${error.message}`);
    } else {
      console.log(`  ✓ ${setting.key} = ${setting.value}`);
    }
  }
  
  console.log('\n✅ Default proxy settings updated to Bright Data ISP zone');
  console.log('   Luna proxy references removed - Bright Data is now the default');
}

updateSettings().catch(console.error);
