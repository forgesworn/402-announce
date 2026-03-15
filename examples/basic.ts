/**
 * Basic 402-announce example
 *
 * Announces a paid API on Nostr so AI agents can discover it.
 *
 * Prerequisites:
 *   - A 64-character hex Nostr secret key (generate with nostr-tools or any Nostr key tool)
 *   - One or more Nostr relay URLs
 *
 * Run:
 *   npx tsx examples/basic.ts
 */

import { announceService } from '402-announce'

const NOSTR_SECRET_KEY = process.env.NOSTR_SECRET_KEY
if (!NOSTR_SECRET_KEY) {
  console.error('Set NOSTR_SECRET_KEY environment variable (64-char hex)')
  process.exit(1)
}

const handle = await announceService({
  secretKey: NOSTR_SECRET_KEY,
  relays: ['wss://relay.damus.io', 'wss://relay.primal.net'],

  // Unique identifier for this listing — same pubkey + identifier updates the listing
  identifier: 'weather-api',

  name: 'Weather API',
  url: 'https://weather.example.com/api',
  about: 'Real-time weather data behind an L402 paywall',

  // Per-capability pricing
  pricing: [
    { capability: 'current_weather', price: 5, currency: 'sats' },
    { capability: 'forecast_7day', price: 20, currency: 'sats' },
  ],

  // Accepted payment methods
  paymentMethods: ['bitcoin-lightning-bolt11', 'bitcoin-cashu'],

  // Optional: topic tags for search/filtering
  topics: ['weather', 'data', 'ai'],

  // Optional: describe capabilities in detail (stored in event content)
  capabilities: [
    { name: 'current_weather', description: 'Current conditions for a given location' },
    { name: 'forecast_7day', description: '7-day forecast for a given location' },
  ],

  version: '1.0.0',
})

console.log('Service announced on Nostr!')
console.log('  Event ID:', handle.eventId)
console.log('  Pubkey:  ', handle.pubkey)

// Keep the process alive so relay connections stay open.
// In a real server, you would call handle.close() on shutdown.
process.on('SIGINT', () => {
  console.log('\nClosing relay connections...')
  handle.close()
  process.exit(0)
})

console.log('\nPress Ctrl+C to disconnect from relays and exit.')
