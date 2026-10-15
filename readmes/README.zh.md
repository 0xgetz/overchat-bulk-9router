<div align="center">

<img src="../brand/logo.svg" alt="Overchat Bulk → 9Router" width="440"/>

# Overchat Bulk → 9Router

**批量创建 Overchat 账号 · 自动获取令牌与 Cookie · 以负载均衡的 OpenAI 兼容池接入 9Router。**

[![Node](https://img.shields.io/badge/node-%E2%89%A518-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=flat-square)](../package.json)
[![9Router](https://img.shields.io/badge/9Router-compatible-7C8CFF?style=flat-square)](https://9router.com)
[![OpenAI API](https://img.shields.io/badge/OpenAI-compatible-412991?style=flat-square&logo=openai&logoColor=white)](https://platform.openai.com/docs/api-reference)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](../LICENSE)

[English](../README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## 这是什么

一个**零依赖的 Node 工具包**，把 Overchat 变成面向
[9Router](https://9router.com) 的可扩展 OpenAI 兼容后端：

1. **纯 HTTP 批量创建** Overchat 账号（无需浏览器）。
2. **自动获取**每个账号的 `access-token` JWT 与会话 Cookie。
3. 在**自愈账号池**中进行负载均衡（轮询 + 故障转移 + 冷却）。
4. 将池**注册**为 9Router 的一个 OpenAI 兼容 provider。

每个账号都拥有**独立身份**和**自己的免费额度**，而非共享演示账号。

## 原理（关键技巧）

| 方式 | 结果 |
|------|------|
| 普通邮箱登录 | 汇入**共享演示账号**（`sub 00000367-…`），被限流 |
| 邮箱登录 **+ 在 `send-code` 与 `verify` 使用全新 `x-device-uuid`** | 获得**唯一账号**：独立 `sub`、`isGuest:false`、**100 takosCoin** |

> **收件箱说明。** Overchat **拒绝一次性邮箱域名**（返回 `422`）。请使用支持
> **plus 寻址**（`you+tag@domain`）的真实邮箱。

## 快速开始

```bash
cp config.example.json config.json
export OVERCHAT_MAILBOX="you@example.com"
node src/cli.js create --count 5 --concurrency 2
node src/cli.js health
node src/adapter.js            # http://127.0.0.1:8790/v1
node src/connect-9router.js --router https://9router.com --password <pw>
```

```bash
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer $NINEROUTER_KEY" -H "Content-Type: application/json" \
  -d '{"model":"overchat/auto-model","messages":[{"role":"user","content":"你好"}]}'
```

## 命令

| 命令 | 说明 |
|------|------|
| `create --count N` | 批量创建账号至 `accounts.json` |
| `list` / `health` | 查看/检查账号池 |
| `test [model]` | 单次实时补全 |
| `models` | 列出文本模型 |
| `serve` | 运行 OpenAI 兼容适配器 |
| `connect` | 注册适配器到 9Router |

## 模型

Overchat 提供 **约 340 个文本/auto 模型**（另有图像/视频）。`id` 是 **persona slug**——调用
pool 时填入 `model` 字段的就是它。

### ✅ 免费账号可用

已在全新免费账号（`coins:100`、`isGuest:false`）实测可用：

| Persona id | Upstream model | 说明 |
|------------|----------------|------------|
| `auto-model` | `gpt-5-nano` | Overchat 默认 |
| `gemini-3-5-flash` | `google/gemini-3.8-flash` | Gemini flash |
| `ai-text-generator` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `gpt-4o-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `free-chat-gpt-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `qwen-3-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `deepseek-4-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `best-free-ai-chat-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `claude-opus-4-6-landing` | `openai/gpt-4.1-nano` | 别名 → GPT-4.1 nano |
| `grok-4-2-landing` | `openai/gpt-4.1-nano` | 别名 → GPT-4.1 nano |
| `band-name-generator-widget` | `gpt-4.1-nano-2025-04-14` | widget 角色 |
| `dnd-name-generator-widget` | `gpt-4.1-nano-2025-04-14` | widget 角色 |


> "landing"/"widget" 类 persona 是廉价 nano 模型的别名，是最可靠的免费选项。

### 💎 高级模型（需付费计划）

免费账号会返回 **403 "This bot is only available on paid plans"**：

| 模型 | Persona id | 上游模型 |
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

## 注意事项

- 免费额度：每账号 100 takosCoin/天，每日重置。
- 拒绝一次性邮箱域名——请使用真实邮箱。
- 令牌有效期 30 天。
- 仅用于你自己的账号，遵守 Overchat 服务条款。

完整文档见 [English README](../README.md)、`STRUCTURE.md` 与 `docs/PROTOCOL.md`。

## 许可证

[MIT](../LICENSE) © 0xgetz
