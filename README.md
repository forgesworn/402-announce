# 402-announce

Announce HTTP 402 services on Nostr for decentralised discovery. Supports both L402 and x402 payment protocols.

[![MIT Licence](https://img.shields.io/badge/licence-MIT-blue.svg)](./LICENSE)

Publishes **kind 31402** parameterised replaceable events so that AI agents (and any Nostr client) can discover paid APIs without a central registry.

## Quick start

```bash
npm install 402-announce
```

```typescript
import { announceService } from '402-announce'

const handle = await announceService({
  secretKey: '64-char-hex-nostr-secret-key',
  relays: ['wss://relay.damus.io', 'wss://relay.primal.net'],
  identifier: 'jokes-api',
  name: 'Jokes API',
  url: 'https://jokes.example.com',
  about: 'A joke-telling service behind an L402 paywall',
  pricing: [
    { capability: 'get_joke', price: 1, currency: 'sats' },
  ],
  paymentMethods: ['bitcoin-lightning-bolt11', 'bitcoin-cashu'],
  topics: ['comedy', 'ai'],
  capabilities: [
    { name: 'get_joke', description: 'Returns a random joke' },
  ],
  version: '1.0.0',
})

console.log('Published event:', handle.eventId)
console.log('From pubkey:', handle.pubkey)

// Later, when shutting down:
handle.close()
```

## Event format

Each announcement is a **kind 31402** parameterised replaceable event. The combination of `pubkey` + `d` tag uniquely identifies a listing -- publishing again with the same values updates the existing listing.

### Tags

| Tag       | Description                                  | Example                           |
|-----------|----------------------------------------------|-----------------------------------|
| `d`       | Unique identifier for this listing           | `jokes-api`                       |
| `name`    | Human-readable service name                  | `Jokes API`                       |
| `url`     | HTTP endpoint for the 402 service            | `https://jokes.example.com`       |
| `about`   | Short description                            | `A joke-telling service`          |
| `pmi`     | Payment method identifier (repeatable)       | `bitcoin-lightning-bolt11`        |
| `price`   | Capability pricing (repeatable)              | `get_joke`, `1`, `sats`           |
| `t`       | Topic tag for search/filtering (repeatable)  | `comedy`                          |
| `picture` | Optional icon URL                            | `https://example.com/icon.png`    |

### Content

The event content is a JSON object with optional fields:

```json
{
  "capabilities": [
    { "name": "get_joke", "description": "Returns a random joke" }
  ],
  "version": "1.0.0"
}
```

## What it does

- Builds and signs kind 31402 Nostr events
- Publishes to one or more Nostr relays
- Zeroises secret key bytes after use
- Degrades gracefully when individual relays fail
- Provides a `close()` handle for clean disconnection

## What it does not do

- Does not run an L402 paywall (use [toll-booth](https://github.com/TheCryptoDonkey/toll-booth) for that)
- Does not subscribe to or search for announcements (use [402-mcp](https://github.com/TheCryptoDonkey/402-mcp) for that)
- Does not handle payments or token verification

## Ecosystem

| Package | Purpose |
|---------|---------|
| [toll-booth](https://github.com/TheCryptoDonkey/toll-booth) | L402 middleware -- any API becomes a toll booth in minutes |
| [satgate](https://github.com/TheCryptoDonkey/satsgate) | Production L402 gateway with Lightning and Cashu support |
| [402-mcp](https://github.com/TheCryptoDonkey/402-mcp) | MCP server for AI agents to discover, pay, and consume 402 APIs |

## Licence

[MIT](./LICENSE)
