# How to Announce Your Paid API on Nostr

This guide walks you through publishing a kind 31402 Nostr event that announces
your HTTP 402 paid API for decentralised discovery.

## Prerequisites

- Node.js 18+
- A paid API endpoint (e.g. behind [toll-booth](https://github.com/forgesworn/toll-booth))
- A Nostr keypair (64-char hex secret key)

## Install

```bash
npm install 402-announce
```

## Quick Start

```typescript
import { announceService } from '402-announce'

const handle = await announceService({
  secretKey: process.env.NOSTR_SECRET_KEY!,
  relays: ['wss://relay.damus.io', 'wss://relay.primal.net'],
  identifier: 'my-api',
  name: 'My Paid API',
  urls: ['https://api.example.com'],
  about: 'A useful API behind an L402 paywall',
  pricing: [
    { capability: 'query', price: 1, currency: 'sats' },
  ],
  paymentMethods: [['l402', 'lightning']],
})

console.log('Published:', handle.eventId)
console.log('Pubkey:', handle.pubkey)

// Clean shutdown
process.on('SIGINT', () => { handle.close(); process.exit(0) })
```

## What Gets Published

A kind 31402 parameterised replaceable event (NIP-33) with tags:

| Tag | Value |
|-----|-------|
| `d` | Your identifier (unique per pubkey) |
| `name` | Service name |
| `url` | HTTP endpoint |
| `about` | Description |
| `pmi` | Payment method identifiers |
| `price` | Per-capability pricing |
| `t` | Topic tags (optional) |

## Verify on Relays

Check your event with any Nostr client that supports kind 31402, or query directly:

```bash
# Using nak (Nostr Army Knife)
nak req -k 31402 wss://relay.damus.io
```

## Live Example

[jokes.trotters.dev](https://jokes.trotters.dev) is a live API announcing on Nostr.
It uses toll-booth for L402 payments and 402-announce for discovery.

## Multiple Payment Methods

Announce that you accept both Lightning and Cashu ecash:

```typescript
paymentMethods: [['l402', 'lightning'], ['xcashu']],
```

Each entry is an array where the first element is the rail (`l402`, `cashu`, `xcashu`, `x402`, `payment`) and subsequent elements are rail-specific parameters. Agents discovering your service will see both options and choose what they support.

## Using with toll-booth

If you're using toll-booth, use [toll-booth-announce](https://github.com/forgesworn/toll-booth-announce)
for automatic config mapping:

```typescript
import { announce } from 'toll-booth-announce'

const handle = await announce(boothConfig, {
  secretKey: process.env.NOSTR_SECRET_KEY!,
  relays: ['wss://relay.damus.io'],
  urls: ['https://api.example.com'],
  about: 'My toll-booth API',
})
```

Pricing and payment methods are auto-derived from your booth config.
