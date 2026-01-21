import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALB_ENDPOINT = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Extract the path from the request URL
    const url = new URL(req.url);
    const path = url.pathname.replace('/puppeteer-proxy', '');
    
    // Forward the request to ALB
    const albUrl = `${ALB_ENDPOINT}${path}`;
    
    const body = req.method === 'POST' ? await req.text() : undefined;
    
    const response = await fetch(albUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });

    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
})
