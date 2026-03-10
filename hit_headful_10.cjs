async function run() {
  const run = `headful-ga-${Date.now()}`;
  const url = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';
  let ok = 0;

  for (let i = 1; i <= 10; i++) {
    const body = {
      sessionId: `${run}-${i}`,
      campaignType: 'direct',
      targetUrl: `https://techdim.com/?${run}=${i}`,
      geoLocation: 'US',
      proxy: 'http://brd.superproxy.io:33335',
      proxyUsername: 'brd-customer-hl_a908b07a-zone-isp',
      proxyPassword: 'mihmos3ifhay',
      proxyProvider: 'brightdata',
      headlessMode: 'false',
      minPagesPerSession: 1,
      maxPagesPerSession: 2,
      sessionDurationMin: 20,
      sessionDurationMax: 30
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) ok++;
    } catch {}

    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`RUN_ID=${run}`);
  console.log(`ACCEPTED=${ok}`);
}

run().catch(console.error);
