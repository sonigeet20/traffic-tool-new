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

async function debugCampaign() {
  console.log('🔍 Debugging campaign:', campaignId);
  console.log('━'.repeat(80));
  
  // Get campaign status
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  
  console.log('\n📊 CAMPAIGN STATUS:');
  console.log('  Name:', campaign.name);
  console.log('  Status:', campaign.status);
  console.log('  Is Active:', campaign.is_active);
  console.log('  Sessions per Hour:', campaign.sessions_per_hour);
  console.log('  Total Sessions Run:', campaign.total_sessions || 0);
  
  // Get recent sessions
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log('\n📝 RECENT SESSIONS (Last 20):');
  console.log('  Total sessions found:', sessions?.length || 0);
  
  if (sessions && sessions.length > 0) {
    console.log('\n  Latest 10 sessions:');
    sessions.slice(0, 10).forEach((session, idx) => {
      console.log(`  ${idx + 1}. ${session.created_at} - Status: ${session.status} - Traffic: ${session.traffic_source || 'N/A'}`);
      if (session.error_message) {
        console.log(`     ❌ Error: ${session.error_message}`);
      }
    });
    
    // Count by status
    const statusCounts = sessions.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n  Session Status Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`    ${status}: ${count}`);
    });
    
    // Show errors
    const errored = sessions.filter(s => s.status === 'failed' || s.error_message);
    if (errored.length > 0) {
      console.log('\n  ❌ FAILED SESSIONS WITH ERRORS:');
      errored.slice(0, 5).forEach((session, idx) => {
        console.log(`\n  ${idx + 1}. Session ${session.id}`);
        console.log(`     Created: ${session.created_at}`);
        console.log(`     Status: ${session.status}`);
        console.log(`     Error: ${session.error_message || 'N/A'}`);
      });
    }
  } else {
    console.log('  ⚠️  No sessions found! Campaign might not be running.');
  }
  
  // Check session logs
  const { data: logs } = await supabase
    .from('session_logs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (logs && logs.length > 0) {
    console.log('\n📋 RECENT SESSION LOGS:');
    logs.forEach((log, idx) => {
      console.log(`  ${idx + 1}. [${log.log_level}] ${log.timestamp}`);
      console.log(`     ${log.message}`);
      if (log.error_details) {
        console.log(`     Error Details: ${JSON.stringify(log.error_details, null, 2)}`);
      }
    });
  }
  
  // Check if campaign is scheduled properly
  console.log('\n⏰ SCHEDULING INFO:');
  console.log('  Sessions per hour:', campaign.sessions_per_hour);
  console.log('  Total users:', campaign.total_users);
  console.log('  Distribution period:', campaign.distribution_period_hours, 'hours');
  console.log('  Expected total sessions:', Math.ceil(campaign.total_users / (campaign.distribution_period_hours / 24)));
  
  // Check last scheduler run
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('created_at')
    .eq('campaign_id', campaignId)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
  
  console.log('\n  Sessions created in last hour:', recentSessions?.length || 0);
  if (recentSessions && recentSessions.length > 0) {
    console.log('  Most recent:', recentSessions[0].created_at);
  }
}

debugCampaign()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
