const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const campaignId = '067bbb4d-109b-439a-882c-d666526da132';

async function resetCampaign() {
  console.log('🔄 Resetting Campaign Session Counter\n');
  
  // Count actual sessions
  const { count: actualCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);
  
  console.log('Actual sessions in database:', actualCount || 0);
  
  // Reset the counter
  const { data, error } = await supabase
    .from('campaigns')
    .update({ 
      total_sessions: actualCount || 0,
    })
    .eq('id', campaignId)
    .select();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('✅ Campaign counter reset to:', actualCount || 0);
  console.log('\nCampaign should now start creating sessions again.');
  console.log('Wait for the next scheduler run (happens every minute)');
  
  // Show updated campaign
  const { data: updated } = await supabase
    .from('campaigns')
    .select('id, name, status, total_sessions, sessions_per_hour, total_users, distribution_period_hours')
    .eq('id', campaignId)
    .single();
  
  console.log('\n📊 Updated Campaign:');
  console.log('  Name:', updated.name);
  console.log('  Status:', updated.status);
  console.log('  Total Sessions:', updated.total_sessions);
  console.log('  Sessions/Hour:', updated.sessions_per_hour);
  console.log('  Total Users:', updated.total_users);
  console.log('  Distribution Period:', updated.distribution_period_hours, 'hours');
  
  const expectedSessionsPerHour = Math.ceil(updated.total_users / updated.distribution_period_hours);
  console.log('  Expected sessions/hour:', expectedSessionsPerHour);
}

resetCampaign()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
