import { finalizeEvent } from 'nostr-tools/pure'
import { L402_ANNOUNCE_KIND } from './types.js'
import { hexToBytes, hasControlChars, jsonDepth } from './utils.js'
import type { AnnounceConfig } from './types.js'
import type { VerifiedEvent } from 'nostr-tools/pure'

/**
 * Build and sign a kind 31402 Nostr event announcing an L402 service.
 *
 * The caller's secret key buffer is zeroed after signing. Library-internal
 * copies made by @noble/curves are subject to GC timing.
 *
 * @param secretKeyHex - 64-character hex-encoded Nostr secret key
 * @param config - Service announcement configuration
 * @returns Signed Nostr event ready for relay publication
 */
export function buildAnnounceEvent(
  secretKeyHex: string,
  config: Omit<AnnounceConfig, 'relays'>,
): VerifiedEvent {
  // Runtime type guards for JavaScript consumers
  if (typeof secretKeyHex !== 'string') {
    throw new Error('secretKey must be a 64-character hex string')
  }
  if (typeof config !== 'object' || config === null) {
    throw new Error('config must be an object')
  }
  if (typeof config.identifier !== 'string') {
    throw new Error('config.identifier must be a string')
  }
  if (typeof config.name !== 'string') {
    throw new Error('config.name must be a string')
  }
  if (!Array.isArray(config.urls)) {
    throw new Error('config.urls must be an array of strings')
  }
  if (typeof config.about !== 'string') {
    throw new Error('config.about must be a string')
  }
  if (!Array.isArray(config.pricing)) {
    throw new Error('config.pricing must be an array')
  }
  if (!Array.isArray(config.paymentMethods)) {
    throw new Error('config.paymentMethods must be an array')
  }

  if (!/^[0-9a-f]{64}$/i.test(secretKeyHex)) {
    throw new Error('secretKey must be a 64-character hex string')
  }

  // M1: Validate urls array (scheme-agnostic — this function serialises URLs
  // into event tags without performing network I/O, so private hosts are allowed)
  if (config.urls.length === 0) {
    throw new Error('config.urls must contain at least one entry')
  }
  if (config.urls.length > 10) {
    throw new Error('config.urls must not exceed 10 entries')
  }
  const DENIED_URL_SCHEMES = new Set(['data:', 'file:', 'javascript:', 'blob:', 'vbscript:'])
  const seenUrls = new Set<string>()
  for (const u of config.urls) {
    if (u.length > 2048) {
      throw new Error('config.urls entry must not exceed 2048 characters')
    }
    let parsed: URL
    try {
      parsed = new URL(u)
    } catch {
      throw new Error(`config.urls entry is not a valid URL: ${u.slice(0, 200)}`)
    }
    if (DENIED_URL_SCHEMES.has(parsed.protocol)) {
      throw new Error(`config.urls entry uses a disallowed scheme: ${parsed.protocol}`)
    }
    if (hasControlChars(u)) {
      throw new Error('config.urls entry must not contain control characters')
    }
    if (seenUrls.has(u)) {
      throw new Error('config.urls must not contain duplicate entries')
    }
    seenUrls.add(u)
  }

  // M1: Validate picture field when present
  if (config.picture !== undefined) {
    const picLower = config.picture.toLowerCase()
    if (!picLower.startsWith('http://') && !picLower.startsWith('https://')) {
      throw new Error('config.picture must start with http:// or https://')
    }
    if (config.picture.length > 2048) {
      throw new Error('config.picture must not exceed 2048 characters')
    }
    if (hasControlChars(config.picture)) {
      throw new Error('config.picture must not contain control characters')
    }
  }

  // M2: Validate identifier is non-empty and within length limit
  if (config.identifier.trim().length === 0) {
    throw new Error('config.identifier must not be empty or whitespace-only')
  }
  if (config.identifier.length > 256) {
    throw new Error('config.identifier must not exceed 256 characters')
  }
  if (hasControlChars(config.identifier)) {
    throw new Error('config.identifier must not contain control characters')
  }

  // Tag field length limits
  if (config.name.trim().length === 0) {
    throw new Error('config.name must not be empty or whitespace-only')
  }
  if (config.name.length > 256) {
    throw new Error('config.name must not exceed 256 characters')
  }
  if (hasControlChars(config.name)) {
    throw new Error('config.name must not contain control characters')
  }
  if (config.about.trim().length === 0) {
    throw new Error('config.about must not be empty or whitespace-only')
  }
  if (config.about.length > 4096) {
    throw new Error('config.about must not exceed 4096 characters')
  }
  if (hasControlChars(config.about)) {
    throw new Error('config.about must not contain control characters')
  }
  if (config.topics) {
    if (config.topics.length > 50) {
      throw new Error('config.topics must not exceed 50 entries')
    }
    for (const topic of config.topics) {
      if (topic.trim().length === 0) {
        throw new Error('config.topics entries must not be empty or whitespace-only')
      }
      if (topic.length > 64) {
        throw new Error(`config.topics entry must not exceed 64 characters, got: "${topic.slice(0, 20)}..."`)
      }
      if (hasControlChars(topic)) {
        throw new Error('config.topics entries must not contain control characters')
      }
    }
  }

  // Validate paymentMethods
  if (config.paymentMethods.length === 0) {
    throw new Error('config.paymentMethods must contain at least one entry')
  }
  if (config.paymentMethods.length > 20) {
    throw new Error('config.paymentMethods must not exceed 20 entries')
  }
  for (const pm of config.paymentMethods) {
    if (pm.trim().length === 0) {
      throw new Error('config.paymentMethods entries must not be empty or whitespace-only')
    }
    if (pm.length > 64) {
      throw new Error(`config.paymentMethods entry must not exceed 64 characters, got: "${pm.slice(0, 20)}..."`)
    }
    if (hasControlChars(pm)) {
      throw new Error('config.paymentMethods entries must not contain control characters')
    }
  }

  // Validate version early (before content construction)
  if (config.version !== undefined) {
    if (typeof config.version !== 'string' || config.version.trim().length === 0) {
      throw new Error('config.version must be a non-empty string')
    }
    if (config.version.length > 64) {
      throw new Error('config.version must not exceed 64 characters')
    }
    if (hasControlChars(config.version)) {
      throw new Error('config.version must not contain control characters')
    }
  }

  // M3: Validate all pricing entries
  if (config.pricing.length === 0) {
    throw new Error('config.pricing must contain at least one entry')
  }
  if (config.pricing.length > 100) {
    throw new Error('config.pricing must not exceed 100 entries')
  }
  for (const p of config.pricing) {
    if (!Number.isFinite(p.price) || p.price < 0) {
      throw new Error(`config.pricing price must be a finite non-negative number, got: ${p.price}`)
    }
    if (p.capability.trim().length === 0) {
      throw new Error('config.pricing capability must not be empty or whitespace-only')
    }
    if (p.capability.length > 64) {
      throw new Error(`config.pricing capability must not exceed 64 characters`)
    }
    if (hasControlChars(p.capability)) {
      throw new Error('config.pricing capability must not contain control characters')
    }
    if (p.currency.trim().length === 0) {
      throw new Error('config.pricing currency must not be empty or whitespace-only')
    }
    if (p.currency.length > 32) {
      throw new Error(`config.pricing currency must not exceed 32 characters`)
    }
    if (hasControlChars(p.currency)) {
      throw new Error('config.pricing currency must not contain control characters')
    }
  }

  const sk = hexToBytes(secretKeyHex)
  try {
    const tags: string[][] = [
      ['d', config.identifier],
      ['name', config.name],
      ...config.urls.map(u => ['url', u]),
      ['about', config.about],
    ]

    if (config.picture) {
      tags.push(['picture', config.picture])
    }

    for (const pm of config.paymentMethods) {
      tags.push(['pmi', pm])
    }

    for (const p of config.pricing) {
      tags.push(['price', p.capability, String(p.price), p.currency])
    }

    if (config.topics) {
      for (const topic of config.topics) {
        tags.push(['t', topic])
      }
    }

    const contentObj: Record<string, unknown> = {}
    if (config.capabilities) {
      if (config.capabilities.length > 100) {
        throw new Error('config.capabilities must not exceed 100 entries')
      }
      for (const cap of config.capabilities) {
        if (cap.name.trim().length === 0) {
          throw new Error('config.capabilities name must not be empty or whitespace-only')
        }
        if (cap.name.length > 128) {
          throw new Error('config.capabilities name must not exceed 128 characters')
        }
        if (hasControlChars(cap.name)) {
          throw new Error('config.capabilities name must not contain control characters')
        }
        if (cap.description.length > 4096) {
          throw new Error('config.capabilities description must not exceed 4096 characters')
        }
        if (hasControlChars(cap.description)) {
          throw new Error('config.capabilities description must not contain control characters')
        }
        if (cap.endpoint !== undefined) {
          if (typeof cap.endpoint !== 'string' || cap.endpoint.trim().length === 0) {
            throw new Error('config.capabilities endpoint must be a non-empty string')
          }
          if (cap.endpoint.length > 2048) {
            throw new Error('config.capabilities endpoint must not exceed 2048 characters')
          }
          const epLower = cap.endpoint.toLowerCase()
          if (!epLower.startsWith('/') && !epLower.startsWith('http://') && !epLower.startsWith('https://')) {
            throw new Error('config.capabilities endpoint must start with /, http://, or https://')
          }
        }
      }
      contentObj.capabilities = config.capabilities
    }
    if (config.version) {
      contentObj.version = config.version
    }

    // Reject excessively nested schemas that could cause CPU-bound DoS in JSON.stringify
    const MAX_SCHEMA_DEPTH = 20
    if (jsonDepth(contentObj, MAX_SCHEMA_DEPTH) > MAX_SCHEMA_DEPTH) {
      throw new Error(`Event content nesting exceeds maximum depth (${MAX_SCHEMA_DEPTH} levels)`)
    }

    let content: string
    try {
      content = JSON.stringify(contentObj)
    } catch {
      throw new Error('Event content could not be serialised (circular reference or invalid schema)')
    }
    if (Buffer.byteLength(content, 'utf8') > 65_536) {
      throw new Error('Event content exceeds maximum size (64 KiB)')
    }

    const event = finalizeEvent(
      {
        kind: L402_ANNOUNCE_KIND,
        tags,
        content,
        created_at: Math.floor(Date.now() / 1000),
      },
      sk,
    )

    return event
  } finally {
    sk.fill(0)
  }
}
