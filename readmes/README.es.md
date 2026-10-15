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

~340 modelos de texto/auto (p. ej. `auto-model`, `gemini-3-5-flash`, `claude-5-sonnet`).
Los premium requieren plan de pago (403). Gratis: `auto-model`, `gemini-3-5-flash`.

## Notas

- Cuota gratuita: 100 takosCoin/día por cuenta, se renueva a diario.
- Los dominios de correo desechables se rechazan — usa un buzón real.
- El token dura 30 días.
- Úsalo solo con tus propias cuentas; respeta los Términos de Overchat.

Consulta el [README en inglés](../README.md), `STRUCTURE.md` y `docs/PROTOCOL.md`.

## Licencia

[MIT](../LICENSE) © 0xgetz
