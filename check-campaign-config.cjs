const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const campaignId = '067bbb4d-109b-439a-882c-d666526da132';

async function checkCampaignConfig() {
  console.log('🔍 Checking configuration for campaign:', campaignId);
  console.log('━'.repeat(80));
  
  // Get campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  
  if (campaignError || !campaign) {
    console.error('❌ Campaign not found:', campaignError);
    return;
  }
  
  console.log('\n📋 CAMPAIGN DETAILS:');
  console.log('  Name:', campaign.name);
  console.log('  Type:', campaign.campaign_type || 'direct');
  console.log('  Target URL:', campaign.target_url);
  console.log('  User ID:', campaign.user_id);
  
  console.log('\n🔑 OVERRIDE SETTINGS:');
  console.log('  Override Enabled:', campaign.proxy_override_enabled || false);
  console.log('  Proxy Username:', campaign.proxy_username ? '✓ SET' : '✗ NOT SET');
  console.log('  Proxy Password:', campaign.proxy_password ? '✓ SET' : '✗ NOT SET');
  console.log('  Proxy Host:', campaign.proxy_host || 'NOT SET');
  console.log('  Proxy Port:', campaign.proxy_port || 'NOT SET');
  console.log('  Proxy Provider:', campaign.proxy_provider || 'NOT SET');
  
  console.log('\n🌐 BROWSER AUTOMATION SETTINGS:');
  console.log('  Use Browser Automation:', campaign.use_browser_automation || false);
  console.log('  Use Luna Proxy Search:', campaign.use_luna_proxy_search || false);
  console.log('  Use SERP API:', campaign.use_serp_api || false);
  console.log('  SERP API Provider:', campaign.serp_api_provider || 'NOT SET');
  console.log('  Use Luna Headful Direct:', campaign.use_luna_headful_direct || false);
  
  // Get user's Bright Data configuration
  const { data: brightDataConfig, error: brightDataError } = await supabase
    .from('bright_data_serp_config')
    .select('*')
    .eq('user_id', campaign.user_id)
    .maybeSingle();
  
  console.log('\n🔷 USER\'S BRIGHT DATA CONFIG (from bright_data_serp_config):');
  if (brightDataConfig) {
    console.log('  Enabled:', brightDataConfig.enabled || false);
    console.log('  Browser Customer ID:', brightDataConfig.browser_customer_id ? '✓ SET' : '✗ NOT SET');
    console.log('  Browser Username:', brightDataConfig.browser_username ? '✓ SET' : '✗ NOT SET');
    console.log('  Browser Password:', brightDataConfig.browser_password ? '✓ SET' : '✗ NOT SET');
    console.log('  Browser API Token:', brightDataConfig.browser_api_token ? '✓ SET' : '✗ NOT SET');
    console.log('  Browser Zone:', brightDataConfig.browser_zone || 'NOT SET');
    console.log('  Browser Endpoint:', brightDataConfig.browser_endpoint || 'NOT SET');
    console.log('  Browser Port:', brightDataConfig.browser_port || 'NOT SET');
  } else {
    console.log('  ✗ No Bright Data configuration found');
  }
  
  // Get user's default proxy settings
  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', campaign.user_id)
    .maybeSingle();
  
  console.log('\n⚙️  USER\'S DEFAULT PROXY SETTINGS (from settings):');
  if (settings) {
    console.log('  Default Proxy Provider:', settings.default_proxy_provider || 'NOT SET');
    console.log('  Default Proxy Username:', settings.default_proxy_username ? '✓ SET' : '✗ NOT SET');
    console.log('  Default Proxy Password:', settings.default_proxy_password ? '✓ SET' : '✗ NOT SET');
    console.log('  Default Proxy Host:', settings.default_proxy_host || 'NOT SET');
    console.log('  Default Proxy Port:', settings.default_proxy_port || 'NOT SET');
  } else {
    console.log('  ✗ No default proxy settings found');
  }
  
  // Final determination
  console.log('\n' + '━'.repeat(80));
  console.log('📊 CREDENTIAL SOURCE DETERMINATION:');
  console.log('━'.repeat(80));
  
  const campaignType = campaign.campaign_type || 'direct';
  
  if (campaignType === 'direct') {
    console.log('Campaign Type: DIRECT TRAFFIC');
    console.log('');
    
    const hasOverride = campaign.proxy_override_enabled || 
                       (campaign.proxy_username && campaign.proxy_password);
    
    if (hasOverride) {
      console.log('✅ USING CAMPAIGN OVERRIDE');
      console.log('   This campaign uses its own proxy credentials specified in the campaign settings.');
      console.log('   Provider:', campaign.proxy_provider || 'NOT SPECIFIED');
      console.log('   Host:', campaign.proxy_host || 'NOT SET');
      console.log('   Port:', campaign.proxy_port || 'NOT SET');
      console.log('');
      console.log('❌ NOT USING Bright Data from bright_data_serp_config');
      console.log('   Direct traffic campaigns do not use Bright Data Browser API credentials.');
      console.log('   They use proxy credentials (Luna/SmartProxy/etc.) instead.');
    } else {
      console.log('✅ USING DEFAULT SETTINGS');
      console.log('   This campaign uses proxy credentials from the Settings table.');
      if (settings) {
        console.log('   Provider:', settings.default_proxy_provider || 'NOT SET');
        console.log('   Host:', settings.default_proxy_host || 'NOT SET');
        console.log('   Port:', settings.default_proxy_port || 'NOT SET');
      }
      console.log('');
      console.log('❌ NOT USING Bright Data from bright_data_serp_config');
      console.log('   Direct traffic campaigns do not use Bright Data Browser API credentials.');
      console.log('   They use proxy credentials (Luna/SmartProxy/etc.) instead.');
    }
  } else if (campaignType === 'search') {
    console.log('Campaign Type: SEARCH TRAFFIC');
    console.log('');
    console.log('✅ USING Bright Data Browser API');
    console.log('   Search campaigns ALWAYS use Bright Data Browser API credentials');
    console.log('   from the bright_data_serp_config table.');
    console.log('');
    if (brightDataConfig && brightDataConfig.enabled) {
      console.log('✅ Bright Data credentials are configured and enabled');
    } else {
      console.log('❌ WARNING: Bright Data credentials not configured or disabled!');
    }
  }
  
  console.log('\n' + '━'.repeat(80));
  console.log('SUMMARY:');
  console.log('━'.repeat(80));
  
  if (campaignType === 'direct') {
    const hasOverride = campaign.proxy_override_enabled || 
                       (campaign.proxy_username && campaign.proxy_password);
    
    if (hasOverride) {
      console.log('🎯 This campaign is using OVERRIDDEN proxy credentials.');
      console.log('   Source: Campaign-specific settings');
      console.log('   Type: Regular proxy (Luna/SmartProxy/etc.)');
      console.log('   NOT using Bright Data Browser API');
    } else {
      console.log('🎯 This campaign is using DEFAULT proxy credentials.');
      console.log('   Source: Settings table');
      console.log('   Type: Regular proxy (Luna/SmartProxy/etc.)');
      console.log('   NOT using Bright Data Browser API');
    }
  } else {
    console.log('🎯 This campaign is using Bright Data Browser API.');
    console.log('   Source: bright_data_serp_config table');
    console.log('   For search traffic only');
  }
}

checkCampaignConfig()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
