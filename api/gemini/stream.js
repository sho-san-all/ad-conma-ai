export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { system, messages, max_tokens } = await req.json();
  
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: max_tokens || 4000 }
      }),
    }
  );
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
