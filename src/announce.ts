import { getPublicKey } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { buildAnnounceEvent } from './event.js'
import { hexToBytes } from './utils.js'
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

  if (!/^[0-9a-f]{64}$/i.test(secretKey)) {
    throw new Error('secretKey must be a 64-character hex string')
  }

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

  // Connect to relays in parallel and publish
  const connectedRelays: InstanceType<typeof Relay>[] = []
  let accepted = 0

  const results = await Promise.allSettled(
    relays.map(async (url) => {
      const relay = await Promise.race([
        Relay.connect(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Relay connection timeout: ${url}`)), 10_000)
        ),
      ])
      connectedRelays.push(relay)
      await relay.publish(event)
      accepted++
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[402-announce] Failed to publish:`, result.reason)
    }
  }

  if (accepted === 0) {
    console.warn('[402-announce] No relays accepted the event')
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
