'use strict';

/**
 * Load-balancing OpenAI-compatible adapter over an Overchat account pool.
 *
 * Endpoints:
 *   GET  /v1/models
 *   POST /v1/chat/completions   (stream + non-stream)
 *   GET  /health
 *   GET  /pool
 *   POST /pool/reload
 *
 * It rotates accounts round-robin, fails over on quota/error, and cools
 * broken accounts down. 9Router forces `Accept: text/event-stream` on
 * provider calls, so the adapter always speaks correct SSE when asked.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool, DEFAULT_POOL } = require('./pool');

const PREFIX = process.env.OVERCHAT_MODEL_PREFIX || 'overchat';
const PORT = Number(process.env.PORT || 8790);

let personaCache = [];
let personaCacheAt = 0;

function sendJson(res, code, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) });
  res.end(b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
}

async function getPersonas(pool) {
  if (personaCache.length && Date.now() - personaCacheAt < 5 * 60 * 1000) return personaCache;
  const acct = pool.next() || pool.accounts[0];
  if (!acct) return [];
  personaCache = await pool.client(acct).textPersonas();
  personaCacheAt = Date.now();
  return personaCache;
}

function modelList(personas) {
  const seen = new Set();
  const out = [];
  for (const p of personas) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: PREFIX + '/' + p.id, object: 'model', created: 0, owned_by: 'overchat' });
  }
  return out;
}

async function main() {
  const poolFile = process.env.OVERCHAT_POOL || DEFAULT_POOL;
  const pool = new Pool(poolFile);
  if (!pool.size) {
    console.error('pool empty. run `node src/cli.js create --count N` first, or set OVERCHAT_POOL');
    process.exit(1);
  }
  const personas = await getPersonas(pool);
  console.log(`overchat pool adapter :${PORT} — ${pool.size} accounts, ${personas.length} text models`);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
        return sendJson(res, 200, { ok: true, service: 'overchat-pool-adapter', accounts: pool.size, models: personas.length });
      }
      if (req.method === 'GET' && url.pathname === '/pool') {
        return sendJson(res, 200, {
          accounts: pool.accounts.map((a) => ({
            address: a.address,
            userId: a.userId,
            coins: a.coins,
            cooldownUntil: a.cooldownUntil || 0,
            errorCount: a.errorCount || 0,
          })),
        });
      }
      if (req.method === 'POST' && url.pathname === '/pool/reload') {
        pool.load();
        personaCache = [];
        return sendJson(res, 200, { ok: true, accounts: pool.size });
      }
      if (req.method === 'GET' && url.pathname === '/v1/models') {
        return sendJson(res, 200, { object: 'list', data: modelList(await getPersonas(pool)) });
      }
      if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        let body = {};
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return sendJson(res, 400, { error: { message: 'invalid JSON' } });
        }
        const want = String(body.model || '').replace(new RegExp('^' + PREFIX + '/'), '');
        const list = await getPersonas(pool);
        const persona =
          list.find((p) => p.id.toLowerCase() === want.toLowerCase()) ||
          list.find((p) => (p.model || '').toLowerCase() === want.toLowerCase()) ||
          list.find((p) => p.id === 'auto-model') ||
          list[0];
        if (!persona) return sendJson(res, 404, { error: { message: 'no models available' } });

        const accept = String(req.headers.accept || '');
        const stream = body.stream === true || /text\/event-stream/.test(accept);
        const id = 'chatcmpl-' + Math.random().toString(36).slice(2);

        // try accounts with failover
        const tried = new Set();
        let lastErr = null;
        for (let attempt = 0; attempt < pool.accounts.length; attempt++) {
          const acct = pool.next();
          if (!acct || tried.has(acct.address)) break;
          tried.add(acct.address);
          const client = pool.client(acct);

          if (!stream) {
            try {
              const text = await client.complete(persona, body.messages, body);
              pool.markOk(acct);
              return sendJson(res, 200, {
                id,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              });
            } catch (e) {
              lastErr = e;
              pool.markError(acct, /quota/i.test(e.message) ? 600000 : 90000);
              continue;
            }
          }

          // streaming: we must decide the account before writing headers
          let firstFrame = null;
          let it;
          try {
            it = client.stream(persona, body.messages, body);
            const first = await it.next();
            if (first.done) {
              pool.markOk(acct);
              firstFrame = null;
            } else {
              firstFrame = first.value;
            }
          } catch (e) {
            lastErr = e;
            pool.markError(acct, /quota/i.test(e.message) ? 600000 : 90000);
            continue;
          }
          // committed to this account
          res.writeHead(200, {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          });
          const chunk = (delta) =>
            res.write(
              'data: ' +
                JSON.stringify({
                  id,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: body.model,
                  choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
                }) +
                '\n\n'
            );
          const emit = (f) => {
            const d = require('./overchat').OverchatClient.delta(f);
            if (d) chunk(d);
          };
          if (firstFrame) emit(firstFrame);
          try {
            for await (const f of it) emit(f);
            pool.markOk(acct);
          } catch (e) {
            pool.markError(acct, 60000);
            res.write('data: ' + JSON.stringify({ error: { message: e.message } }) + '\n\n');
          }
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        const msg = lastErr ? lastErr.message : 'no healthy accounts';
        if (!stream) return sendJson(res, 503, { error: { message: msg } });
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: ' + JSON.stringify({ error: { message: msg } }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      sendJson(res, 404, { error: { message: 'not found ' + url.pathname } });
    } catch (e) {
      sendJson(res, 500, { error: { message: e.message || String(e) } });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`listening on http://127.0.0.1:${PORT}`);
  });
}

main();
