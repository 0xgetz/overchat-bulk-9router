'use strict';

/**
 * Inbox providers.
 *
 * Overchat REJECTS disposable mail domains (`api.mail.tm`, temp-mail, etc.)
 * with `422 "This email provider is not supported"`. It accepts normal
 * domains and plus-addressing.
 *
 * The most practical bulk setup is a single real mailbox that supports
 * plus-addressing (`user+tag@domain`): every account gets a unique address
 * while all mail lands in one readable inbox.
 *
 * Two providers ship here:
 *
 *   AgentMailInbox — the Browser Use v4 agent inbox + plus-addressing.
 *     POST {GATEWAY}/api/v4/agentmail/send  (send)
 *     GET  {GATEWAY}/api/v4/agentmail/messages?limit=N   (list)
 *     GET  {GATEWAY}/api/v4/agentmail/messages/{id}      (read)
 *     Auth: Authorization: Bearer $V4_RUN_TOKEN
 *
 *   ImapInbox — a normal mailbox read over IMAP (user supplies host/user/pass).
 *
 * Both expose: create(tag) -> address, and waitForCode(address, {timeout}) -> code
 */

const crypto = require('crypto');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AgentMailInbox {
  /**
   * @param {{gateway:string, token:string, base:string, tagPrefix?:string}} opts
   *   base       full address to plus-address off, e.g. "me@mail.bu.app"
   *   gateway    V4 gateway base url (V4_GATEWAY_URL)
   *   token      V4_RUN_TOKEN
   */
  constructor(opts) {
    this.gateway = (opts.gateway || '').replace(/\/+$/, '');
    this.token = opts.token || '';
    this.base = opts.base || '';
    this.tagPrefix = opts.tagPrefix || 'oc';
    if (!this.gateway || !this.token) throw new Error('AgentMailInbox needs gateway + token');
    if (!this.base.includes('@')) throw new Error('AgentMailInbox needs a base address a@b');
  }

  /** Build a unique plus-address for `tag`. */
  create(tag) {
    const [user, domain] = this.base.split('@');
    const t = tag || this.tagPrefix + crypto.randomBytes(4).toString('hex');
    return { address: `${user}+${t}@${domain}`, tag: t };
  }

  async _list(limit) {
    const res = await fetch(`${this.gateway}/api/v4/agentmail/messages?limit=${limit || 20}`, {
      headers: { authorization: 'Bearer ' + this.token },
    });
    if (!res.ok) throw new Error('agentmail list ' + res.status);
    return res.json();
  }

  /**
   * Poll for a message addressed to exactly `address` matching `match`.
   * Returns the parsed code (first capture group of `codeRe`).
   */
  async waitForCode(address, opts) {
    opts = opts || {};
    const timeout = opts.timeout || 120000;
    const interval = opts.interval || 4000;
    const since = opts.since || Date.now() - 15000;
    const match = opts.match || /overchat/i;
    const codeRe = opts.codeRe || /(\d{4,6})/;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      let data;
      try {
        data = await this._list(20);
      } catch {
        await sleep(interval);
        continue;
      }
      for (const m of data.messages || []) {
        const to = (m.to || []).map((x) => String(x).toLowerCase());
        if (!to.includes(address.toLowerCase())) continue;
        const created = Date.parse(m.created_at || 0) || 0;
        if (created && created < since) continue;
        const hay = `${m.from || ''} ${m.subject || ''} ${m.snippet || ''}`;
        if (!match.test(hay)) continue;
        // read the full message to be safe
        let body = `${m.subject || ''}\n${m.snippet || ''}`;
        try {
          const one = await fetch(`${this.gateway}/api/v4/agentmail/messages/${encodeURIComponent(m.id)}`, {
            headers: { authorization: 'Bearer ' + this.token },
          });
          if (one.ok) {
            const j = await one.json();
            body = `${j.subject || ''}\n${j.text || ''}\n${m.snippet || ''}`;
          }
        } catch {
          /* snippet is enough */
        }
        const mm = body.match(codeRe);
        if (mm) return { code: mm[1], subject: m.subject, id: m.id };
      }
      await sleep(interval);
    }
    throw new Error('timed out waiting for overchat code to ' + address);
  }
}

/**
 * Minimal IMAP-fetch inbox: uses the `imapflow` package if installed.
 * Kept optional so the toolkit stays zero-dependency by default.
 */
class ImapInbox {
  constructor(opts) {
    this.opts = opts || {};
    this._mod = null;
  }

  create(tag) {
    const [user, domain] = String(this.opts.base || this.opts.user).split('@');
    const t = tag || 'oc' + crypto.randomBytes(4).toString('hex');
    return { address: `${user}+${t}@${domain}`, tag: t };
  }

  async _client() {
    if (!this._mod) {
      try {
        this._mod = require('imapflow');
      } catch {
        throw new Error('ImapInbox requires `npm i imapflow`');
      }
    }
    const { ImapFlow } = this._mod;
    const c = new ImapFlow({
      host: this.opts.host,
      port: this.opts.port || 993,
      secure: true,
      auth: { user: this.opts.user, pass: this.opts.pass },
      logger: false,
    });
    await c.connect();
    return c;
  }

  async waitForCode(address, opts) {
    opts = opts || {};
    const timeout = opts.timeout || 120000;
    const codeRe = opts.codeRe || /(\d{4,6})/;
    const since = new Date((opts.since || Date.now() - 15000));
    const deadline = Date.now() + timeout;
    const client = await this._client();
    try {
      while (Date.now() < deadline) {
        const lock = await client.getMailboxLock('INBOX');
        try {
          for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
            const to = (msg.envelope.to || []).map((a) => (a.address || '').toLowerCase());
            if (!to.includes(address.toLowerCase())) continue;
            if (msg.envelope.date && new Date(msg.envelope.date) < since) continue;
            const text = msg.source ? msg.source.toString('utf8') : '';
            const mm = text.match(codeRe) || (msg.envelope.subject || '').match(codeRe);
            if (mm && /overchat/i.test((msg.envelope.subject || '') + text)) return { code: mm[1], subject: msg.envelope.subject };
          }
        } finally {
          lock.release();
        }
        await sleep(5000);
      }
    } finally {
      await client.logout().catch(() => {});
    }
    throw new Error('timed out waiting for overchat code to ' + address);
  }
}

/** Build an inbox from env/config, auto-picking a provider. */
function getInbox(cfg) {
  cfg = cfg || {};
  if (cfg.provider === 'imap') return new ImapInbox(cfg.imap || {});
  if (cfg.provider === 'agentmail' || process.env.V4_RUN_TOKEN) {
    return new AgentMailInbox({
      gateway: process.env.V4_GATEWAY_URL,
      token: process.env.V4_RUN_TOKEN,
      base: cfg.mailbox || process.env.OVERCHAT_MAILBOX,
      tagPrefix: cfg.tagPrefix || 'oc',
    });
  }
  throw new Error('no inbox provider configured');
}

module.exports = { AgentMailInbox, ImapInbox, getInbox };
