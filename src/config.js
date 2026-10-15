'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadConfig() {
  let file = {};
  const p = process.env.OVERCHAT_CONFIG || path.join(ROOT, 'config.json');
  try {
    file = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    /* no config file is fine */
  }
  return {
    /** Single real mailbox used for plus-addressing (e.g. you@gmail.com). */
    mailbox: process.env.OVERCHAT_MAILBOX || file.mailbox || '',
    /** Inbox provider: "agentmail" | "imap" (default auto). */
    inboxProvider: process.env.OVERCHAT_INBOX || file.inboxProvider || '',
    /** Pool file holding created accounts. */
    poolFile: process.env.OVERCHAT_POOL || file.poolFile || path.join(ROOT, 'accounts.json'),
    /** Base URL of the local pool adapter (what 9Router talks to). */
    adapterUrl: process.env.ADAPTER_URL || file.adapterUrl || 'http://127.0.0.1:8790/v1',
    /** Model id prefix in 9Router. */
    prefix: process.env.OVERCHAT_MODEL_PREFIX || file.prefix || 'overchat',
    /** Port for the pool adapter. */
    port: Number(process.env.PORT || file.port || 8790),
    /** 9Router instance. */
    router: process.env.ROUTER_URL || file.router || 'https://9router.com',
    routerPassword: process.env.ROUTER_PASSWORD || file.routerPassword || '123456',
    /** Optional IMAP credentials (when inboxProvider = imap). */
    imap: file.imap || {
      host: process.env.IMAP_HOST,
      port: Number(process.env.IMAP_PORT || 993),
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
      base: process.env.IMAP_BASE,
    },
  };
}

module.exports = { loadConfig, ROOT };
