// Synthetic, offline fixtures. The test-only signing seed is public and must
// never be used for an operator, wallet, relay publication or real authorisation.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { getPublicKey, getEventHash, finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { sha3_256 } from '@noble/hashes/sha3.js'
import { buildStorageAnnouncement, STORAGE_PROFILE } from '../build/index.js'

const check = process.argv.includes('--check')
const seed = new Uint8Array(32).fill(1)
const pubkey = getPublicKey(seed)
const observed = 1_800_000_000
const now = observed + 300
const clone = value => JSON.parse(JSON.stringify(value))
const safe = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }
const positive = { ...safe, minimum: 1 }
const id = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' }
const hex = { type: 'string', pattern: '^[0-9a-f]{64}$' }
const text = (max, multiline = false) => ({ type: 'string', minLength: 1, maxLength: max,
  pattern: multiline ? '^[^\\u0000-\\u0008\\u000b-\\u001f\\u007f]*$' : '^[^\\u0000-\\u001f\\u007f]*$' })
const obj = properties => ({ type: 'object', additionalProperties: false,
  required: Object.keys(properties), properties })
const uri = { type: 'string', minLength: 1, maxLength: 2048, pattern: '^https://[^/?#@\\s]+/[^?#\\s]*$' }
const origin = { ...uri, pattern: '^(https://[^/?#@\\s]+/|http://[a-z2-7]{56}\\.onion(:[0-9]+)?/)$' }
const availability = { enum: ['accepting', 'full', 'paused', 'unknown'] }
const common = { id, revision: positive, availability }
const free = obj({ ...common, type: { const: 'free-mirror' }, operation: { const: 'mirror' },
  authorisation: { const: 'bud-11' }, retention: { const: 'best-effort' }, eviction_policy: text(2048, true) })
const paid = obj({ ...common, type: { const: 'paid-storage' }, capacity_bytes: positive,
  duration_seconds: positive, grace_seconds: safe, price_msat: { ...positive, multipleOf: 1000 },
  delivery_bytes: positive, delivery_policy: text(2048, true), retention_policy: text(2048, true), refund_policy: text(2048, true) })
const issuer = obj({ id, note_endpoint: uri, callback: uri, mint_pubkey: { type: 'string', pattern: '^(02|03)[0-9a-f]{64}$' } })
const checkout = obj({ protocol: { const: 'wildbloom-checkout-v1' }, origin: { ...uri, pattern: '^https://[^/?#@\\s]+/$' },
  network: { enum: ['bitcoin', 'testnet', 'regtest'] },
  rails: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { enum: ['lightning', 'lnurlcash'] } },
  issuers: { type: 'array', maxItems: 32, items: { $ref: '#/$defs/issuer' } } })
const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://github.com/forgesworn/402-announce/blob/main/schemas/storage-service-v1.schema.json',
  title: 'ForgeSworn public storage service description v1',
  description: 'Experimental kind 31402 storage extension. Structural validation must be followed by the semantic rules and signature checks in docs/storage-service-v1.md.',
  ...obj({ profile: { const: STORAGE_PROFILE }, service_pubkey: hex, identifier: id,
    name: text(256), about: text(4096), origins: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: origin },
    max_blob_bytes: positive, observed_at: safe, expires_at: safe, state: { enum: ['published', 'withdrawn'] },
    checkout: { anyOf: [{ type: 'null' }, { $ref: '#/$defs/checkout' }] },
    services: { type: 'array', minItems: 1, maxItems: 32, items: { oneOf: [{ $ref: '#/$defs/free' }, { $ref: '#/$defs/paid' }] } },
  }),
  $defs: { free, paid, issuer, checkout },
}

const base = {
  profile: STORAGE_PROFILE, service_pubkey: pubkey, identifier: 'synthetic-storage',
  name: 'Synthetic Wildbloom node', about: 'Offline interoperability fixture; never a real storage offer.',
  origins: ['https://storage.example/'], max_blob_bytes: 1_073_741_824,
  observed_at: observed, expires_at: observed + 7200, state: 'published', checkout: null, services: [],
}
const shelter = { id: 'open-shelter', type: 'free-mirror', revision: 1, availability: 'accepting',
  operation: 'mirror', authorisation: 'bud-11', retention: 'best-effort',
  eviction_policy: 'Guest mirrors can be evicted under storage pressure; direct unknown uploads are refused.' }
const packageOffer = { id: 'storage-small', type: 'paid-storage', revision: 1, availability: 'accepting',
  capacity_bytes: 10_737_418_240, duration_seconds: 2_592_000, grace_seconds: 604_800,
  price_msat: 100_000, delivery_bytes: 21_474_836_480,
  delivery_policy: 'Package includes the stated delivery allowance; consult a fresh quote before buying.',
  retention_policy: 'Retained until the purchased term and grace end; this is not a replication guarantee.',
  refund_policy: 'Settled payments that cannot activate storage require operator refund or agreed fulfilment.' }
const payment = { protocol: 'wildbloom-checkout-v1', origin: base.origins[0], network: 'bitcoin',
  rails: ['lightning', 'lnurlcash'], issuers: [{ id: 'synthetic-mint', note_endpoint: 'https://mint.example/cash',
    callback: 'https://mint.example/cash/callback', mint_pubkey: `02${'11'.repeat(32)}` }] }

// A checksum-valid v3 onion derived from a PUBLIC synthetic service key.
const onionKey = new Uint8Array(32).fill(2)
const checksumInput = new Uint8Array(48)
checksumInput.set(new TextEncoder().encode('.onion checksum'))
checksumInput.set(onionKey, 15)
checksumInput[47] = 3
const onionBytes = new Uint8Array(35)
onionBytes.set(onionKey)
onionBytes.set(sha3_256(checksumInput).subarray(0, 2), 32)
onionBytes[34] = 3
let bits = 0, accumulator = 0, label = ''
for (const byte of onionBytes) {
  accumulator = (accumulator << 8) | byte
  bits += 8
  while (bits >= 5) { bits -= 5; label += 'abcdefghijklmnopqrstuvwxyz234567'[(accumulator >>> bits) & 31] }
}

const descriptions = {
  paid: { ...base, checkout: payment, services: [packageOffer] },
  free: { ...base, services: [shelter] },
  combined: { ...base, checkout: payment, services: [shelter, packageOffer] },
  'free-onion': { ...base, origins: [`http://${label}.onion/`], services: [shelter] },
  full: { ...base, observed_at: observed + 60, expires_at: observed + 7260, checkout: payment,
    services: [{ ...packageOffer, availability: 'full' }] },
  withdrawn: { ...base, observed_at: observed + 120, expires_at: observed + 7320, state: 'withdrawn', checkout: payment,
    services: [{ ...packageOffer, availability: 'paused' }] },
  expired: { ...base, observed_at: observed + 180, expires_at: observed + 240, checkout: payment, services: [packageOffer] },
}

function output(path, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`
  if (check) {
    if (readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') !== bytes) throw new Error(`Contract drift: ${path}`)
  } else {
    writeFileSync(new URL(`../${path}`, import.meta.url), bytes)
  }
}

function signed(template, filename, field = 'signed_event') {
  // Schnorr signatures use random auxiliary data. Preserve any existing valid
  // signature of the exact event so regeneration is byte-reproducible.
  let old
  try { old = JSON.parse(readFileSync(new URL(`../fixtures/storage-v1/${filename}.json`, import.meta.url), 'utf8'))[field] } catch { /* First generation. */ }
  const expectedId = getEventHash({ ...template, pubkey })
  if (old?.id === expectedId && old.pubkey === pubkey && verifyEvent(old) &&
      JSON.stringify(old.tags) === JSON.stringify(template.tags) && old.content === template.content && old.created_at === template.created_at) return old
  return finalizeEvent(clone(template), seed)
}

if (!check) {
  mkdirSync(new URL('../schemas/', import.meta.url), { recursive: true })
  mkdirSync(new URL('../fixtures/storage-v1/', import.meta.url), { recursive: true })
}
output('schemas/storage-service-v1.schema.json', schema)
for (const [name, description] of Object.entries(descriptions)) {
  const unsigned = buildStorageAnnouncement(description)
  output(`fixtures/storage-v1/${name}.json`, { fixture: name, now, description, unsigned_event: unsigned,
    signed_event: signed(unsigned, name), expected: { freshness: name === 'expired' ? 'expired' : 'current',
      state: description.state, available_service_ids: name === 'expired' ? [] : description.services.filter(s => s.availability === 'accepting').map(s => s.id) } })
}

const valid = buildStorageAnnouncement(descriptions.combined)
const mutations = [
  ['mismatched-author', t => { const c = JSON.parse(t.content); c.storage.service_pubkey = '33'.repeat(32); t.content = JSON.stringify(c) }],
  ['misleading-price', t => { t.tags.find(tag => tag[0] === 'price' && tag[1] === 'storage-small')[2] = '1' }],
  ['duplicate-identifier', t => { t.tags.push(['d', 'different-service']) }],
  ['missing-expiration', t => { t.tags = t.tags.filter(tag => tag[0] !== 'expiration') }],
  ['fake-l402', t => { t.tags.find(tag => tag[0] === 'pmi')[1] = 'l402' }],
  ['future-event', t => { t.created_at = now + 60 }],
  ['secret-field', t => { const c = JSON.parse(t.content); c.storage.recovery_key = 'must-never-be-public'; t.content = JSON.stringify(c) }],
  ['free-direct-upload', t => { const c = JSON.parse(t.content); c.storage.services[0].operation = 'upload'; t.content = JSON.stringify(c) }],
  ['checkout-onion', t => { const c = JSON.parse(t.content); c.storage.checkout.origin = `http://${label}.onion/`; t.content = JSON.stringify(c) }],
  ['unbound-checkout-origin', t => { const c = JSON.parse(t.content); c.storage.checkout.origin = 'https://different.example/'; t.content = JSON.stringify(c) }],
  ['unsafe-integer', t => { const c = JSON.parse(t.content); c.storage.services[1].capacity_bytes = 9_007_199_254_740_992; t.content = JSON.stringify(c) }],
  ['incorrect-onion-checksum', t => { const c = JSON.parse(t.content); c.storage.origins = [`http://${'a'.repeat(56)}.onion/`]; t.content = JSON.stringify(c) }],
]
for (const [name, mutate] of mutations) {
  const template = clone(valid)
  mutate(template)
  output(`fixtures/storage-v1/reject-${name}.json`, { fixture: name, now, signed_event: signed(template, `reject-${name}`), expected: { reject: true } })
}
output('fixtures/storage-v1/manifest.json', { profile: STORAGE_PROFILE,
  synthetic_only: true, cases: [...Object.keys(descriptions), ...mutations.map(([name]) => `reject-${name}`)].map(name => `${name}.json`),
  selection_cases: [
    { inputs: ['paid', 'full'], winner: 'full', available_service_ids: [] },
    { inputs: ['paid', 'withdrawn'], winner: 'withdrawn', available_service_ids: [] },
    { inputs: ['paid', 'expired'], winner: 'expired', available_service_ids: [] },
  ] })
seed.fill(0)
console.log(check ? 'Storage schema and signed fixtures match.' : 'Generated storage schema and signed fixtures.')
