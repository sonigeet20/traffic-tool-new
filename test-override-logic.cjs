require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .eq('id', '645247f4-c77d-49ce-9eb8-7acd90f1c677');
  
  const campaign = campaigns[0];
  
  console.log('Campaign as scheduler sees it:');
  console.log('  proxy_override_enabled:', campaign.proxy_override_enabled);
  console.log('  proxy_username:', campaign.proxy_username ? 'SET (' + campaign.proxy_username.substring(0,20) + '...)' : 'NOT SET');
  console.log('  proxy_password:', campaign.proxy_password ? 'SET' : 'NOT SET');
  console.log('  proxy_host:', campaign.proxy_host);
  console.log('  proxy_port:', campaign.proxy_port);
  console.log('  proxy_provider:', campaign.proxy_provider);
  
  const overrideEnabled = !!campaign.proxy_override_enabled && campaign.proxy_username && campaign.proxy_password;
  console.log('\noverride check result:', overrideEnabled);
  
  if (overrideEnabled) {
    console.log('\n✅ Override should be active');
    console.log('Scheduler should use:');
    console.log('  Proxy: http://' + campaign.proxy_host + ':' + campaign.proxy_port);
    console.log('  Username:', campaign.proxy_username);
    console.log('  Provider:', campaign.proxy_provider);
  } else {
    console.log('\n❌ Override NOT active - would use default providers');
  }
})();
