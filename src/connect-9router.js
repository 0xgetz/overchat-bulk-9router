'use strict';

/**
 * 9Router connector.
 *
 * 9Router (self-hosted, https://github.com/.../9router, or 9router.com cloud)
 * exposes an admin API on the same origin as the OpenAI-compatible `/v1`.
 *
 * Flow (verified against 9Router 0.5.99):
 *   1. POST /api/auth/login          { password }                -> cookie
 *   2. POST /api/keys                { name }                    -> { key:"sk-..." }
 *   3. POST /api/provider-nodes      { type:"openai-compatible",
 *                                      prefix, baseUrl, apiType:"chat", name }
 *                                                                -> { id:<nodeId> }
 *   4. POST /api/providers           { provider:<nodeId>, apiKey,
 *                                      name, priority, defaultModel }
 *
 * NOTE: step 4 `provider` must be the NODE ID (`openai-compatible-chat-<uuid>`),
 *       NOT the prefix, or the API replies "Invalid provider".
 *
 * Usage:
 *   node src/connect-9router.js \
 *     --router https://9router.com \        # or http://127.0.0.1:20128
 *     --password <router password> \
 *     --base http://127.0.0.1:8790/v1 \     # the pool adapter (must be reachable by the router)
 *     --prefix overchat \
 *     --default auto-model
 */

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const kv = process.argv.find((a) => a.startsWith('--' + name + '='));
  return kv ? kv.split('=').slice(1).join('=') : def;
}

function jarFrom(res) {
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return sc.map((c) => c.split(';')[0]).join('; ');
}

async function main() {
  const router = arg('router', process.env.ROUTER_URL || 'https://9router.com').replace(/\/+$/, '');
  const password = arg('password', process.env.ROUTER_PASSWORD || '123456');
  const base = arg('base', process.env.ADAPTER_URL || 'http://127.0.0.1:8790/v1');
  const prefix = arg('prefix', process.env.OVERCHAT_MODEL_PREFIX || 'overchat');
  const name = arg('name', 'Overchat');
  const def = arg('default', 'auto-model');
  const apiKey = arg('apikey', process.env.OVERCHAT_PROVIDER_KEY || 'overchat');

  const login = await fetch(router + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) throw new Error('login ' + login.status + ' ' + (await login.text()).slice(0, 160));
  const cookie = jarFrom(login);

  // reusable router API key
  const keyRes = await fetch(router + '/api/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: name + ' adapter' }),
  });
  const keyJson = await keyRes.json().catch(() => ({}));
  const routerKey = keyJson.key || keyJson.data?.key || '';
  console.log('router key:', routerKey || '(check dashboard)');

  const nodeRes = await fetch(router + '/api/provider-nodes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'openai-compatible', prefix, baseUrl: base, apiType: 'chat', name }),
  });
  const nodeJson = await nodeRes.json().catch(() => ({}));
  const nodeId = nodeJson.id || nodeJson.node?.id || nodeJson.data?.id || '';
  if (!nodeRes.ok && !nodeId) throw new Error('provider-node ' + nodeRes.status + ' ' + JSON.stringify(nodeJson).slice(0, 200));
  console.log('provider node:', nodeId);

  const provRes = await fetch(router + '/api/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ provider: nodeId, apiKey, name, priority: 1, defaultModel: prefix + '/' + def }),
  });
  const provJson = await provRes.json().catch(() => ({}));
  console.log('provider:', provRes.status, JSON.stringify(provJson).slice(0, 160));

  if (routerKey) {
    const models = await fetch(router + '/v1/models', { headers: { authorization: 'Bearer ' + routerKey } });
    const mj = await models.json().catch(() => ({}));
    const ids = (mj.data || []).map((m) => m.id).filter((id) => id.startsWith(prefix + '/'));
    console.log('models visible through router:', ids.length);
    console.log(JSON.stringify(ids.slice(0, 30), null, 1));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

module.exports = { main };
