<div align="center">

<img src="../brand/logo.svg" alt="Overchat Bulk → 9Router" width="440"/>

# Overchat Bulk → 9Router

**Buat akun Overchat secara massal · ambil token & cookie otomatis · sajikan sebagai pool OpenAI-compatible yang load-balanced ke 9Router.**

[![Node](https://img.shields.io/badge/node-%E2%89%A518-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=flat-square)](../package.json)
[![9Router](https://img.shields.io/badge/9Router-compatible-7C8CFF?style=flat-square)](https://9router.com)
[![OpenAI API](https://img.shields.io/badge/OpenAI-compatible-412991?style=flat-square&logo=openai&logoColor=white)](https://platform.openai.com/docs/api-reference)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](../LICENSE)

[English](../README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## Apa ini

Toolkit Node **tanpa dependensi** yang mengubah Overchat menjadi backend
OpenAI-compatible yang skalabel untuk [9Router](https://9router.com):

1. **Buat massal** akun Overchat lewat HTTP murni (tanpa browser).
2. **Ambil otomatis** JWT `access-token` dan cookie sesi tiap akun.
3. **Load-balance** dalam pool akun mandiri (round-robin + failover + cooldown).
4. **Daftarkan** pool ke 9Router sebagai satu provider OpenAI-compatible.

Setiap akun punya **identitas unik** dan **kuota gratisnya sendiri** — bukan akun demo
bersama.

## Kenapa berhasil (trik utamanya)

| Cara | Hasil |
|------|-------|
| Login email biasa | Menyatu ke **Demo Account bersama** (`sub 00000367-…`) — ter-throttle |
| Login email **+ `x-device-uuid` baru** pada `send-code` dan `verify` | Akun **unik**: `sub` sendiri, `isGuest:false`, **100 takosCoin** |

> **Catatan inbox.** Overchat **menolak domain disposable** (`422`). Gunakan mailbox asli
> yang mendukung **plus-addressing** (`kamu+tag@domain`).

## Mulai cepat

```bash
cp config.example.json config.json
export OVERCHAT_MAILBOX="kamu@example.com"
node src/cli.js create --count 5 --concurrency 2
node src/cli.js health
node src/adapter.js            # http://127.0.0.1:8790/v1
node src/connect-9router.js --router https://9router.com --password <pw>
```

```bash
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer $NINEROUTER_KEY" -H "Content-Type: application/json" \
  -d '{"model":"overchat/auto-model","messages":[{"role":"user","content":"halo"}]}'
```

## Perintah CLI

| Perintah | Keterangan |
|----------|------------|
| `create --count N` | Buat massal akun ke `accounts.json` |
| `list` / `health` | Lihat pool / cek semua akun |
| `test [model]` | Satu completion langsung |
| `models` | Daftar model teks |
| `serve` | Jalankan adapter OpenAI-compatible |
| `connect` | Daftarkan adapter ke 9Router |

## Model

Overchat mengekspos **~340 model teks/auto** (plus gambar/video). `id` adalah **slug
persona** — inilah nama yang kamu pakai di field `model` saat memanggil pool.

### ✅ Berfungsi di akun GRATIS

Terverifikasi langsung di akun gratis baru (`coins:100`, `isGuest:false`):

| Persona id | Upstream model | Keterangan |
|------------|----------------|------------|
| `auto-model` | `gpt-5-nano` | default Overchat |
| `gemini-3-5-flash` | `google/gemini-3.8-flash` | Gemini flash |
| `ai-text-generator` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `gpt-4o-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `free-chat-gpt-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `qwen-3-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `deepseek-4-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `best-free-ai-chat-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `claude-opus-4-6-landing` | `openai/gpt-4.1-nano` | alias → GPT-4.1 nano |
| `grok-4-2-landing` | `openai/gpt-4.1-nano` | alias → GPT-4.1 nano |
| `band-name-generator-widget` | `gpt-4.1-nano-2025-04-14` | persona widget |
| `dnd-name-generator-widget` | `gpt-4.1-nano-2025-04-14` | persona widget |


> Persona "landing"/"widget" adalah alias ke model nano murah — paling andal untuk gratis.

### 💎 Premium (butuh plan berbayar)

Mengembalikan **403 "This bot is only available on paid plans"** di akun gratis:

| Model | Persona id | Model upstream |
|-------|-----------|----------|
| Claude Opus 5.5 | `claude-opus-5-5` | `anthropic/claude-opus-5.5` |
| Claude Opus 5 | `claude-opus-5` | `anthropic/claude-opus-5` |
| Claude Opus 4.8 | `opus-4-8` | `anthropic/claude-opus-4.8` |
| Claude Opus 4.5 | `claude-opus-4-5` | `claude-opus-4-5-20251101` |
| Claude 5 Sonnet | `claude-5-sonnet` | `anthropic/claude-sonnet-5` |
| Claude Sonnet 4.6 | `claude-4-6-sonnet` | `anthropic/claude-sonnet-4.6` |
| Claude 4.5 Haiku | `Claude-Haiku-4-5` | `anthropic/claude-haiku-4.5` |
| Claude Fable 5.1 | `claude-fable-5-1` | `anthropic/claude-fable-5.1` |
| GPT-6 Sol | `gpt-5-6` | `gpt-6-sol` |
| GPT-6 Luna | `gpt-5-6-luna` | `gpt-6-luna` |
| GPT-5.5 | `gpt-5-5` | `gpt-5.5-2026-04-23` |
| GPT-5.4 | `GPT-5-4` | `gpt-5.4-2026-03-05` |
| ChatGPT 5.2 | `gpt-5-2` | `gpt-5.2-2025-12-11` |
| ChatGPT 5 | `gpt-5` | `gpt-5` |
| ChatGPT 5 mini | `gpt-5-mini` | `gpt-5-mini-2025-08-07` |
| Gemini 4 Argon | `gemini-4-argon` | `google/gemini-4-argon` |
| Gemini 3 Pro | `gemini-3-pro` | `google/gemini-3.1-pro-preview` |
| Grok 4.7 | `grok-4-5` | `x-ai/grok-4.7` |
| Grok 4 | `grok-4` | `grok-4` |
| DeepSeek V4 Pro | `deepseek-v4-pro` | `deepseek/deepseek-v4-pro-0813` |
| DeepSeek V3.2 | `deepseek-v-3-2` | `deepseek/deepseek-v3.2-exp` |
| Qwen 3.8 Max | `qwen-3-7-max` | `qwen/qwen3.8-max-0902` |
| Kimi K3 | `kimi-k3` | `moonshotai/kimi-k3` |
| Kimi K2.6 | `kimi-k2-6` | `moonshotai/kimi-k2.6` |
| GLM 5.3 | `glm-5-3` | `z-ai/glm-5.3` |
| MiniMax M3 | `minimax-m3` | `minimax/minimax-m3` |
| Llama 4 Maverick | `llama-4-maverick` | `meta-llama/llama-4-maverick` |
| Mistral Nemo | `mistralai-mistral-nemo` | `mistralai/mistral-nemo` |

## Catatan

- Kuota gratis 100 takosCoin/hari per akun, diperbarui harian.
- Domain email disposable ditolak — pakai mailbox asli.
- Token berlaku 30 hari.
- Gunakan hanya untuk akun milikmu sendiri; patuhi ToS Overchat.

Ikuti [README English](../README.md) untuk dokumentasi lengkap, `STRUCTURE.md`, dan
`docs/PROTOCOL.md`.

## Lisensi

[MIT](../LICENSE) © 0xgetz
