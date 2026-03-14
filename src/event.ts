import { finalizeEvent } from 'nostr-tools/pure'
import { L402_ANNOUNCE_KIND } from './types.js'
import type { AnnounceConfig } from './types.js'
import type { VerifiedEvent } from 'nostr-tools/pure'

/**
 * Build and sign a kind 31402 Nostr event announcing an L402 service.
 *
 * The secret key bytes are zeroised after signing.
 *
 * @param secretKeyHex - 64-character hex-encoded Nostr secret key
 * @param config - Service announcement configuration
 * @returns Signed Nostr event ready for relay publication
 */
export function buildAnnounceEvent(
  secretKeyHex: string,
  config: Omit<AnnounceConfig, 'relays'>,
): VerifiedEvent {
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

    const event = finalizeEvent(
      {
        kind: L402_ANNOUNCE_KIND,
        tags,
        content: JSON.stringify(contentObj),
        created_at: Math.floor(Date.now() / 1000),
      },
      sk,
    )

    return event
  } finally {
    sk.fill(0)
  }
}

/** Convert a hex string to Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
