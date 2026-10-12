import { sha3_256 } from '@noble/hashes/sha3.js'
import { validateEvent, verifyEvent } from 'nostr-tools/pure'
import type { Event, EventTemplate } from 'nostr-tools/pure'
import { isPrivateHost } from './utils.js'
import { L402_ANNOUNCE_KIND } from './types.js'
import {
  STORAGE_DEFAULT_MAX_AGE_SECONDS, STORAGE_MAX_EVENT_BYTES,
  STORAGE_MAX_TTL_SECONDS, STORAGE_PROFILE,
} from './storage-types.js'
import type {
  FreeMirrorService, PaidStorageService, StorageAnnouncementContent,
  StorageAvailability, StorageCheckout, StorageIssuer, StorageReadOptions,
  StorageServiceDescription,
} from './storage-types.js'

const encoder = new TextEncoder()
const ID = /^[A-Za-z0-9_-]{1,128}$/
const HEX64 = /^[0-9a-f]{64}$/
const CONTROLS = /[\x00-\x1f\x7f]/
const STATES = ['accepting', 'full', 'paused', 'unknown'] as const

function invalid(): never { throw new Error('Invalid storage service profile.') }
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).length !== keys.length || keys.some(k => !Object.hasOwn(result, k))) invalid()
  return result
}
function text(value: unknown, max: number, multiline = false): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid()
  if (CONTROLS.test(multiline ? value.replace(/[\n\t]/g, '') : value)) invalid()
  return value
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) invalid()
  return value
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !ID.test(value)) invalid()
  return value
}
function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) invalid()
  return value as T
}
function list(value: unknown, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid()
  return value
}
function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) invalid()
}

function onion(host: string): boolean {
  const match = /^([a-z2-7]{56})\.onion$/.exec(host)
  if (!match) return false
  const bytes = new Uint8Array(35)
  let bits = 0, accumulator = 0, offset = 0
  for (const character of match[1]) {
    accumulator = (accumulator << 5) | 'abcdefghijklmnopqrstuvwxyz234567'.indexOf(character)
    bits += 5
    if (bits >= 8) { bits -= 8; bytes[offset++] = (accumulator >>> bits) & 255 }
  }
  if (bytes[34] !== 3) return false
  const input = new Uint8Array(48)
  input.set(encoder.encode('.onion checksum'))
  input.set(bytes.subarray(0, 32), 15)
  input[47] = 3
  const hash = sha3_256(input)
  return bytes[32] === hash[0] && bytes[33] === hash[1]
}

/** Validate a public endpoint without resolving DNS or making a network request. */
function endpoint(value: unknown, originOnly: boolean, httpsOnly = false): string {
  const raw = text(value, 2048)
  let url: URL
  try { url = new URL(raw) } catch { return invalid() }
  if (url.href !== raw || url.username || url.password || url.search || url.hash) invalid()
  if (originOnly && url.pathname !== '/') invalid()
  const host = url.hostname
  if (host.replace(/\.+$/g, '').endsWith('.onion')) {
    if (httpsOnly || !onion(host) || !['https:', 'http:'].includes(url.protocol)) invalid()
  } else if (url.protocol !== 'https:' || isPrivateHost(host) ||
      (!host.includes('.') && !host.includes(':')) || host.endsWith('.') ||
      /^\[ff[0-9a-f]{2}:/i.test(host) || (/^\d+\.\d+\.\d+\.\d+$/.test(host) && Number(host.split('.')[0]) >= 224)) {
    invalid()
  }
  return raw
}

function issuer(value: unknown): StorageIssuer {
  const v = object(value, ['id', 'note_endpoint', 'callback', 'mint_pubkey'])
  const note = endpoint(v.note_endpoint, false, true)
  const callback = endpoint(v.callback, false, true)
  if (new URL(note).origin !== new URL(callback).origin ||
      typeof v.mint_pubkey !== 'string' || !/^(02|03)[0-9a-f]{64}$/.test(v.mint_pubkey)) invalid()
  return { id: identifier(v.id), note_endpoint: note, callback, mint_pubkey: v.mint_pubkey }
}

function checkout(value: unknown): StorageCheckout | null {
  if (value === null) return null
  const v = object(value, ['protocol', 'origin', 'network', 'rails', 'issuers'])
  if (v.protocol !== 'wildbloom-checkout-v1') invalid()
  const network = oneOf(v.network, ['bitcoin', 'testnet', 'regtest'])
  const rails = list(v.rails, 2, 1).map(r => oneOf(r, ['lightning', 'lnurlcash'] as const))
  unique(rails)
  const issuers = list(v.issuers, 32).map(issuer)
  unique(issuers.map(i => i.id))
  if (rails.includes('lnurlcash') ? network !== 'bitcoin' || !issuers.length : issuers.length !== 0) invalid()
  return { protocol: v.protocol, origin: endpoint(v.origin, true, true), network, rails, issuers }
}

function service(value: unknown): FreeMirrorService | PaidStorageService {
  if (value === null || typeof value !== 'object') invalid()
  const type = (value as Record<string, unknown>).type
  const common = ['id', 'type', 'revision', 'availability']
  const fields = type === 'free-mirror'
    ? ['operation', 'authorisation', 'retention', 'eviction_policy']
    : ['capacity_bytes', 'duration_seconds', 'grace_seconds', 'price_msat',
      'delivery_bytes', 'delivery_policy', 'retention_policy', 'refund_policy']
  const v = object(value, [...common, ...fields])
  const base = {
    id: identifier(v.id), revision: integer(v.revision, 1),
    availability: oneOf<StorageAvailability>(v.availability, STATES),
  }
  if (type === 'free-mirror') {
    if (v.operation !== 'mirror' || v.authorisation !== 'bud-11' || v.retention !== 'best-effort') invalid()
    return { ...base, type, operation: v.operation, authorisation: v.authorisation,
      retention: v.retention, eviction_policy: text(v.eviction_policy, 2048, true) }
  }
  if (type !== 'paid-storage') invalid()
  const price = integer(v.price_msat, 1)
  if (price % 1000 !== 0) invalid()
  return { ...base, type,
    capacity_bytes: integer(v.capacity_bytes, 1), duration_seconds: integer(v.duration_seconds, 1),
    grace_seconds: integer(v.grace_seconds), price_msat: price,
    delivery_bytes: integer(v.delivery_bytes, 1), delivery_policy: text(v.delivery_policy, 2048, true),
    retention_policy: text(v.retention_policy, 2048, true), refund_policy: text(v.refund_policy, 2048, true),
  }
}

/** Validate/copy a public HTTP snapshot. Does not reserve storage or contact its operator. */
export function validateStorageDescription(value: unknown): StorageServiceDescription {
  const v = object(value, ['profile', 'service_pubkey', 'identifier', 'name', 'about', 'origins',
    'max_blob_bytes', 'observed_at', 'expires_at', 'state', 'checkout', 'services'])
  if (v.profile !== STORAGE_PROFILE || typeof v.service_pubkey !== 'string' || !HEX64.test(v.service_pubkey)) invalid()
  const origins = list(v.origins, 10, 1).map(o => endpoint(o, true))
  unique(origins)
  const services = list(v.services, 32, 1).map(service)
  unique(services.map(s => s.id))
  if (services.filter(s => s.type === 'free-mirror').length > 1) invalid()
  const payment = checkout(v.checkout)
  if (services.some(s => s.type === 'paid-storage') !== (payment !== null)) invalid()
  if (payment && !origins.includes(payment.origin)) invalid()
  const observed = integer(v.observed_at)
  const expires = integer(v.expires_at)
  if (expires <= observed || expires - observed > STORAGE_MAX_TTL_SECONDS) invalid()
  const state = oneOf(v.state, ['published', 'withdrawn'])
  if (state === 'withdrawn' && services.some(s => s.availability !== 'paused')) invalid()
  const result: StorageServiceDescription = {
    profile: STORAGE_PROFILE, service_pubkey: v.service_pubkey,
    identifier: identifier(v.identifier), name: text(v.name, 256), about: text(v.about, 4096),
    origins, max_blob_bytes: integer(v.max_blob_bytes, 1), observed_at: observed, expires_at: expires,
    state, checkout: payment, services,
  }
  if (encoder.encode(JSON.stringify(result)).length > 60_000) invalid()
  return result
}

function content(description: StorageServiceDescription): StorageAnnouncementContent {
  return { storage: description, capabilities: description.services.map(s => s.type === 'free-mirror'
    ? { name: s.id, description: `Signed mirrors only; best-effort, evictable shelter. ${s.eviction_policy}`, endpoint: '/mirror' }
    : { name: s.id, description: `${s.capacity_bytes} ciphertext bytes for ${s.duration_seconds} seconds; ` +
      `${s.grace_seconds} seconds grace; ${s.delivery_bytes} delivery bytes. ${s.retention_policy}`,
    endpoint: '/checkout/v1/offers' }) }
}

/** Build an unsigned kind 31402 storage event for an external signer. No key or network access. */
export function buildStorageAnnouncement(value: unknown, createdAt?: number): EventTemplate {
  const d = validateStorageDescription(value)
  const created = integer(createdAt ?? d.observed_at)
  if (created < d.observed_at || created - d.observed_at > 300 || created >= d.expires_at) invalid()
  const tags: string[][] = [
    ['d', d.identifier], ['name', d.name], ...d.origins.map(o => ['url', o]), ['about', d.about],
    ['source', 'self'], ['status', d.state === 'withdrawn' ? 'stale' : 'active'],
    ['expiration', String(d.expires_at)], ['t', 'storage'], ['t', 'wildbloom'], ['t', STORAGE_PROFILE],
  ]
  if (d.checkout) {
    for (const rail of d.checkout.rails) {
      tags.push(['pmi', 'wildbloom-checkout', rail, d.checkout.network,
        ...(rail === 'lnurlcash' ? [...new Set(d.checkout.issuers.map(i => new URL(i.note_endpoint).hostname))] : [])])
    }
  }
  for (const s of d.services) tags.push(['price', s.id, String(s.type === 'free-mirror' ? 0 : s.price_msat / 1000), 'sats'])
  const result = { kind: L402_ANNOUNCE_KIND, created_at: created, tags, content: JSON.stringify(content(d)) }
  // Leave room for signed envelope fields and escaping in the full event JSON.
  if (encoder.encode(JSON.stringify({ ...result, pubkey: d.service_pubkey,
    id: '0'.repeat(64), sig: '0'.repeat(128) })).length > STORAGE_MAX_EVENT_BYTES) invalid()
  return result
}

export interface ParsedStorageAnnouncement {
  event: Event
  description: StorageServiceDescription
  /** Timestamp expiry and local maximum age are independent of relay retention. */
  freshness: 'current' | 'expired' | 'stale'
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(k => `${JSON.stringify(k)}:${canonical(object[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function timeOptions(options: StorageReadOptions): { now: number; maxAge: number; skew: number } {
  const now = integer(options.now)
  const maxAge = integer(options.maxAgeSeconds ?? STORAGE_DEFAULT_MAX_AGE_SECONDS, 1)
  const skew = integer(options.clockSkewSeconds ?? 30)
  if (maxAge > STORAGE_MAX_TTL_SECONDS || skew > 300) invalid()
  return { now, maxAge, skew }
}

/** Verify signed storage metadata, including expired records needed to prevent resurrection. */
export function parseStorageAnnouncement(value: unknown, options: StorageReadOptions): ParsedStorageAnnouncement {
  const { now, maxAge, skew } = timeOptions(options)
  const encoded = JSON.stringify(value)
  if (!encoded || encoder.encode(encoded).length > STORAGE_MAX_EVENT_BYTES) invalid()
  // Copy through JSON to remove nostr-tools' signature-verification cache symbols.
  const event: Event = JSON.parse(encoded)
  if (!validateEvent(event) || event.kind !== L402_ANNOUNCE_KIND || !HEX64.test(event.pubkey) ||
      !/^[0-9a-f]{64}$/.test(event.id) || !/^[0-9a-f]{128}$/.test(event.sig) ||
      !Number.isSafeInteger(event.created_at) || event.created_at < 0 || event.created_at > now + skew ||
      event.tags.length > 128 || event.tags.some(t => t.length > 36 || t.some(x => x.length > 4096)) ||
      !verifyEvent(event)) invalid()
  let raw: unknown
  try { raw = JSON.parse(event.content) } catch { return invalid() }
  const c = object(raw, ['storage', 'capabilities'])
  const d = validateStorageDescription(c.storage)
  if (d.service_pubkey !== event.pubkey) invalid()
  const expected = buildStorageAnnouncement(d, event.created_at)
  // Tags may be reordered by another implementation. Duplicates/extra tags are refused.
  const sorted = (tags: string[][]): string[] => tags.map(t => JSON.stringify(t)).sort()
  if (JSON.stringify(sorted(event.tags)) !== JSON.stringify(sorted(expected.tags))) invalid()
  const capabilities = list(c.capabilities, 32, 1)
  const validated = capabilities.map(cap => {
    const v = object(cap, ['name', 'description', 'endpoint'])
    return { name: identifier(v.name), description: text(v.description, 4096, true), endpoint: text(v.endpoint, 64) }
  })
  if (canonical(validated) !== canonical(content(d).capabilities)) invalid()
  return { event, description: d,
    freshness: d.expires_at <= now ? 'expired' : event.created_at < now - maxAge ? 'stale' : 'current' }
}

/** Accept an external signature only if it preserves the exact requested unsigned event. */
export function acceptSignedStorageAnnouncement(value: unknown, requested: EventTemplate, options: StorageReadOptions): ParsedStorageAnnouncement {
  const parsed = parseStorageAnnouncement(value, options)
  const e = parsed.event
  if (parsed.freshness !== 'current' || e.kind !== requested.kind || e.created_at !== requested.created_at ||
      e.content !== requested.content || JSON.stringify(e.tags) !== JSON.stringify(requested.tags)) invalid()
  return parsed
}

/**
 * Select newest VALID records before applying expiry/availability. Retain returned
 * expired/withdrawn records as watermarks between lookups; never fall back to an older offer.
 * Invalid records are ignored. No endpoint is contacted or selected automatically.
 */
export function selectStorageAnnouncements(values: readonly unknown[], options: StorageReadOptions): ParsedStorageAnnouncement[] {
  timeOptions(options)
  if (values.length > 512) invalid()
  const latest = new Map<string, ParsedStorageAnnouncement>()
  for (const value of values) {
    let parsed: ParsedStorageAnnouncement
    try { parsed = parseStorageAnnouncement(value, options) } catch { continue }
    const e = parsed.event
    const key = `${e.pubkey}:${parsed.description.identifier}`
    const previous = latest.get(key)?.event
    if (!previous || e.created_at > previous.created_at || (e.created_at === previous.created_at && e.id < previous.id)) latest.set(key, parsed)
  }
  return [...latest.values()].sort((a, b) => `${a.event.pubkey}:${a.description.identifier}`.localeCompare(`${b.event.pubkey}:${b.description.identifier}`))
}

/** Match a fresh fetched HTTP snapshot to the signed service identity and listing. No request is made. */
export function validateStorageEndpointBinding(value: unknown, announcement: ParsedStorageAnnouncement, selectedOrigin: string, options: StorageReadOptions): StorageServiceDescription {
  const { now, maxAge, skew } = timeOptions(options)
  const d = validateStorageDescription(value)
  const signed = announcement.description
  if (!signed.origins.includes(selectedOrigin) || !d.origins.includes(selectedOrigin) ||
      d.service_pubkey !== signed.service_pubkey || d.identifier !== signed.identifier ||
      d.observed_at > now + skew || d.expires_at <= now || d.observed_at < now - maxAge) invalid()
  // Current HTTP prices/terms can differ: the caller must review them and obtain a new quote.
  return d
}
