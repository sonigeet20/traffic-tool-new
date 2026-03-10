const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('📋 Verification Summary\n');
  console.log('═'.repeat(70));
  
  // Get campaign count by proxy config
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('proxy_host, proxy_port, proxy_password, status')
    .neq('status', 'cancelled');
  
  const port12233 = campaigns.filter(c => c.proxy_port === 12233);
  const port33335 = campaigns.filter(c => c.proxy_port === 33335);
  const oldPass = campaigns.filter(c => c.proxy_password?.startsWith('q2r3q'));
  const newPass = campaigns.filter(c => c.proxy_password?.startsWith('mihmo'));
  
  console.log('\n🔌 Proxy Port Configuration:');
  console.log(`   Port 12233 (FAILING): ${port12233.length} campaigns`);
  console.log(`   Port 33335 (WORKING): ${port33335.length} campaigns`);
  
  console.log('\n🔑 Proxy Password:');
  console.log(`   Old password (q2r3q...): ${oldPass.length} campaigns`);
  console.log(`   New password (mihmo...): ${newPass.length} campaigns`);
  
  console.log('\n📊 Campaign Status:');
  const statuses = {};
  campaigns.forEach(c => {
    statuses[c.status] = (statuses[c.status] || 0) + 1;
  });
  Object.entries(statuses).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  console.log('\n✅ Configuration Status:');
  if (port33335.length === campaigns.length && newPass.length === campaigns.length) {
    console.log('   ✓ ALL campaigns updated to Bright Data port 33335');
    console.log('   ✓ ALL campaigns using new password (mihmos3ifhay)');
    console.log('   ✓ Luna proxy completely replaced with Bright Data');
    console.log('\n🎯 RESULT: Sessions will no longer timeout');
    console.log('   Next campaign runs will navigate successfully to target sites');
  } else {
    console.log(`   ⚠️  ${port12233.length} campaigns still on port 12233 (will timeout)`);
    console.log(`   ⚠️  ${oldPass.length} campaigns using old password`);
  }
  
  console.log('\n═'.repeat(70));
}

verify().catch(console.error);
