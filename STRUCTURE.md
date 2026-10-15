# Project Structure

```
overchat-bulk-9router/
│
├── README.md                     # English README (badges, quick start)
├── LICENSE                       # MIT
├── package.json                  # zero-dependency Node ≥18
├── config.example.json           # copy to config.json
├── config.json                   # your local config (gitignored)
├── accounts.json                 # created account pool (gitignored)
├── run-adapter.sh                # convenience launcher for the pool adapter
├── .gitignore
│
├── src/
│   ├── cli.js                    # command entrypoint (create | list | health | test | models | serve | connect)
│   ├── config.js                 # config loader (config.json + env overrides)
│   ├── overchat.js               # Overchat API client + createAccount() (the core)
│   ├── pool.js                   # account pool: round-robin, cooldown, health
│   ├── adapter.js                # OpenAI-compatible HTTP server (:8790) over the pool
│   ├── connect-9router.js        # register adapter as a provider into 9Router
│   ├── inbox.js                  # inbox providers (agentmail + imap) for verification codes
│   └── chromium.js               # OPTIONAL local Chromium (raw CDP) — no cloud dependency
│
├── docs/
│   └── PROTOCOL.md               # reverse-engineered Overchat API reference
│
├── brand/
│   ├── logo.svg                  # horizontal wordmark logo
│   └── icon.svg                  # square app icon
│
└── readmes/
    ├── README.id.md              # Bahasa Indonesia
    ├── README.zh.md              # 中文
    ├── README.ja.md              # 日本語
    └── README.es.md              # Español
```

## Data flow

```
create ──▶ accounts.json ──▶ adapter (:8790) ──▶ 9Router (:20128/v1) ──▶ clients
              ▲                    │
          inbox.js            overchat.js (SSE)
     (verification codes)     api.overchat.ai
```

## Module responsibilities

| Module | Responsibility | Key exports |
|--------|----------------|-------------|
| `overchat.js` | Auth, catalog, chat SSE, account creation | `OverchatClient`, `createAccount` |
| `pool.js` | Persist accounts, round-robin, cooldown, health | `Pool` |
| `adapter.js` | OpenAI-compatible server over the pool | — (runs a server) |
| `connect-9router.js` | 9Router admin API: login → key → node → provider | `main` |
| `inbox.js` | Retrieve verification codes | `AgentMailInbox`, `ImapInbox`, `getInbox` |
| `chromium.js` | Optional local Chromium + CDP cookie read | `Chromium`, `findChromium` |
| `config.js` | Merge `config.json` with env | `loadConfig` |
| `cli.js` | Wire everything into commands | — |

## State files

| File | Written by | Purpose |
|------|-----------|---------|
| `accounts.json` | `create` | Account pool (address, token, deviceId, quota) |
| `config.json` | you | Mailbox, ports, 9Router URL |
