const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('name, proxy_port, proxy_password, status')
    .neq('status', 'cancelled')
    .limit(5);
  
  console.log('Sample campaigns:\n');
  campaigns.forEach(c => {
    console.log(`${c.name}`);
    console.log(`  Port: ${c.proxy_port} (type: ${typeof c.proxy_port})`);
    console.log(`  Password: ${c.proxy_password?.substring(0,10)}...`);
    console.log();
  });
}

check().catch(console.error);
