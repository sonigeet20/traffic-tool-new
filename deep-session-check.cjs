const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const campaignId = '067bbb4d-109b-439a-882c-d666526da132';

async function deepCheck() {
  console.log('🔍 Deep Session Check\n');
  
  // Check ALL sessions for this campaign (no date filter)
  const { data: allSessions, count } = await supabase
    .from('sessions')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId);
  
  console.log('📊 TOTAL SESSIONS IN DATABASE:', count);
  
  if (allSessions && allSessions.length > 0) {
    console.log('\nMost recent 10 sessions:');
    const sorted = allSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    sorted.slice(0, 10).forEach((s, i) => {
      console.log(`${i+1}. ${s.id}`);
      console.log(`   Created: ${s.created_at}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Traffic: ${s.traffic_source || 'N/A'}`);
      console.log(`   Started: ${s.started_at || 'N/A'}`);
      console.log(`   Completed: ${s.completed_at || 'N/A'}`);
      if (s.error_message) console.log(`   Error: ${s.error_message}`);
      console.log('');
    });
    
    // Check status distribution
    const statuses = {};
    allSessions.forEach(s => {
      statuses[s.status] = (statuses[s.status] || 0) + 1;
    });
    
    console.log('Status Distribution:');
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Check date range
    const dates = allSessions.map(s => new Date(s.created_at));
    const oldest = new Date(Math.min(...dates));
    const newest = new Date(Math.max(...dates));
    
    console.log('\nDate Range:');
    console.log('  Oldest:', oldest.toISOString());
    console.log('  Newest:', newest.toISOString());
    console.log('  Age of newest:', Math.round((Date.now() - newest) / 1000 / 60), 'minutes ago');
  } else {
    console.log('❌ NO SESSIONS FOUND AT ALL');
    console.log('\nThis means:');
    console.log('1. Campaign has never created sessions, OR');
    console.log('2. All sessions were deleted, OR');
    console.log('3. There\'s a database issue');
  }
  
  // Check campaign table total_sessions field
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('total_sessions, name, status')
    .eq('id', campaignId)
    .single();
  
  console.log('\n📈 CAMPAIGN COUNTER:');
  console.log('  total_sessions field:', campaign.total_sessions || 0);
  console.log('  Actual sessions in DB:', count || 0);
  console.log('  Discrepancy:', (campaign.total_sessions || 0) - (count || 0));
  
  if ((campaign.total_sessions || 0) > (count || 0)) {
    console.log('\n⚠️  MISMATCH DETECTED!');
    console.log('The campaign thinks it has', campaign.total_sessions, 'sessions');
    console.log('But only', count, 'sessions exist in the database');
    console.log('This suggests sessions are being created but then deleted or lost');
  }
}

deepCheck()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
