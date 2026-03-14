import { finalizeEvent } from 'nostr-tools/pure'
import { L402_ANNOUNCE_KIND } from './types.js'
import { hexToBytes } from './utils.js'
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
  if (!/^[0-9a-f]{64}$/i.test(secretKeyHex)) {
    throw new Error('secretKey must be a 64-character hex string')
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

    if (config.status) {
      tags.push(['status', config.status])
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
