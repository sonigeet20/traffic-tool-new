async function run() {
  const run = `headful100-${Date.now()}`;
  const ep = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';
  let accepted = 0;
  let failed = 0;

  for (let i = 1; i <= 100; i++) {
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
      maxPagesPerSession: 2,
      sessionDurationMin: 25,
      sessionDurationMax: 40
    };

    let ok = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (res.status === 200 || res.status === 202) {
          ok = true;
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 150 * attempt));
    }

    if (ok) accepted++; else failed++;

    if (i % 10 === 0) {
      console.log(`progress ${i}/100 accepted=${accepted} failed=${failed}`);
    }

    await new Promise(r => setTimeout(r, 90));
  }

  console.log(`RUN_ID=${run}`);
  console.log(`ACCEPTED=${accepted}`);
  console.log(`FAILED=${failed}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
