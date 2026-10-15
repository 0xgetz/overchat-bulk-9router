'use strict';

/**
 * Overchat Bulk → 9Router CLI.
 *
 * Commands:
 *   create  --count N [--concurrency C] [--timeout MS]   bulk-create accounts -> accounts.json
 *   list                                                  show pool
 *   health                                                ping every account
 *   test [model]                                          one live completion on a pooled account
 *   serve                                                 run the pool adapter (OpenAI-compatible)
 *   connect                                                register the adapter into 9Router
 *   models                                                list text models from a pooled account
 */

const { createAccount } = require('./overchat');
const { Pool } = require('./pool');
const { getInbox } = require('./inbox');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  const kv = process.argv.find((a) => a.startsWith('--' + name + '='));
  return kv ? kv.split('=').slice(1).join('=') : def;
}

async function cmdCreate() {
  const count = Number(arg('count', 1));
  const concurrency = Number(arg('concurrency', 2));
  const timeout = Number(arg('timeout', 120000));
  const pool = new Pool(arg('pool', process.env.OVERCHAT_POOL));
  const inbox = getInbox({ mailbox: arg('mailbox', process.env.OVERCHAT_MAILBOX), provider: arg('inbox', process.env.OVERCHAT_INBOX) });
  console.log(`creating ${count} account(s), concurrency ${concurrency}, mailbox ${inbox.base || inbox.opts?.base || '?'}`);

  let made = 0;
  let failed = 0;
  const queue = Array.from({ length: count }, (_, i) => i + 1);
  async function worker() {
    while (queue.length) {
      const n = queue.shift();
      try {
        const acct = await createAccount({ inbox, timeout });
        pool.add(acct);
        made++;
        console.log(`[${n}] OK  ${acct.address}  sub=${acct.userId}  coins=${acct.coins}  guest=${acct.isGuest}`);
      } catch (e) {
        failed++;
        console.log(`[${n}] ERR ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
  console.log(`done: ${made} created, ${failed} failed, pool size ${pool.size}`);
}

async function cmdList() {
  const pool = new Pool(arg('pool', process.env.OVERCHAT_POOL));
  console.log(`pool size: ${pool.size}`);
  for (const a of pool.accounts) console.log(' -', a.address, '| sub', a.userId, '| coins', a.coins, '| guest', a.isGuest);
}

async function cmdHealth() {
  const pool = new Pool(arg('pool', process.env.OVERCHAT_POOL));
  let ok = 0;
  for (const a of pool.accounts) {
    const h = await pool.health(a);
    if (h.ok) {
      ok++;
      console.log('OK ', a.address, 'coins', h.coins, 'guest', h.isGuest);
    } else {
      console.log('ERR', a.address, h.error);
    }
  }
  console.log(`healthy: ${ok}/${pool.size}`);
}

async function cmdTest() {
  const pool = new Pool(arg('pool', process.env.OVERCHAT_POOL));
  const acct = pool.next() || pool.accounts[0];
  if (!acct) throw new Error('empty pool');
  const client = pool.client(acct);
  const persona = await client.resolvePersona(arg('model', 'auto-model'));
  console.log('account', acct.address, 'persona', persona.id, '(' + persona.name + ')');
  const out = await client.complete(persona, [{ role: 'user', content: arg('prompt', 'Reply with exactly: PING') }], { max_tokens: 50 });
  console.log('response:', JSON.stringify(out));
}

async function cmdModels() {
  const pool = new Pool(arg('pool', process.env.OVERCHAT_POOL));
  const acct = pool.next() || pool.accounts[0];
  const list = await pool.client(acct).textPersonas();
  console.log('text models:', list.length);
  for (const p of list.slice(0, 40)) console.log(' -', p.id, '|', p.name, '|', p.model);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'create') return cmdCreate();
  if (cmd === 'list') return cmdList();
  if (cmd === 'health') return cmdHealth();
  if (cmd === 'test') return cmdTest();
  if (cmd === 'models') return cmdModels();
  if (cmd === 'serve') return require('./adapter');
  if (cmd === 'connect') return require('./connect-9router').main();
  console.log('commands: create | list | health | test [model] | models | serve | connect');
}

main().catch((e) => {
  console.error('ERROR:', e.message || e);
  process.exit(1);
});
