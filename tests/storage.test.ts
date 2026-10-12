import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import Ajv from 'ajv'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import type { EventTemplate } from 'nostr-tools/pure'
import {
  buildStorageAnnouncement, acceptSignedStorageAnnouncement, parseStorageAnnouncement, selectStorageAnnouncements,
  validateStorageDescription, validateStorageEndpointBinding,
} from '../src/storage.js'
import { STORAGE_PROFILE, STORAGE_MAX_EVENT_BYTES } from '../src/storage-types.js'
import { buildAnnounceEvent } from '../src/event.js'

const json = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
const fixture = (name: string) => json(`fixtures/storage-v1/${name}.json`)
const manifest = fixture('manifest')
const schema = json('schemas/storage-service-v1.schema.json')
const ajv = new Ajv({ strict: true, allErrors: true })
const validateSchema = ajv.compile(schema)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
// PUBLIC synthetic test seed, also documented in the fixture generator.
const seed = new Uint8Array(32).fill(1)
const sign = (template: EventTemplate) => finalizeEvent(clone(template), seed)
const paid = fixture('paid')
const free = fixture('free')
const combined = fixture('combined')
const options = { now: paid.now }

describe('cross-language storage profile fixtures', () => {
  for (const filename of manifest.cases as string[]) {
    it(filename, () => {
      const f = fixture(filename.replace(/\.json$/, ''))
      // Rejection vectors carry VALID signatures: they test semantic validation,
      // rather than only catching tampering at the cryptographic boundary.
      expect(verifyEvent(f.signed_event)).toBe(true)
      if (f.expected.reject) {
        expect(() => parseStorageAnnouncement(f.signed_event, { now: f.now })).toThrow()
      } else {
        expect(validateSchema(f.description), JSON.stringify(validateSchema.errors)).toBe(true)
        expect(validateStorageDescription(f.description)).toEqual(f.description)
        expect(buildStorageAnnouncement(f.description)).toEqual(f.unsigned_event)
        const parsed = parseStorageAnnouncement(f.signed_event, { now: f.now })
        expect(parsed.description).toEqual(f.description)
        expect(parsed.freshness).toBe(f.expected.freshness)
        expect(parsed.description.state).toBe(f.expected.state)
        const available = parsed.freshness === 'current' && parsed.description.state === 'published'
          ? parsed.description.services.filter(s => s.availability === 'accepting').map(s => s.id) : []
        expect(available).toEqual(f.expected.available_service_ids)
      }
    })
  }
  for (const c of manifest.selection_cases) {
    it(`keeps ${c.winner} instead of resurrecting paid`, () => {
      const events = c.inputs.map((name: string) => fixture(name).signed_event)
      for (const input of [events, [...events].reverse(), [...events, events[0]]]) {
        const selected = selectStorageAnnouncements(input, options)
        expect(selected).toHaveLength(1)
        expect(selected[0].event.id).toBe(fixture(c.winner).signed_event.id)
        const available = selected[0].freshness === 'current' && selected[0].description.state === 'published'
          ? selected[0].description.services.filter(s => s.availability === 'accepting').map(s => s.id) : []
        expect(available).toEqual(c.available_service_ids)
      }
    })
  }
})

describe('storage service contract', () => {
  it('free mirror shelter has a zero package price and no invented payment rail', () => {
    expect(free.unsigned_event.tags.filter((t: string[]) => t[0] === 'pmi')).toEqual([])
    expect(free.unsigned_event.tags.filter((t: string[]) => t[0] === 'price')).toEqual([['price', 'open-shelter', '0', 'sats']])
    expect(JSON.parse(free.unsigned_event.content).capabilities[0].endpoint).toBe('/mirror')
  })
  it('paid package price and real checkout flow are bound into tags', () => {
    expect(paid.unsigned_event.tags).toContainEqual(['price', 'storage-small', '100', 'sats'])
    expect(paid.unsigned_event.tags).toContainEqual(['pmi', 'wildbloom-checkout', 'lightning', 'bitcoin'])
    expect(paid.unsigned_event.tags).toContainEqual(['pmi', 'wildbloom-checkout', 'lnurlcash', 'bitcoin', 'mint.example'])
  })
  it('the legacy API still rejects an empty payment method list', () => {
    expect(() => buildAnnounceEvent('01'.repeat(32), {
      secretKey: '01'.repeat(32), identifier: 'legacy', name: 'Legacy', about: 'Legacy paid API',
      urls: ['https://legacy.example/'], pricing: [], paymentMethods: [],
    })).toThrow('paymentMethods')
  })
  it('accepts tag reordering and reordered JSON object keys from other implementations', () => {
    const template = clone(paid.unsigned_event)
    template.tags.reverse()
    const c = JSON.parse(template.content)
    c.storage = Object.fromEntries(Object.entries(c.storage).reverse())
    c.capabilities = c.capabilities.map((v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).reverse()))
    template.content = JSON.stringify({ capabilities: c.capabilities, storage: c.storage })
    expect(parseStorageAnnouncement(sign(template), options).description).toEqual(paid.description)
  })
  it('does not trust the signature verification cache on a mutable event', () => {
    const event = sign(paid.unsigned_event)
    expect(verifyEvent(event)).toBe(true)
    event.tags[0][1] = 'attacker'
    expect(() => parseStorageAnnouncement(event, options)).toThrow()
  })
  it('accepts an exact external signature but refuses a valid signed rewrite', () => {
    expect(acceptSignedStorageAnnouncement(paid.signed_event, paid.unsigned_event, options).description).toEqual(paid.description)
    const d = clone(paid.description)
    d.services[0].price_msat = 200_000
    expect(() => acceptSignedStorageAnnouncement(sign(buildStorageAnnouncement(d)), paid.unsigned_event, options)).toThrow()
    expect(() => acceptSignedStorageAnnouncement(paid.signed_event, paid.unsigned_event, { now: paid.description.expires_at })).toThrow()
  })
  it('uses the lower event ID when replacement timestamps tie', () => {
    const d = clone(paid.description)
    d.about = 'A different signed description at the same timestamp.'
    const second = sign(buildStorageAnnouncement(d))
    const original = paid.signed_event
    const expected = [original.id, second.id].sort()[0]
    expect(selectStorageAnnouncements([second, original], options)[0].event.id).toBe(expected)
    expect(selectStorageAnnouncements([original, second], options)[0].event.id).toBe(expected)
  })
  it('applies maximum age even before the publisher expiry', () => {
    const d = clone(paid.description)
    d.expires_at = d.observed_at + 86400
    const parsed = parseStorageAnnouncement(sign(buildStorageAnnouncement(d)), { now: d.observed_at + 7201 })
    expect(parsed.freshness).toBe('stale')
  })
  it('expires exactly at the expiration timestamp', () => {
    expect(parseStorageAnnouncement(paid.signed_event, { now: paid.description.expires_at }).freshness).toBe('expired')
  })
  it('retains an expired watermark across a later lookup containing an older record', () => {
    const first = selectStorageAnnouncements([fixture('expired').signed_event], options)
    const second = selectStorageAnnouncements([...first.map(p => p.event), paid.signed_event], options)
    expect(second[0].freshness).toBe('expired')
  })
  it('ignores invalid later records without suppressing a valid listing', () => {
    expect(selectStorageAnnouncements([paid.signed_event, fixture('reject-future-event').signed_event], options)[0].event.id).toBe(paid.signed_event.id)
  })
  it('does not conflate different service identities or listing IDs', () => {
    const d = clone(paid.description)
    d.identifier = 'second-listing'
    expect(selectStorageAnnouncements([paid.signed_event, sign(buildStorageAnnouncement(d))], options)).toHaveLength(2)
  })
  it('builds and reads metadata without network or signer access', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'))
    try {
      buildStorageAnnouncement(combined.description)
      parseStorageAnnouncement(combined.signed_event, options)
      expect(fetch).not.toHaveBeenCalled()
    } finally { fetch.mockRestore() }
  })
  it('copies the description so caller mutation cannot alter the returned value', () => {
    const d = clone(paid.description)
    const valid = validateStorageDescription(d)
    d.services[0].price_msat = 200_000
    expect(valid.services[0]).toHaveProperty('price_msat', 100_000)
  })
  it('rejects oversized signed event JSON before signature verification', () => {
    expect(() => parseStorageAnnouncement({ ...paid.signed_event, content: 'a'.repeat(STORAGE_MAX_EVENT_BYTES) }, options)).toThrow()
  })
  it('rejects excessive lookup results and invalid clock options', () => {
    expect(() => selectStorageAnnouncements(Array(513).fill(paid.signed_event), options)).toThrow()
    expect(() => selectStorageAnnouncements([], { now: NaN })).toThrow()
    expect(() => parseStorageAnnouncement(paid.signed_event, { ...options, clockSkewSeconds: 301 })).toThrow()
  })

  const invalidDescriptions: [string, (d: typeof paid.description) => void][] = [
    ['unknown version', d => { d.profile = 'forgesworn-storage-service-v2' }],
    ['private endpoint', d => { d.origins = ['https://127.0.0.1/'] }],
    ['credentials', d => { d.origins = ['https://user:password@storage.example/'] }],
    ['insecure clearnet', d => { d.origins = ['http://storage.example/'] }],
    ['noncanonical origin', d => { d.origins = ['https://storage.example'] }],
    ['duplicate origins', d => { d.origins.push(d.origins[0]) }],
    ['empty services', d => { d.services = [] }],
    ['duplicate services', d => { d.services.push(d.services[0]) }],
    ['missing checkout', d => { d.checkout = null }],
    ['unbound checkout', d => { d.checkout.origin = 'https://other.example/' }],
    ['fractional price', d => { d.services[0].price_msat = 100_001 }],
    ['zero price for paid storage', d => { d.services[0].price_msat = 0 }],
    ['unsafe integer', d => { d.services[0].capacity_bytes = 2 ** 53 }],
    ['control characters', d => { d.name = 'bad\u0000name' }],
    ['blank policy', d => { d.services[0].refund_policy = ' ' }],
    ['unbounded lifetime', d => { d.expires_at = d.observed_at + 86401 }],
    ['already expired snapshot', d => { d.expires_at = d.observed_at }],
    ['withdrawn and accepting', d => { d.state = 'withdrawn' }],
    ['duplicate rails', d => { d.checkout.rails = ['lightning', 'lightning'] }],
    ['unsupported L402 rail', d => { d.checkout.rails = ['l402'] }],
    ['LNURLcash on regtest', d => { d.checkout.network = 'regtest' }],
    ['LNURLcash without issuers', d => { d.checkout.issuers = [] }],
    ['duplicate issuers', d => { d.checkout.issuers.push(d.checkout.issuers[0]) }],
    ['cross-origin callback', d => { d.checkout.issuers[0].callback = 'https://attacker.example/callback' }],
    ['bearer URL query', d => { d.checkout.issuers[0].note_endpoint = 'https://mint.example/cash?secret=bearer' }],
    ['private metadata', d => { d.buyer_pubkey = '11'.repeat(32) }],
  ]
  for (const [name, mutate] of invalidDescriptions) {
    it(`rejects ${name}`, () => {
      const d = clone(paid.description)
      mutate(d)
      expect(() => validateStorageDescription(d)).toThrow('Invalid storage service profile')
    })
  }
  it('rejects free-only checkout and repeated shelter services', () => {
    const d = clone(free.description)
    d.checkout = paid.description.checkout
    expect(() => validateStorageDescription(d)).toThrow()
    d.checkout = null
    d.services.push({ ...d.services[0], id: 'second-shelter' })
    expect(() => validateStorageDescription(d)).toThrow()
  })
  it('accepts public IPv6 while refusing multicast endpoints', () => {
    const d = clone(free.description)
    d.origins = ['https://[2606:4700:4700::1111]/']
    expect(validateStorageDescription(d).origins).toEqual(d.origins)
    for (const origin of ['https://224.0.0.1/', 'https://[ff02::1]/']) {
      d.origins = [origin]
      expect(() => validateStorageDescription(d)).toThrow()
    }
  })
  it('refuses to sign a snapshot more than five minutes old or beyond its expiry', () => {
    expect(() => buildStorageAnnouncement(paid.description, paid.description.observed_at + 301)).toThrow()
    expect(() => buildStorageAnnouncement(paid.description, paid.description.observed_at - 1)).toThrow()
    const d = clone(paid.description)
    d.expires_at = d.observed_at + 60
    expect(() => buildStorageAnnouncement(d, d.expires_at)).toThrow()
  })
  it('bounds the full signed envelope, including duplicated terms and JSON escaping', () => {
    const d = clone(paid.description)
    d.services = Array.from({ length: 32 }, (_, i) => ({ ...d.services[0], id: `plan-${i}`, retention_policy: 'x'.repeat(2048) }))
    expect(() => buildStorageAnnouncement(d)).toThrow()
  })
})

describe('endpoint identity binding', () => {
  const announcement = parseStorageAnnouncement(paid.signed_event, options)
  it('accepts current prices but leaves quote review to the caller', () => {
    const d = clone(paid.description)
    d.services[0].price_msat = 200_000
    d.services[0].revision = 2
    expect(validateStorageEndpointBinding(d, announcement, d.origins[0], options).services[0]).toHaveProperty('price_msat', 200_000)
  })
  for (const field of ['service_pubkey', 'identifier']) {
    it(`rejects mismatched ${field}`, () => {
      const d = clone(paid.description)
      d[field] = field === 'identifier' ? 'other-listing' : '22'.repeat(32)
      expect(() => validateStorageEndpointBinding(d, announcement, d.origins[0], options)).toThrow()
    })
  }
  it('refuses an endpoint that was not advertised', () => {
    expect(() => validateStorageEndpointBinding(paid.description, announcement, 'https://attacker.example/', options)).toThrow()
  })
  it('refuses expired or future HTTP snapshots despite matching identity', () => {
    expect(() => validateStorageEndpointBinding(paid.description, announcement, paid.description.origins[0], { now: paid.description.expires_at })).toThrow()
    expect(() => validateStorageEndpointBinding(paid.description, announcement, paid.description.origins[0], { now: paid.description.observed_at - 31 })).toThrow()
  })
  it('uses the explicit paid HTTPS origin in a mixed HTTPS/onion listing', () => {
    const d = clone(combined.description)
    d.origins.push(fixture('free-onion').description.origins[0])
    const event = buildStorageAnnouncement(d)
    expect(parseStorageAnnouncement(sign(event), options).description.checkout?.origin).toBe('https://storage.example/')
    expect(d.profile).toBe(STORAGE_PROFILE)
  })
})
