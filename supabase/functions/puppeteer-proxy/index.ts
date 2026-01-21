import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Allow public calls from the frontend without JWT
export const config = {
  verifyJwt: false,
};

const ALB_ENDPOINT = 'http://traffic-tool-alb-681297197.us-east-1.elb.amazonaws.com:3000';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    // Extract the path from the request URL
    const url = new URL(req.url);
    const path = url.pathname.replace('/puppeteer-proxy', '');
    const pathWithSearch = `${path}${url.search}`;
    
    // Forward the request to ALB
    const albUrl = `${ALB_ENDPOINT}${pathWithSearch}`;
    
    const body = req.method === 'POST' ? await req.text() : undefined;
    
    console.log(`Proxying ${req.method} ${path} to ${albUrl}`);
    
    const forwardHeaders: Record<string, string> = {
      'Content-Type': req.headers.get('content-type') || 'application/json',
    };
    const authHeader = req.headers.get('authorization');
    const apiKeyHeader = req.headers.get('apikey');
    if (authHeader) forwardHeaders['Authorization'] = authHeader;
    if (apiKeyHeader) forwardHeaders['apikey'] = apiKeyHeader;

    const response = await fetch(albUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body,
    });

    const data = await response.text();

    if (!response.ok) {
      console.error('[proxy] Upstream error', {
        status: response.status,
        albUrl,
        body: data?.slice(0, 500),
      });
      return new Response(data || JSON.stringify({ error: 'Upstream error', status: response.status }), {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
    
    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    const message = (error as Error)?.message || 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
})
