import { DurableObject } from 'cloudflare:workers';

export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_PROXY: DurableObjectNamespace;
}

const ALLOWED_ORIGINS = [
  'https://yiliang.app',
  'https://www.yiliang.app',
  'https://blog.yiliang.app',
];

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const PROMPT_PREFIX =
  '请使用简体中文为以下内容生成简短的概述,不要使用markdown格式,有富文本请使用html格式进行输出,300字以内：';

// ── Durable Object (runs in wnam / US West) ──────────────────────────────────
export class GeminiProxy extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const { content } = (await request.json()) as { content: string };
    return streamFromGemini(content, this.env.GEMINI_API_KEY);
  }
}

// ── Main Worker ───────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';

    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (ALLOWED_ORIGINS.includes(origin)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname !== '/summarize/stream') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const pageUrl = url.searchParams.get('url');
    if (!pageUrl) {
      return new Response('url is required', { status: 400, headers: corsHeaders });
    }

    try {
      const pageResponse = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeminiSummarizer/1.0)' },
      });
      if (!pageResponse.ok) {
        return new Response('Failed to fetch page', { status: 502, headers: corsHeaders });
      }
      const html = await pageResponse.text();

      const content = await extractSecondSectionText(html);
      if (!content) {
        return new Response('Could not extract article content', {
          status: 422,
          headers: corsHeaders,
        });
      }

      // Route Gemini call through a US-based Durable Object to bypass HK geo-block
      const id = env.GEMINI_PROXY.idFromName('singleton');
      const stub = env.GEMINI_PROXY.get(id, { locationHint: 'wnam' });
      const doRes = await stub.fetch('https://do/generate', {
        method: 'POST',
        body: JSON.stringify({ content }),
        headers: { 'Content-Type': 'application/json' },
      });

      return new Response(doRes.body, {
        status: doRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (e) {
      return new Response('Internal error: ' + (e as Error).message, {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function extractSecondSectionText(html: string): Promise<string> {
  let sectionIndex = 0;
  const textParts: string[] = [];
  let capturing = false;

  await new HTMLRewriter()
    .on('section', {
      element() {
        sectionIndex++;
        if (sectionIndex === 2) capturing = true;
        if (sectionIndex === 3) capturing = false;
      },
      text(chunk) {
        if (capturing && chunk.text.trim()) {
          textParts.push(chunk.text);
        }
      },
    })
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    .text();

  return textParts.join('').trim();
}

function streamFromGemini(content: string, apiKey: string): Response {
  const prompt = PROMPT_PREFIX + content;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

  const pump = async () => {
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    let buffer = '';

    try {
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!geminiRes.ok || !geminiRes.body) {
        const errBody = await geminiRes.text().catch(() => '(no body)');
        await writer.write(encoder.encode(`Gemini API error ${geminiRes.status}: ${errBody}`));
        return;
      }

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) await writer.write(encoder.encode(text));
          } catch {
            // skip malformed SSE chunk
          }
        }
      }
    } finally {
      await writer.close();
    }
  };

  // DO fetch handler is synchronous — pump runs in the same context, no floating promise
  void pump();

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
