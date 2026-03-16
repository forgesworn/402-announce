/**
 * Lower-level 402-announce example — build and sign without publishing
 *
 * Use buildAnnounceEvent() when you manage relay connections yourself
 * (e.g. sharing a connection pool across multiple libraries).
 *
 * Prerequisites:
 *   - A 64-character hex Nostr secret key
 *
 * Run:
 *   npx tsx examples/build-event.ts
 */

import { Relay } from 'nostr-tools/relay'
import { buildAnnounceEvent } from '402-announce'

const NOSTR_SECRET_KEY = process.env.NOSTR_SECRET_KEY
if (!NOSTR_SECRET_KEY) {
  console.error('Set NOSTR_SECRET_KEY environment variable (64-char hex)')
  process.exit(1)
}

// Build and sign the event — no relay connection yet
// Note: secretKey appears both as the first arg and in the config object
// because the config type includes it (Omit<AnnounceConfig, 'relays'>).
const event = buildAnnounceEvent(NOSTR_SECRET_KEY, {
  secretKey: NOSTR_SECRET_KEY,
  identifier: 'translation-api',
  name: 'Translation API',
  urls: ['https://translate.example.com/api'],
  about: 'Machine translation behind an L402 paywall',
  pricing: [
    { capability: 'translate', price: 2, currency: 'sats' },
  ],
  paymentMethods: ['bitcoin-lightning-bolt11'],
  capabilities: [
    { name: 'translate', description: 'Translate text between languages' },
  ],
})

console.log('Signed event ID:', event.id)
console.log('Pubkey:', event.pubkey)
console.log('Tags:', JSON.stringify(event.tags, null, 2))

// Publish to a relay manually
const relay = await Relay.connect('wss://relay.damus.io')
await relay.publish(event)
console.log('Published to relay')
relay.close()
