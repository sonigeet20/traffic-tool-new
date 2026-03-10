async function run() {
  const run = `hfcheck-${Date.now()}`;
  const ep = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';

  for (let i = 1; i <= 3; i++) {
    const sid = `${run}-${i}`;
    const u = `https://techdim.com/?${run}=${i}`;
    const body = {
      sessionId: sid,
      campaignType: 'direct',
      url: u,
      targetUrl: u,
      geoLocation: 'US',
      proxy: 'http://brd.superproxy.io:33335',
      proxyUsername: 'brd-customer-hl_a908b07a-zone-isp',
      proxyPassword: 'mihmos3ifhay',
      proxyProvider: 'brightdata',
      headlessMode: 'false',
      minPagesPerSession: 1,
      maxPagesPerSession: 1,
      sessionDurationMin: 20,
      sessionDurationMax: 25,
    };

    const res = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log(`POST ${i} status ${res.status}`);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`RUN_ID=${run}`);
}

run().catch(console.error);
