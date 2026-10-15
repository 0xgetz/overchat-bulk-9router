'use strict';

/**
 * Account pool: a JSON store of created accounts plus health checks.
 * Accounts are tried round-robin; unhealthy ones are cooled down.
 */

const fs = require('fs');
const path = require('path');
const { OverchatClient } = require('./overchat');

const DEFAULT_POOL = path.resolve(__dirname, '..', 'accounts.json');

class Pool {
  constructor(file) {
    this.file = file || DEFAULT_POOL;
    this.accounts = [];
    this.load();
    this._rr = 0;
  }

  load() {
    try {
      this.accounts = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!Array.isArray(this.accounts)) this.accounts = [];
    } catch {
      this.accounts = [];
    }
    return this.accounts;
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.accounts, null, 2));
  }

  add(account) {
    const i = this.accounts.findIndex((a) => a.address === account.address);
    if (i >= 0) this.accounts[i] = Object.assign(this.accounts[i], account);
    else this.accounts.push(account);
    this.save();
    return account;
  }

  get size() {
    return this.accounts.length;
  }

  /** Next healthy account (round-robin), or null. */
  next() {
    const now = Date.now();
    const n = this.accounts.length;
    if (!n) return null;
    for (let k = 0; k < n; k++) {
      const a = this.accounts[(this._rr + k) % n];
      if (!a.cooldownUntil || a.cooldownUntil < now) {
        this._rr = (this._rr + k + 1) % n;
        return a;
      }
    }
    return null;
  }

  markError(account, cooldownMs) {
    account.errorCount = (account.errorCount || 0) + 1;
    account.cooldownUntil = Date.now() + (cooldownMs || 120000);
    account.lastErrorAt = new Date().toISOString();
    this.save();
  }

  markOk(account) {
    account.errorCount = 0;
    account.cooldownUntil = 0;
    account.lastOkAt = new Date().toISOString();
    this.save();
  }

  client(account) {
    return new OverchatClient(account.token, account.deviceId);
  }

  async health(account) {
    try {
      const me = await this.client(account).me();
      return { ok: true, coins: me.takosCoin, isGuest: me.isGuest };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = { Pool, DEFAULT_POOL };
