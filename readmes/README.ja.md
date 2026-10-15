<div align="center">

<img src="../brand/logo.svg" alt="Overchat Bulk → 9Router" width="440"/>

# Overchat Bulk → 9Router

**Overchat アカウントを一括作成 · トークンと Cookie を自動取得 · ロードバランス型の OpenAI 互換プールとして 9Router に接続。**

[![Node](https://img.shields.io/badge/node-%E2%89%A518-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue?style=flat-square)](../package.json)
[![9Router](https://img.shields.io/badge/9Router-compatible-7C8CFF?style=flat-square)](https://9router.com)
[![OpenAI API](https://img.shields.io/badge/OpenAI-compatible-412991?style=flat-square&logo=openai&logoColor=white)](https://platform.openai.com/docs/api-reference)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](../LICENSE)

[English](../README.md) · [Bahasa Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## これは何か

[9Router](https://9router.com) 向けに、Overchat をスケーラブルな OpenAI 互換
バックエンドへ変える**依存ゼロの Node ツールキット**です：

1. **純粋な HTTP で一括作成**（ブラウザ不要）。
2. 各アカウントの `access-token` JWT とセッション Cookie を**自動取得**。
3. **自己修復アカウントプール**でロードバランス（ラウンドロビン＋フェイルオーバー＋クールダウン）。
4. プールを 9Router の単一 OpenAI 互換プロバイダとして**登録**。

各アカウントは**固有の ID** と**独自の無料枠**を持ちます（共有デモアカウントではありません）。

## 仕組み（重要なコツ）

| 方法 | 結果 |
|------|------|
| 通常のメールログイン | **共有デモアカウント**（`sub 00000367-…`）に集約され制限される |
| メールログイン **+ `send-code` と `verify` に新しい `x-device-uuid`** | **固有アカウント**：独自 `sub`、`isGuest:false`、**100 takosCoin** |

> **受信箱の注意。** Overchat は**使い捨てメールドメインを拒否**します（`422`）。
> **プラスアドレッシング**（`you+tag@domain`）対応の実メールボックスを使用してください。

## クイックスタート

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
  -d '{"model":"overchat/auto-model","messages":[{"role":"user","content":"こんにちは"}]}'
```

## コマンド

| コマンド | 説明 |
|----------|------|
| `create --count N` | `accounts.json` へ一括作成 |
| `list` / `health` | プール表示 / 全アカウント確認 |
| `test [model]` | 1 回のライブ補完 |
| `models` | テキストモデル一覧 |
| `serve` | OpenAI 互換アダプタを起動 |
| `connect` | アダプタを 9Router に登録 |

## モデル

Overchat は **約 340 のテキスト/auto モデル**（画像/動画も）を公開しています。`id` は
**persona slug** で、pool を呼ぶときの `model` フィールドにこれを指定します。

### ✅ 無料アカウントで動作

新しい無料アカウント（`coins:100`、`isGuest:false`）で実測済み：

| Persona id | Upstream model | 備考 |
|------------|----------------|------|
| `auto-model` | `gpt-5-nano` | Overchat デフォルト |
| `gemini-3-5-flash` | `google/gemini-3.8-flash` | Gemini flash |
| `ai-text-generator` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `gpt-4o-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `free-chat-gpt-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `qwen-3-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `deepseek-4-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `best-free-ai-chat-landing` | `openai/gpt-4.1-nano` | GPT-4.1 nano |
| `claude-opus-4-6-landing` | `openai/gpt-4.1-nano` | 別名 → GPT-4.1 nano |
| `grok-4-2-landing` | `openai/gpt-4.1-nano` | 別名 → GPT-4.1 nano |
| `band-name-generator-widget` | `gpt-4.1-nano-2025-04-14` | ウィジェット |
| `dnd-name-generator-widget` | `gpt-4.1-nano-2025-04-14` | ウィジェット |


> "landing"/"widget" persona は安価な nano モデルへのエイリアスで、最も確実な無料枠です。

### 💎 プレミアム（有料プランが必要）

無料アカウントでは **403 "This bot is only available on paid plans"** を返します：

| モデル | Persona id | 上流モデル |
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

## 注意

- 無料枠は 1 アカウント 100 takosCoin/日、毎日更新。
- 使い捨てメールドメインは拒否 — 実メールボックスを使用。
- トークン有効期限は 30 日。
- 自分のアカウントのみに使用し、Overchat の規約を遵守してください。

詳細は [English README](../README.md)、`STRUCTURE.md`、`docs/PROTOCOL.md` を参照。

## ライセンス

[MIT](../LICENSE) © 0xgetz
