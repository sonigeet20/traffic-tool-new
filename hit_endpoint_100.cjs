const ALB_URL = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';

const PROXY = {
  proxy: 'http://brd.superproxy.io:33335',
  proxyUsername: 'brd-customer-hl_a908b07a-zone-isp',
  proxyPassword: 'mihmos3ifhay',
  proxyProvider: 'brightdata',
};

async function run() {
  const runId = `ga100-${Date.now()}`;
  const total = 100;
  let ok = 0;
  let failed = 0;

  const requests = Array.from({ length: total }, (_, i) => {
    const idx = i + 1;
    const sessionId = `${runId}-${idx}`;
    const body = {
      sessionId,
      campaignType: 'direct',
      targetUrl: `https://techdim.com/?${runId}=${idx}`,
      geoLocation: 'US',
      ...PROXY,
    };

    return fetch(ALB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const text = await res.text();
        if (res.ok) {
          ok++;
        } else {
          failed++;
          console.log(`FAIL ${idx}: HTTP ${res.status} ${text.slice(0, 120)}`);
        }
      })
      .catch((err) => {
        failed++;
        console.log(`FAIL ${idx}: ${err.message}`);
      });
  });

  await Promise.all(requests);

  console.log(`RUN_ID=${runId}`);
  console.log(`ACCEPTED=${ok}`);
  console.log(`FAILED=${failed}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
