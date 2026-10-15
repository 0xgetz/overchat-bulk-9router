'use strict';

/**
 * Overchat account + inference client (reverse-engineered 15 Oct 2026).
 *
 * Base URL:  https://api.overchat.ai
 *
 * AUTH
 *   `Authorization: Bearer <access-token JWT>` — the JWT is issued by
 *   POST /v1/auth/email/verify and is valid 30 days. It works standalone
 *   (no cookies, no proxy) from any datacenter IP.
 *
 *   Required request headers (without them -> 403 "Forbidden"):
 *     x-device-platform : web
 *     x-device-version  : <any, e.g. 1.0.0>
 *     x-device-uuid     : <uuid>
 *     Origin / Referer  : https://overchat.ai
 *
 * BULK-UNIQUE ACCOUNTS (the important trick)
 *   POST /v1/auth/email/send-code and /v1/auth/email/verify each mint or bind
 *   a device. When BOTH calls carry the SAME fresh `x-device-uuid`, the account
 *   is created as a distinct, non-demo user (`isGuest:false`, unique `sub`,
 *   100 takosCoins). Without a device uuid the login collapses onto the shared
 *   Demo Account (`sub 00000367-…`) which is quota-throttled.
 *
 * CATALOG
 *   GET /v1/personas?view=list -> array. Text/auto rows:
 *     { id, name, model, type, isDefault, isAgentEnabled, ... }
 *   `id` is the persona slug, `model` the upstream model id — BOTH are needed.
 *
 * CHAT
 *   POST /v1/chat/completions  (SSE, HTTP 201)
 *   body { model, chatId, personaId, messages:[{id,role,content}], stream:true,
 *          temperature, top_p, max_tokens, frequency_penalty, presence_penalty }
 *   Frames are either OpenAI `chat.completion.chunk` or Responses-API events,
 *   terminated by `data: [DONE]`.
 *
 * @module overchat
 */

const { randomUUID } = require('crypto');

const BASE = 'https://api.overchat.ai';

function baseHeaders(deviceId) {
  return {
    accept: 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'x-device-platform': 'web',
    'x-device-version': '1.0.0',
    'x-device-uuid': deviceId,
    'x-device-language': 'en',
    origin: 'https://overchat.ai',
    referer: 'https://overchat.ai/',
  };
}

async function jsonFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, ok: res.ok, body };
}

class OverchatClient {
  constructor(token, deviceId) {
    this.token = token;
    this.deviceId = deviceId || randomUUID();
  }

  authHeaders() {
    return Object.assign({ authorization: 'Bearer ' + this.token }, baseHeaders(this.deviceId));
  }

  async me() {
    const r = await jsonFetch(`${BASE}/v1/auth/me`, { headers: this.authHeaders() });
    if (!r.ok) throw new Error('auth/me ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    return r.body;
  }

  async personas() {
    const r = await jsonFetch(`${BASE}/v1/personas?view=list`, { headers: this.authHeaders() });
    if (!r.ok) throw new Error('personas ' + r.status);
    return r.body;
  }

  async textPersonas() {
    return (await this.personas()).filter((p) => p.type === 'text' || p.type === 'auto-model');
  }

  async resolvePersona(want, list) {
    const arr = list || (await this.personas());
    const w = String(want || 'auto-model').toLowerCase();
    return (
      arr.find((p) => p.id.toLowerCase() === w) ||
      arr.find((p) => (p.model || '').toLowerCase() === w) ||
      arr.find((p) => (p.name || '').toLowerCase() === w) ||
      arr.find((p) => p.id.toLowerCase().includes(w)) ||
      arr.find((p) => p.isDefault) ||
      arr[0]
    );
  }

  /** Streaming completion generator yielding parsed SSE frames. */
  async *stream(persona, messages, opts) {
    opts = opts || {};
    const body = {
      model: persona.model,
      chatId: opts.chatId || randomUUID(),
      personaId: persona.id,
      messages: (messages || []).map((m) => ({
        id: randomUUID(),
        role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      stream: true,
      temperature: opts.temperature != null ? opts.temperature : 0.5,
      top_p: opts.top_p != null ? opts.top_p : 0.95,
      max_tokens: opts.max_tokens != null ? opts.max_tokens : 4000,
      frequency_penalty: opts.frequency_penalty != null ? opts.frequency_penalty : 0,
      presence_penalty: opts.presence_penalty != null ? opts.presence_penalty : 0,
    };
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      let msg = t;
      try {
        msg = JSON.parse(t).error || JSON.parse(t).message || t;
      } catch {
        /* raw */
      }
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const p = line.slice(5).trim();
        if (p === '[DONE]') return;
        if (!p) continue;
        try {
          yield JSON.parse(p);
        } catch {
          /* keepalive */
        }
      }
    }
  }

  async complete(persona, messages, opts) {
    let out = '';
    for await (const f of this.stream(persona, messages, opts)) {
      const d = OverchatClient.delta(f);
      if (d) out += d;
    }
    return out;
  }

  static delta(frame) {
    if (!frame) return null;
    if (frame.choices && frame.choices[0]) {
      const c = frame.choices[0];
      if (c.delta && typeof c.delta.content === 'string') return c.delta.content;
      if (typeof c.text === 'string') return c.text;
    }
    if (frame.event && frame.data) {
      const d = frame.data;
      if (d.type === 'response.output_text.delta' && typeof d.delta === 'string') return d.delta;
      if (typeof d.delta === 'string') return d.delta;
    }
    if (typeof frame.delta === 'string') return frame.delta;
    return null;
  }

  static jwtSub(token) {
    try {
      const p = token.split('.')[1];
      return JSON.parse(Buffer.from(p, 'base64').toString()).sub;
    } catch {
      return null;
    }
  }
}

/**
 * Create one account end-to-end with pure HTTP.
 *
 * @param {object} o
 * @param {{create:Function, waitForCode:Function}} o.inbox
 * @param {string} [o.tag]
 * @param {number} [o.timeout]
 * @returns {Promise<{address,tag,deviceId,token,userId,coins,isGuest}>}
 */
async function createAccount(o) {
  const inbox = o.inbox;
  const deviceId = o.deviceId || randomUUID();
  const { address, tag } = inbox.create(o.tag);
  const h = baseHeaders(deviceId);

  const sc = await jsonFetch(`${BASE}/v1/auth/email/send-code`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ email: address }),
  });
  if (!sc.ok) throw new Error('send-code ' + sc.status + ' ' + JSON.stringify(sc.body).slice(0, 160));

  const { code } = await inbox.waitForCode(address, { timeout: o.timeout || 120000, since: Date.now() - 10000 });

  const vr = await jsonFetch(`${BASE}/v1/auth/email/verify`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ email: address, code }),
  });
  if (!vr.ok || !vr.body.access_token) {
    throw new Error('verify ' + vr.status + ' ' + JSON.stringify(vr.body).slice(0, 160));
  }
  const token = vr.body.access_token;
  const client = new OverchatClient(token, deviceId);
  let me = {};
  try {
    me = await client.me();
  } catch {
    /* non-fatal */
  }
  return {
    address,
    tag,
    deviceId,
    token,
    userId: OverchatClient.jwtSub(token),
    coins: me.takosCoin,
    isGuest: me.isGuest,
    plan: me.subscription && me.subscription.planCode,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { OverchatClient, createAccount, BASE, baseHeaders };
