import { finalizeEvent } from 'nostr-tools/pure'
import { L402_ANNOUNCE_KIND } from './types.js'
import { hexToBytes } from './utils.js'
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
  if (!/^[0-9a-f]{64}$/i.test(secretKeyHex)) {
    throw new Error('secretKey must be a 64-character hex string')
  }

  // M1: Validate url field (scheme only — this function serialises the URL
  // into event tags without performing network I/O, so private hosts are allowed)
  if (!config.url.startsWith('http://') && !config.url.startsWith('https://')) {
    throw new Error('config.url must start with http:// or https://')
  }

  // M1: Validate picture field when present
  if (config.picture !== undefined) {
    if (!config.picture.startsWith('http://') && !config.picture.startsWith('https://')) {
      throw new Error('config.picture must start with http:// or https://')
    }
  }

  // M2: Validate identifier is non-empty and within length limit
  if (config.identifier.trim().length === 0) {
    throw new Error('config.identifier must not be empty or whitespace-only')
  }
  if (config.identifier.length > 256) {
    throw new Error('config.identifier must not exceed 256 characters')
  }

  // Tag field length limits
  if (config.name.length > 256) {
    throw new Error('config.name must not exceed 256 characters')
  }
  if (config.about.length > 4096) {
    throw new Error('config.about must not exceed 4096 characters')
  }
  if (config.topics) {
    if (config.topics.length > 50) {
      throw new Error('config.topics must not exceed 50 entries')
    }
    for (const topic of config.topics) {
      if (topic.length > 64) {
        throw new Error(`config.topics entry must not exceed 64 characters, got: "${topic.slice(0, 20)}..."`)
      }
    }
  }

  // M3: Validate all pricing entries
  for (const p of config.pricing) {
    if (!Number.isFinite(p.price) || p.price < 0) {
      throw new Error(`config.pricing price must be a finite non-negative number, got: ${p.price}`)
    }
  }

  const sk = hexToBytes(secretKeyHex)
  try {
    const tags: string[][] = [
      ['d', config.identifier],
      ['name', config.name],
      ['url', config.url],
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
      contentObj.capabilities = config.capabilities
    }
    if (config.version) {
      contentObj.version = config.version
    }

    const content = JSON.stringify(contentObj)
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
