<div align="center">

<img src="../brand/logo.svg" alt="Overchat Bulk → 9Router" width="440"/>

# Overchat Bulk → 9Router

**Crea cuentas de Overchat en lote · captura tokens y cookies automáticamente · sirve un pool compatible con OpenAI y balanceado a 9Router.**

[![Node](https://img.shields.io/badge/node-%E2%89%A518-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=flat-square)](../package.json)
[![9Router](https://img.shields.io/badge/9Router-compatible-7C8CFF?style=flat-square)](https://9router.com)
[![OpenAI API](https://img.shields.io/badge/OpenAI-compatible-412991?style=flat-square&logo=openai&logoColor=white)](https://platform.openai.com/docs/api-reference)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](../LICENSE)

[English](../README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## Qué es

Un **toolkit de Node sin dependencias** que convierte Overchat en un backend
compatible con OpenAI y escalable para [9Router](https://9router.com):

1. **Crea en lote** cuentas de Overchat por HTTP puro (sin navegador).
2. **Captura automáticamente** el JWT `access-token` y las cookies de cada cuenta.
3. **Balancea la carga** en un pool autorreparable (round-robin + failover + cooldown).
4. **Registra** el pool en 9Router como un único proveedor compatible con OpenAI.

Cada cuenta tiene **identidad única** y **su propia cuota gratuita**, no la cuenta demo compartida.

## Por qué funciona (el truco clave)

| Método | Resultado |
|--------|-----------|
| Login por email normal | Se colapsa en la **Cuenta Demo compartida** (`sub 00000367-…`), limitada |
| Login por email **+ un `x-device-uuid` nuevo** en `send-code` y `verify` | Cuenta **única**: `sub` propio, `isGuest:false`, **100 takosCoin** |

> **Nota de bandeja.** Overchat **rechaza dominios desechables** (`422`). Usa un buzón real
> con **plus-addressing** (`tu+tag@dominio`).

## Inicio rápido

```bash
cp config.example.json config.json
export OVERCHAT_MAILBOX="tu@example.com"
node src/cli.js create --count 5 --concurrency 2
node src/cli.js health
node src/adapter.js            # http://127.0.0.1:8790/v1
node src/connect-9router.js --router https://9router.com --password <pw>
```

```bash
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer $NINEROUTER_KEY" -H "Content-Type: application/json" \
  -d '{"model":"overchat/auto-model","messages":[{"role":"user","content":"hola"}]}'
```

## Comandos CLI

| Comando | Descripción |
|---------|-------------|
| `create --count N` | Crear cuentas en `accounts.json` |
| `list` / `health` | Ver / verificar el pool |
| `test [model]` | Una completion en vivo |
| `models` | Listar modelos de texto |
| `serve` | Ejecutar el adaptador compatible con OpenAI |
| `connect` | Registrar el adaptador en 9Router |

## Modelos

Overchat expone **~340 modelos de texto/auto** (más imagen/vídeo). El `id` es el **slug de
persona** — ese es el nombre que pones en el campo `model` al llamar al pool.

### ✅ Funcionan en cuenta GRATIS

Verificado en vivo en cuentas gratuitas nuevas (`coins:100`, `isGuest:false`):

| Persona id | Upstream model | Nota |
|------------|----------------|------------|
| `auto-model` | `gpt-5-nano` | por defecto de Overchat |
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


> Las personas "landing"/"widget" son alias de modelos nano baratos — las opciones gratis
> más fiables.

### 💎 Premium (requiere plan de pago)

Devuelven **403 "This bot is only available on paid plans"** en cuenta gratis:

| Modelo | Persona id | Modelo upstream |
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

## Notas

- Cuota gratuita: 100 takosCoin/día por cuenta, se renueva a diario.
- Los dominios de correo desechables se rechazan — usa un buzón real.
- El token dura 30 días.
- Úsalo solo con tus propias cuentas; respeta los Términos de Overchat.

Consulta el [README en inglés](../README.md), `STRUCTURE.md` y `docs/PROTOCOL.md`.

## Licencia

[MIT](../LICENSE) © 0xgetz
