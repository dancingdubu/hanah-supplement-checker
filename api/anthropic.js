export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return new Response(JSON.stringify({ error: 'Missing x-api-key' }), { status: 400, headers: cors });

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors }); }

  // Force streaming so Vercel pipes chunks immediately instead of waiting for full response
  body.stream = true;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Pipe the stream straight through — no buffering, no timeout
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
