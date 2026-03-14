import { getPublicKey } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { buildAnnounceEvent } from './event.js'
import type { AnnounceConfig, Announcement } from './types.js'

/**
 * Publish a kind 31402 L402 service announcement to Nostr relays.
 *
 * Connects to each relay, publishes the signed event, and returns an
 * {@link Announcement} handle whose `close()` method disconnects all relays.
 *
 * Relay failures are logged but do not reject the promise -- the function
 * degrades gracefully. A warning is emitted if *no* relay accepted the event.
 *
 * @throws If the relay list is empty or contains invalid URLs.
 */
export async function announceService(config: AnnounceConfig): Promise<Announcement> {
  const { relays, secretKey } = config

  if (relays.length === 0) {
    throw new Error('At least one relay URL is required')
  }

  for (const url of relays) {
    if (!/^wss?:\/\//i.test(url)) {
      throw new Error(`Invalid relay URL: ${url} — must start with wss:// or ws://`)
    }
  }

  // Derive pubkey (zeroises sk bytes internally)
  const skBytes = hexToBytes(secretKey)
  const pubkey = getPublicKey(skBytes)
  skBytes.fill(0)

  // Build and sign the event
  const event = buildAnnounceEvent(secretKey, config)

  // Connect to relays and publish
  const connectedRelays: InstanceType<typeof Relay>[] = []
  let accepted = 0

  for (const url of relays) {
    try {
      const relay = await Relay.connect(url)
      connectedRelays.push(relay)
      await relay.publish(event)
      accepted++
    } catch (err) {
      console.warn(`[l402-announce] Failed to publish to ${url}:`, err)
    }
  }

  if (accepted === 0) {
    console.warn('[l402-announce] No relays accepted the event')
  }

  return {
    eventId: event.id,
    pubkey,
    close() {
      for (const relay of connectedRelays) {
        try {
          relay.close()
        } catch {
          // Ignore close errors
        }
      }
    },
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
