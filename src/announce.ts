import { Relay } from 'nostr-tools/relay'
import { buildAnnounceEvent } from './event.js'
import { isPrivateHost } from './utils.js'
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
  const { relays: rawRelays, secretKey } = config
  const relays = [...new Set(rawRelays)]

  if (!/^[0-9a-f]{64}$/i.test(secretKey)) {
    throw new Error('secretKey must be a 64-character hex string')
  }

  if (relays.length === 0) {
    throw new Error('At least one relay URL is required')
  }
  if (relays.length > 50) {
    throw new Error('Too many relays (maximum 50)')
  }

  for (const url of relays) {
    if (!/^wss?:\/\//i.test(url)) {
      throw new Error(`Invalid relay URL: ${url} — must start with wss:// or ws://`)
    }

    // H3: Reject private/loopback relay URLs (SSRF prevention)
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error(`Invalid relay URL: ${url}`)
    }
    if (parsed.username || parsed.password) {
      throw new Error(`Relay URL must not contain credentials: ${parsed.origin}${parsed.pathname}`)
    }
    if (isPrivateHost(parsed.hostname)) {
      throw new Error(`Relay URL points to a private/loopback address: ${url}`)
    }

    // M4: Warn on insecure ws:// usage
    if (url.startsWith('ws://')) {
      console.warn(
        `[402-announce] Insecure WebSocket (ws://) relay: ${url} — use wss:// in production`,
      )
    }
  }

  // Build and sign the event (H2: no redundant key decode — pubkey comes from the event)
  const event = buildAnnounceEvent(secretKey, config)

  // Connect to relays in parallel and publish
  const connectedRelays: InstanceType<typeof Relay>[] = []
  let accepted = 0

  const results = await Promise.allSettled(
    relays.map(async (url) => {
      // H4: Track the relay reference before the race so it can be closed on timeout.
      // Relay.connect() is started, then we race against the timeout. If the timeout
      // fires first we close the relay once the connect promise eventually resolves,
      // preventing the connection from leaking in the background.
      const connectPromise = Relay.connect(url)

      let timedOut = false
      let timerId: ReturnType<typeof setTimeout> | undefined
      const relay = await Promise.race([
        connectPromise.then((r) => { clearTimeout(timerId); return r }),
        new Promise<never>((_, reject) => {
          timerId = setTimeout(() => {
            timedOut = true
            reject(new Error(`Relay connection timeout: ${url}`))
          }, 10_000)
        }),
      ]).catch(async (err) => {
        // If the timeout fired, wait for the connect promise to settle so we
        // can close any relay that connected after the deadline.
        if (timedOut) {
          connectPromise.then((r) => r.close()).catch(() => {})
        }
        throw err
      })

      connectedRelays.push(relay)
      await relay.publish(event)
      accepted++
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[402-announce] Failed to publish: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
    }
  }

  if (accepted === 0) {
    console.warn('[402-announce] No relays accepted the event')
  }

  return {
    eventId: event.id,
    pubkey: event.pubkey,
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
