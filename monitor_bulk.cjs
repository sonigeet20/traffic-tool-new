const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = require('fs').readFileSync('/tmp/bulk_campaign_id.txt', 'utf8').trim();

async function monitor() {
  const { data } = await supabase
    .from('bot_sessions')
    .select('status, error_message, created_at')
    .eq('campaign_id', campaignId);
  
  const total = data?.length || 0;
  const completed = data?.filter(s => s.status === 'completed').length || 0;
  const running = data?.filter(s => s.status === 'running').length || 0;
  const pending = data?.filter(s => s.status === 'pending').length || 0;
  const failed = data?.filter(s => s.error_message && s.error_message.includes('ERR_')).length || 0;
  
  console.clear();
  console.log('═'.repeat(70));
  console.log('  100-SESSION BULK TEST - LIVE MONITOR');
  console.log('═'.repeat(70));
  console.log('\n📊 Progress: ' + total + '/100 sessions created');
  console.log('   ⏳ Pending:   ' + pending);
  console.log('   🔄 Running:   ' + running);
  console.log('   ✅ Completed: ' + completed);
  console.log('   ❌ Failed:    ' + failed);
  
  if (completed > 0) {
    const successRate = ((completed - failed) / completed * 100).toFixed(1);
    console.log('\n📈 Success Rate: ' + successRate + '%');
  }
  
  if (total >= 100 && running === 0) {
    console.log('\n🎉 All 100 sessions completed!\n');
    process.exit(0);
  }
  
  console.log('\n⏰ ' + new Date().toLocaleTimeString() + ' - Refreshing in 10s...\n');
}

setInterval(monitor, 10000);
monitor();
