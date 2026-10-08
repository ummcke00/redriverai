#!/usr/bin/env python3
"""Generate the River Cloudflare Pages Function with the knowledge base embedded."""
import json
import os

KB = "/home/wmckenzie/ceo-loop/river/rivers-kb.json"
OUT = "/home/wmckenzie/redriverai-website/functions/api/river.js"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

kb = json.load(open(KB))
parts = [f"### {name} ({d['url']})\n{d['text']}"
         for name, d in kb.items() if d.get("text")]
kb_text = "\n\n".join(parts)

SYSTEM = """You are River, the assistant for Red River AI - an AI automation consultancy in Manitoba, Canada, run by Willy McKenzie.

RULES:
- Answer ONLY from the SITE INFORMATION below. If it isn't there, say you're not sure and offer the calendar link or hello@redriverai.ca.
- Keep replies SHORT and spoken-friendly: 1-3 sentences, no markdown, no bullet lists, no emoji. This is spoken aloud.
- Be warm, plain, and confident. No corporate filler.
- Pricing: Starter $500 (1 automation), Growth $1,000 (3 automations), Enterprise custom. 1-on-1 training $200/session + tax.
- There is a FREE AI audit and a FREE A/R aging check - mention them when relevant; they're the best entry point.
- To book, point to the calendar: calendly.com/redriverai/30min
- Never invent services, prices, or promises. Never claim to be human.
"""

js = '''// River — Cloudflare Pages Function.  POST /api/river
// Grounded reply (OpenRouter chat) + ElevenLabs speech (OpenRouter TTS).
// The OpenRouter key lives as a Pages secret (OPENROUTER_API_KEY).

const CHAT_MODEL = "google/gemini-3.8-flash";
const TTS_MODEL = "elevenlabs/eleven-flash-v2.5";
const VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam (stock ElevenLabs)

const SYSTEM = %s;
const KB = %s;

const CORS = {
  "Access-Control-Allow-Origin": "https://redriverai.ca",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const key = context.env.OPENROUTER_API_KEY;
  if (!key) return json({ reply: "River is not configured yet.", audio_b64: null }, 500);

  let body;
  try { body = await context.request.json(); }
  catch (e) { return json({ error: "bad json" }, 400); }

  let message = (body && body.message ? String(body.message) : "").trim();
  if (!message) return json({ error: "empty message" }, 400);

  // "__greet__" -> deterministic spoken opener
  if (message === "__greet__") {
    message = "Greet the visitor in one or two short spoken sentences. Introduce yourself as River, " +
              "the Red River AI assistant. Invite them to ask about our services, pricing, or the free AI audit.";
  }

  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  const messages = [{ role: "system", content: SYSTEM + "\\n\\nSITE INFORMATION:\\n" + KB }];
  for (const t of history) {
    if (t && t.role && t.content) messages.push({ role: t.role, content: String(t.content) });
  }
  messages.push({ role: "user", content: message });

  let reply = "";
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "***" + key,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://redriverai.ca",
        "X-Title": "River - Red River AI",
      },
      body: JSON.stringify({ model: CHAT_MODEL, messages, temperature: 0.4, max_tokens: 900 }),
    });
    if (!r.ok) throw new Error("chat " + r.status);
    const d = await r.json();
    reply = (d.choices && d.choices[0] && d.choices[0].message.content || "").trim();
    if (!reply) throw new Error("empty reply");
  } catch (e) {
    return json({
      reply: "Sorry, I had trouble just now. You can reach us at hello@redriverai.ca.",
      audio_b64: null, error: String(e),
    });
  }

  let audio_b64 = null;
  try {
    const tr = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: { "Authorization": "***" + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TTS_MODEL, input: reply, voice: VOICE_ID, response_format: "mp3",
      }),
    });
    if (tr.ok) {
      const buf = await tr.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      audio_b64 = btoa(bin);
    }
  } catch (e) { /* text still works without audio */ }

  return json({ reply, audio_b64 });
}
''' % (json.dumps(SYSTEM), json.dumps(kb_text))

open(OUT, "w").write(js)
print("wrote", OUT, len(js), "bytes | KB chars:", len(kb_text))
