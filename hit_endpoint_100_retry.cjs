const ALB_URL = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000/api/automate';
const RUN_ID = `ga100r-${Date.now()}`;

const PROXY = {
  proxy: 'http://brd.superproxy.io:33335',
  proxyUsername: 'brd-customer-hl_a908b07a-zone-isp',
  proxyPassword: 'mihmos3ifhay',
  proxyProvider: 'brightdata',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendOne(idx) {
  const sessionId = `${RUN_ID}-${idx}`;
  const body = {
    sessionId,
    campaignType: 'direct',
    targetUrl: `https://techdim.com/?${RUN_ID}=${idx}`,
    geoLocation: 'US',
    ...PROXY,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(ALB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
    } catch {}
    await sleep(300 * attempt);
  }
  return false;
}

async function run() {
  const total = 100;
  let ok = 0;
  let fail = 0;

  for (let i = 1; i <= total; i++) {
    const success = await sendOne(i);
    if (success) ok++; else fail++;
    if (i % 10 === 0) console.log(`progress ${i}/100 accepted=${ok} failed=${fail}`);
    await sleep(80);
  }

  console.log(`RUN_ID=${RUN_ID}`);
  console.log(`ACCEPTED=${ok}`);
  console.log(`FAILED=${fail}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
