const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const campaignId = '067bbb4d-109b-439a-882c-d666526da132';

async function checkScheduler() {
  console.log('🔍 Checking Scheduler Status\n');
  
  // Check campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  
  console.log('📊 CAMPAIGN:', campaign.name);
  console.log('  ID:', campaign.id);
  console.log('  Status:', campaign.status);
  console.log('  User ID:', campaign.user_id);
  console.log('  Sessions/hour:', campaign.sessions_per_hour);
  console.log('  Total users:', campaign.total_users);
  console.log('  Distribution hours:', campaign.distribution_period_hours);
  console.log('  Campaign Type:', campaign.campaign_type || 'direct');
  console.log('  Proxy Override:', campaign.proxy_override_enabled || false);
  
  // Try to manually trigger the scheduler
  console.log('\n🚀 Testing scheduler invocation...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/campaign-scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    const result = await response.text();
    console.log('\n✅ Scheduler Response:');
    console.log('Status:', response.status);
    console.log('Response:', result.substring(0, 500));
    
    if (!response.ok) {
      console.error('❌ Scheduler returned error status:', response.status);
    }
  } catch (error) {
    console.error('❌ Failed to invoke scheduler:', error.message);
  }
  
  // Check recent sessions again after a short delay
  console.log('\n⏳ Waiting 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const { data: newSessions } = await supabase
    .from('sessions')
    .select('id, created_at, status, traffic_source')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n📝 Sessions after scheduler call:', newSessions?.length || 0);
  if (newSessions && newSessions.length > 0) {
    newSessions.forEach(s => {
      console.log(`  - ${s.created_at} | ${s.status} | ${s.traffic_source || 'N/A'}`);
    });
  }
}

checkScheduler()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
