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

約 340 のテキスト/auto モデル（例：`auto-model`、`gemini-3-5-flash`、`claude-5-sonnet`）。
プレミアムは有料プランが必要（403）。無料枠：`auto-model`、`gemini-3-5-flash`。

## 注意

- 無料枠は 1 アカウント 100 takosCoin/日、毎日更新。
- 使い捨てメールドメインは拒否 — 実メールボックスを使用。
- トークン有効期限は 30 日。
- 自分のアカウントのみに使用し、Overchat の規約を遵守してください。

詳細は [English README](../README.md)、`STRUCTURE.md`、`docs/PROTOCOL.md` を参照。

## ライセンス

[MIT](../LICENSE) © 0xgetz
