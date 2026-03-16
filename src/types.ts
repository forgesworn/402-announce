/** Pricing for a specific capability. */
export interface PricingDef {
  /** Capability name (e.g. 'chat', 'get_joke', 'route') */
  capability: string
  /** Price amount */
  price: number
  /** Currency unit (e.g. 'sats') */
  currency: string
}

/** Capability with description (optional extended metadata). */
export interface CapabilityDef {
  name: string
  description: string
  /** Optional endpoint path or full URL for this capability (e.g. '/api/joke' or 'https://api.example.com/v1/chat'). */
  endpoint?: string
  /** Optional JSON Schema describing the capability's input parameters. */
  schema?: unknown
  /** Optional JSON Schema describing the capability's output. */
  outputSchema?: unknown
}

/** Configuration for announceService(). */
export interface AnnounceConfig {
  /** Nostr secret key (64-char hex). The library zeroes internal byte copies
   *  after signing, but JavaScript strings are immutable and cannot be erased
   *  from memory — minimise the lifetime of this value in your application. */
  secretKey: string
  /** Nostr relay URLs to publish to (wss:// or ws://) */
  relays: string[]
  /** Unique identifier for this service listing (d tag). Same pubkey + identifier = same listing. */
  identifier: string
  /** Human-readable service name */
  name: string
  /** Transport endpoint URLs (1-10, each max 2048 characters). */
  urls: string[]
  /** Short description of what the service does */
  about: string
  /** Optional icon URL */
  picture?: string
  /** Pricing for capabilities */
  pricing: PricingDef[]
  /** Accepted payment methods (e.g. ['bitcoin-lightning-bolt11', 'bitcoin-cashu']) */
  paymentMethods: string[]
  /** Optional topic tags for search/filtering (e.g. ['ai', 'inference']) */
  topics?: string[]
  /** Optional capability details (goes in content field) */
  capabilities?: CapabilityDef[]
  /** Optional service version (goes in content field) */
  version?: string
}

/** Handle returned by announceService() for cleanup. */
export interface Announcement {
  /** Published event ID */
  eventId: string
  /** Nostr pubkey derived from the secret key */
  pubkey: string
  /** Close relay connections. Synchronous. */
  close(): void
}

/** The Nostr event kind used for L402 service announcements. */
export const L402_ANNOUNCE_KIND = 31402
