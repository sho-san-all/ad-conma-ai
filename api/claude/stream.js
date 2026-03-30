export const config = { runtime: 'edge' };

export default async function handler(req) {
  const body = await req.json();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
