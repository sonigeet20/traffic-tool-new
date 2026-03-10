async function run() {
  const run = `cap10-${Date.now()}`;
  const ep = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';
  let ok = 0;

  for (let i = 1; i <= 30; i++) {
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
      sessionDurationMin: 20,
      sessionDurationMax: 30,
      minPagesPerSession: 1,
      maxPagesPerSession: 2,
    };

    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.status === 200 || r.status === 202) ok++;
    } catch {}

    await new Promise((x) => setTimeout(x, 40));
  }

  console.log(`RUN_ID=${run}`);
  console.log(`ACCEPTED=${ok}`);
}

run().catch(console.error);
