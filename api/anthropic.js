export const config = { runtime: 'edge' };

const ALLOWED_DOMAIN = 'hanah1.com';

async function verifyGoogleToken(idToken) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload.error) return null;
    if (!payload.email || !payload.email.endsWith(`@${ALLOWED_DOMAIN}`)) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });

  // Verify Google identity
  const authHeader = req.headers.get('Authorization') || '';
  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

  const user = await verifyGoogleToken(idToken);
  if (!user) return new Response(
    JSON.stringify({ error: 'Access denied. Please sign in with your @hanah1.com Google account.' }),
    { status: 403, headers: cors }
  );

  // Use server-side API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'Server misconfiguration: API key not set.' }), { status: 500, headers: cors });

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: cors }); }

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

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
