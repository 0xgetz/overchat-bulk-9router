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

约 340 个文本/auto 模型（如 `auto-model`、`gemini-3-5-flash`、`claude-5-sonnet`）。
高级模型需付费计划（403）。免费账号可用：`auto-model`、`gemini-3-5-flash`。

## 注意事项

- 免费额度：每账号 100 takosCoin/天，每日重置。
- 拒绝一次性邮箱域名——请使用真实邮箱。
- 令牌有效期 30 天。
- 仅用于你自己的账号，遵守 Overchat 服务条款。

完整文档见 [English README](../README.md)、`STRUCTURE.md` 与 `docs/PROTOCOL.md`。

## 许可证

[MIT](../LICENSE) © 0xgetz
