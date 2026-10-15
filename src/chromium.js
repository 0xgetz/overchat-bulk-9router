'use strict';

/**
 * Optional local Chromium helper.
 *
 * The bulk flow is pure HTTP and needs no browser. But some setups prefer to
 * drive the Overchat web UI in a real Chromium (to read the session cookie
 * `access-token` after a manual/UI login, or to complete a signup the API
 * declines).
 *
 * This module targets a **local Chromium** launched with a debug port — no
 * cloud service, no `BU_CDP_WS`. It speaks raw CDP over WebSocket with zero
 * npm dependencies.
 *
 *   const ch = new Chromium({ port: 9222 });
 *   await ch.launch();               // spawns ./chrome-profile unless already up
 *   const token = await ch.readOverchatToken();
 *   await ch.close();
 *
 * Chromium binary resolution order:
 *   1. opts.executablePath
 *   2. $CHROME_PATH
 *   3. common system paths (google-chrome, chromium, chromium-browser, msedge)
 *   4. a Playwright cache under ~/.cache/ms-playwright (if present)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tls = require('tls');
const crypto = require('crypto');
const { URL } = require('url');

const OS = process.platform;
const CANDIDATES = {
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

function findChromium(explicit) {
  if (explicit && fs.existsSync(explicit)) return explicit;
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CANDIDATES[OS] || []) if (fs.existsSync(p)) return p;
  // Playwright cache
  try {
    const base = path.join(os.homedir(), '.cache', 'ms-playwright');
    for (const d of fs.readdirSync(base)) {
      if (!d.startsWith('chromium')) continue;
      const guess =
        OS === 'darwin'
          ? path.join(base, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
          : OS === 'win32'
          ? path.join(base, d, 'chrome-win', 'chrome.exe')
          : path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(guess)) return guess;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function waitHttp(url, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  return new Promise((resolve, reject) => {
    const poll = () => {
      fetch(url)
        .then((r) => r.json())
        .then(resolve)
        .catch(() => (Date.now() > deadline ? reject(new Error('chromium debug port not reachable')) : setTimeout(poll, 400)));
    };
    poll();
  });
}

/** Minimal RFC6455 client over http(s). */
class WsClient {
  constructor(wsUrl) {
    this.url = wsUrl;
    this.handlers = new Map();
    this.onText = null;
  }
  connect() {
    const u = new URL(this.url);
    const secure = u.protocol === 'wss:';
    const port = u.port || (secure ? 443 : 80);
    const key = crypto.randomBytes(16).toString('base64');
    return new Promise((resolve, reject) => {
      const onReady = (sock) => {
        sock.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
            `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        );
      };
      const sock = secure
        ? tls.connect({ host: u.hostname, port, servername: u.hostname }, () => onReady(sock))
        : require('net').connect({ host: u.hostname, port }, () => onReady(sock));
      sock.once('error', reject);
      let handshake = false;
      let buf = Buffer.alloc(0);
      sock.on('data', (chunk) => {
        if (!handshake) {
          buf = Buffer.concat([buf, chunk]);
          const i = buf.indexOf('\r\n\r\n');
          if (i < 0) return;
          handshake = true;
          buf = buf.slice(i + 4);
          this.sock = sock;
          resolve();
          if (buf.length) this._frames(buf);
          return;
        }
        this._frames(chunk);
      });
    });
  }
  _frames(data) {
    let buf = Buffer.concat([this._buf || Buffer.alloc(0), data]);
    while (buf.length >= 2) {
      const opcode = buf[0] & 0x0f;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) break;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) break;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      if (buf[1] & 0x80) off += 4;
      if (buf.length < off + len) break;
      const payload = buf.slice(off, off + len);
      buf = buf.slice(off + len);
      if (opcode === 0x1 || opcode === 0x2) this.onText && this.onText(payload.toString('utf8'));
      else if (opcode === 0x9) this.send(payload, 0xa);
    }
    this._buf = buf;
  }
  send(payload, opcode) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const mask = crypto.randomBytes(4);
    const len = data.length;
    let head;
    if (len < 126) {
      head = Buffer.alloc(2);
      head[1] = 0x80 | len;
    } else if (len < 65536) {
      head = Buffer.alloc(4);
      head[1] = 0x80 | 126;
      head.writeUInt16BE(len, 2);
    } else {
      head = Buffer.alloc(10);
      head[1] = 0x80 | 127;
      head.writeBigUInt64BE(BigInt(len), 2);
    }
    head[0] = 0x80 | (opcode || 0x1);
    const masked = Buffer.from(data.map((b, i) => b ^ mask[i % 4]));
    this.sock.write(Buffer.concat([head, mask, masked]));
  }
  call(method, params, sessionId) {
    const id = Math.floor(Math.random() * 1e9);
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout ' + method)), 30000);
      this.handlers.set(id, (m) => {
        clearTimeout(to);
        if (m.error) reject(new Error(method + ': ' + m.error.message));
        else resolve(m.result);
      });
      this.send(JSON.stringify(msg));
    });
  }
  close() {
    try {
      this.sock && this.sock.end();
    } catch {
      /* ignore */
    }
  }
}

class Chromium {
  constructor(opts) {
    opts = opts || {};
    this.port = opts.port || 9222;
    this.executablePath = opts.executablePath;
    this.userDataDir = opts.userDataDir || path.resolve(process.cwd(), '.chrome-profile');
    this.headless = opts.headless !== false;
    this._proc = null;
  }

  async launch() {
    try {
      const v = await waitHttp(`http://127.0.0.1:${this.port}/json/version`, 1500);
      this._ws = v.webSocketDebuggerUrl;
      return this;
    } catch {
      /* not running, spawn */
    }
    const bin = findChromium(this.executablePath);
    if (!bin) throw new Error('no Chromium binary found; set CHROME_PATH or opts.executablePath');
    const args = [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ];
    if (this.headless) args.push('--headless=new');
    this._proc = spawn(bin, args, { detached: true, stdio: 'ignore' });
    this._proc.unref();
    const v = await waitHttp(`http://127.0.0.1:${this.port}/json/version`, 20000);
    this._ws = v.webSocketDebuggerUrl;
    return this;
  }

  async _socket() {
    const ws = new WsClient(this._ws);
    await ws.connect();
    ws.onText = (txt) => {
      let m;
      try {
        m = JSON.parse(txt);
      } catch {
        return;
      }
      if (m.id && ws.handlers.has(m.id)) {
        const cb = ws.handlers.get(m.id);
        ws.handlers.delete(m.id);
        cb(m);
      }
    };
    return ws;
  }

  /** Open (or reuse) an overchat.ai tab and read the `access-token` cookie. */
  async readOverchatToken(opts) {
    opts = opts || {};
    const ws = await this._socket();
    try {
      const t = await ws.call('Target.createTarget', { url: opts.url || 'https://overchat.ai/web/' });
      await new Promise((r) => setTimeout(r, opts.waitMs || 6000));
      const att = await ws.call('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      const cookies = await ws.call('Network.getAllCookies', {}, att.sessionId);
      const jwt = cookies.cookies.find((c) => c.name === 'access-token' && /overchat\.ai/.test(c.domain));
      if (!jwt) throw new Error('access-token cookie not found — is the browser logged in?');
      return jwt.value;
    } finally {
      ws.close();
    }
  }

  async close() {
    try {
      if (this._ws) {
        const ws = await this._socket();
        await ws.call('Browser.close', {}).catch(() => {});
        ws.close();
      }
    } catch {
      /* ignore */
    }
  }
}

module.exports = { Chromium, findChromium };
