const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAndTestCampaign() {
  console.log('🚀 Creating New Campaign with Bright Data Credentials\n');
  
  // Get the original campaign to copy credentials from
  const { data: originalCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', '067bbb4d-109b-439a-882c-d666526da132')
    .single();
  
  if (!originalCampaign) {
    console.error('❌ Original campaign not found');
    return;
  }
  
  console.log('📋 Copying credentials from:', originalCampaign.name);
  console.log('  Proxy Host:', originalCampaign.proxy_host);
  console.log('  Proxy Port:', originalCampaign.proxy_port);
  console.log('  Proxy Provider:', originalCampaign.proxy_provider);
  console.log('  Proxy Username:', originalCampaign.proxy_username ? '✓ SET' : '✗ NOT SET');
  console.log('  Proxy Password:', originalCampaign.proxy_password ? '✓ SET' : '✗ NOT SET');
  
  // Create new campaign
  const newCampaign = {
    user_id: originalCampaign.user_id,
    name: `Test Bright Data Campaign ${new Date().toISOString().slice(0,19).replace('T', ' ')}`,
    target_url: originalCampaign.target_url || 'https://techdim.com/',
    campaign_type: 'direct',
    status: 'active',
    total_users: 10,
    distribution_period_hours: 1,
    sessions_per_hour: 10,
    distribution_pattern: 'uniform',
    total_sessions: 0,
    
    // Proxy override with Bright Data credentials
    proxy_override_enabled: true,
    proxy_provider: originalCampaign.proxy_provider,
    proxy_username: originalCampaign.proxy_username,
    proxy_password: originalCampaign.proxy_password,
    proxy_host: originalCampaign.proxy_host,
    proxy_port: originalCampaign.proxy_port,
    
    // Traffic settings
    traffic_source_distribution: { direct: 100, search: 0 },
    bounce_rate: 30,
    min_pages_per_session: 1,
    max_pages_per_session: 3,
    
    // Browser settings
    use_browser_automation: false,
    use_serp_api: false,
    use_luna_proxy_search: false,
    use_luna_headful_direct: true,
    
    debug_mode: false
  };
  
  console.log('\n📝 Creating campaign...');
  const { data: created, error: createError } = await supabase
    .from('campaigns')
    .insert([newCampaign])
    .select()
    .single();
  
  if (createError) {
    console.error('❌ Error creating campaign:', createError);
    return;
  }
  
  console.log('✅ Campaign created!');
  console.log('   ID:', created.id);
  console.log('   Name:', created.name);
  console.log('   Status:', created.status);
  console.log('   Total Users:', created.total_users);
  console.log('   Sessions/Hour:', created.sessions_per_hour);
  
  // Wait a moment
  console.log('\n⏳ Waiting 2 seconds before testing...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Trigger scheduler
  console.log('🚀 Triggering scheduler...\n');
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/campaign-scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    const result = await response.json();
    console.log('Scheduler Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Scheduler error:', error.message);
  }
  
  // Wait for sessions to be created
  console.log('\n⏳ Waiting 5 seconds for sessions to be created...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check for sessions
  const { data: sessions, count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact' })
    .eq('campaign_id', created.id)
    .order('created_at', { ascending: false });
  
  console.log('\n📊 RESULTS:');
  console.log('  Sessions created:', count || 0);
  
  if (sessions && sessions.length > 0) {
    console.log('\n✅ SUCCESS! Sessions are being created:');
    sessions.slice(0, 5).forEach((s, i) => {
      console.log(`\n  ${i+1}. Session ${s.id.substring(0, 8)}...`);
      console.log(`     Created: ${s.created_at}`);
      console.log(`     Status: ${s.status}`);
      console.log(`     Traffic: ${s.traffic_source || 'N/A'}`);
      console.log(`     Target URL: ${s.target_url}`);
    });
    
    // Check the campaign counter
    const { data: updated } = await supabase
      .from('campaigns')
      .select('total_sessions')
      .eq('id', created.id)
      .single();
    
    console.log('\n  Campaign total_sessions counter:', updated.total_sessions);
  } else {
    console.log('\n❌ No sessions created yet. Checking for errors...');
    
    // Check session logs
    const { data: logs } = await supabase
      .from('session_logs')
      .select('*')
      .eq('campaign_id', created.id)
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (logs && logs.length > 0) {
      console.log('\n📋 Recent logs:');
      logs.forEach(log => {
        console.log(`  [${log.log_level}] ${log.message}`);
        if (log.error_details) {
          console.log(`    Details:`, JSON.stringify(log.error_details, null, 2));
        }
      });
    }
  }
  
  console.log('\n━'.repeat(80));
  console.log('Campaign ID:', created.id);
  console.log('Monitor this campaign in the UI or check server logs for session execution.');
}

createAndTestCampaign()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
