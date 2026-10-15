# Overchat API — reverse-engineered reference

All facts verified **15 Oct 2026** against `https://api.overchat.ai`.

## Base

```
https://api.overchat.ai
```

## Required headers

Every authenticated call needs these, or the API replies
`403 {"message":"Forbidden"}` / `"You don't have permission to access this resource"`:

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <access-token JWT>` |
| `x-device-platform` | `web` |
| `x-device-version` | `1.0.0` (any) |
| `x-device-uuid` | a UUID (see bulk trick) |
| `x-device-language` | `en` |
| `Origin` | `https://overchat.ai` |
| `Referer` | `https://overchat.ai/` |
| `Accept` | `application/json, text/plain, */*` |

The JWT is valid **30 days** and works standalone — **no cookies, no proxy**.

## Signup (email code)

### 1. Send the code

```
POST /v1/auth/email/send-code
{ "email": "you+tag@domain.com" }
-> 200 { "message": "Verification code sent" }
```

Disposable domains are **rejected**:

```
422 { "message": "This email provider is not supported. Please use a different address." }
```

### 2. Verify

```
POST /v1/auth/email/verify
{ "email": "you+tag@domain.com", "code": "1234" }
-> 200 { "access_token": "<JWT>", "firstLogin": true }
```

### The bulk-unique trick

Send the **same fresh `x-device-uuid`** on both `send-code` and `verify`. Then:

| `x-device-uuid` | Resulting account |
|-----------------|-------------------|
| absent / reused | shared **Demo Account**, `sub 00000367-8ed7-45a7-9647-2c35e47c0358`, throttled |
| fresh per account | **unique** `sub`, `isGuest:false`, **100 takosCoin** |

## Account

```
GET /v1/auth/me
-> { id, email, takosCoin, isGuest, subscription: { planCode: "free_registered", ... } }
```

## Catalog

```
GET /v1/personas?view=list
-> [ { id, name, model, type, isDefault, isAgentEnabled, avatar, ... }, ... ]
```

- ~1418 personas total; **~340** of `type` `text` or `auto-model`.
- `id` = persona **slug** (e.g. `auto-model`, `claude-5-sonnet`)
- `model` = upstream **model id** (e.g. `gpt-5-nano`, `anthropic/claude-sonnet-5`)
- **Both are required** in the chat call. Using a `model` id as `personaId` →
  `403 {"error":"Invalid persona id"}`.

Related: `GET /v1/persona-categories`, `GET /v1/widgets/mobile-routes`.

## Chat

```
POST /v1/chat/completions
{
  "model":     "gpt-5-nano",
  "chatId":    "<uuid>",
  "personaId": "auto-model",
  "messages":  [ { "id": "<uuid>", "role": "user", "content": "hi" } ],
  "stream":    true,
  "temperature": 0.5,
  "top_p": 0.95,
  "max_tokens": 4000,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
-> 201 (SSE)
```

Two frame shapes appear:

```txt
# (a) OpenAI chunk                              (most personas)
data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"Hi"},"index":0}]}

# (b) Responses-API event                        (some personas, e.g. Gemini)
data: {"event":"response.output_text.delta","data":{"delta":"Hi"}}

# terminator
data: [DONE]
```

Stop a generation: `POST /v1/chat/completions/stop { chatId, personaId }`.

## Plan gating

- Free account: `100 takosCoin / day`, resets daily.
- Premium models: `403 {"error":"This bot is only available on paid plans"}`.
- Quota spent: `403 {"error":"You've reached your plan quota. …"}`, with a
  `reset after <n>m` hint on the HTTP error path.
- **Usable on free** (verified live on fresh `coins:100` accounts): `auto-model`
  (`gpt-5-nano`), `gemini-3-5-flash` (`google/gemini-3.8-flash`), and every persona that
  maps to a cheap nano model — the "landing"/"widget" aliases:
  `ai-text-generator`, `gpt-4o-landing`, `free-chat-gpt-landing`, `qwen-3-landing`,
  `deepseek-4-landing`, `best-free-ai-chat-landing`, `claude-opus-4-6-landing`,
  `grok-4-2-landing` (all → `openai/gpt-4.1-nano`), plus `band-name-generator-widget`,
  `dnd-name-generator-widget` (→ `gpt-4.1-nano-2025-04-14`).
  See the **Models** section of the README for the full free vs premium tables.

## Other endpoints (from the web bundle)

`/v1/chat/suggestions`, `/v1/chat/thread`, `/v1/chat/upload`, `/v1/prompt/enhance`,
`/v1/images/generation`, `/v1/videos/generations`, `/v1/audio/generations`,
`/v1/billing/plans`, `/v1/billing/*`, `/v2/chat/responses`, `/v2/chat/auto-route-preview`.
