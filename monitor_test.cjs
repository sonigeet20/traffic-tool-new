const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = require('fs').readFileSync('/tmp/test_campaign_id.txt', 'utf8');

async function monitorSessions() {
  console.log('🔍 Monitoring campaign:', campaignId);
  console.log('═'.repeat(80));
  
  const { data: sessions, error } = await supabase
    .from('bot_sessions')
    .select('id, status, target_site_reached, error_message, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!sessions || sessions.length === 0) {
    console.log('\n⏳ No sessions created yet...');
    console.log('   Campaign scheduler should pick this up within 1-2 minutes');
    console.log('   Run this script again in a minute\n');
    return;
  }
  
  console.log(`\n📊 Found ${sessions.length} sessions:\n`);
  
  const completed = sessions.filter(s => s.status === 'completed').length;
  const reached = sessions.filter(s => s.target_site_reached).length;
  const failed = sessions.filter(s => s.error_message).length;
  const pending = sessions.filter(s => s.status === 'pending' || s.status === 'running').length;
  
  console.log('Status Summary:');
  console.log(`  ✅ Completed: ${completed}`);
  console.log(`  🎯 Reached Target: ${reached}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏳ Pending/Running: ${pending}`);
  
  if (completed > 0) {
    const successRate = ((reached / completed) * 100).toFixed(1);
    console.log(`\n📈 Success Rate: ${successRate}% (${reached}/${completed})`);
  }
  
  console.log('\nRecent Sessions:');
  sessions.slice(0, 5).forEach((s, i) => {
    const age = Math.round((Date.now() - new Date(s.created_at).getTime()) / 1000);
    const status = s.status === 'completed' 
      ? (s.target_site_reached ? '✅' : '❌') 
      : '⏳';
    console.log(`  ${status} ${s.status.padEnd(10)} | ${age}s ago | ${s.error_message || 'No errors'}`);
  });
  
  if (pending > 0) {
    console.log(`\n⏳ ${pending} sessions still running. Check again in 30 seconds.`);
  } else if (completed === 10) {
    console.log('\n✨ All sessions completed!');
    if (reached === 10) {
      console.log('🎉 SUCCESS! All 10 sessions reached the target site!');
      console.log('   The Bright Data configuration is working perfectly.');
    } else {
      console.log(`⚠️  Only ${reached}/10 sessions reached target. Checking errors...`);
    }
  }
  
  console.log('\n');
}

monitorSessions().catch(console.error);
