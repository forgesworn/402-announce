/** Versioned ForgeSworn extension, not a ratified Nostr/Blossom specification. */
export const STORAGE_PROFILE = 'forgesworn-storage-service-v1' as const
export const STORAGE_SERVICE_PATH = '/services/v1' as const
export const STORAGE_MAX_EVENT_BYTES = 65_536
export const STORAGE_MAX_TTL_SECONDS = 86_400
export const STORAGE_DEFAULT_MAX_AGE_SECONDS = 7_200

/** Operator-advertised admission state; it is not a reservation or uptime proof. */
export type StorageAvailability = 'accepting' | 'full' | 'paused' | 'unknown'

export interface StorageIssuer {
  id: string
  note_endpoint: string
  callback: string
  mint_pubkey: string
}

export interface StorageCheckout {
  protocol: 'wildbloom-checkout-v1'
  /** Paid checkout is supported at this HTTPS origin only, even in mixed listings. */
  origin: string
  network: 'bitcoin' | 'testnet' | 'regtest'
  rails: ('lightning' | 'lnurlcash')[]
  issuers: StorageIssuer[]
}

export interface FreeMirrorService {
  id: string
  type: 'free-mirror'
  revision: number
  availability: StorageAvailability
  operation: 'mirror'
  authorisation: 'bud-11'
  retention: 'best-effort'
  eviction_policy: string
}

/** Matches the existing checkout offer fields; price is for the entire package. */
export interface PaidStorageService {
  id: string
  type: 'paid-storage'
  revision: number
  availability: StorageAvailability
  capacity_bytes: number
  duration_seconds: number
  grace_seconds: number
  price_msat: number
  delivery_bytes: number
  delivery_policy: string
  retention_policy: string
  refund_policy: string
}

/** Public HTTP description, also embedded in the signed event's content.storage. */
export interface StorageServiceDescription {
  profile: typeof STORAGE_PROFILE
  service_pubkey: string
  identifier: string
  name: string
  about: string
  origins: string[]
  max_blob_bytes: number
  observed_at: number
  expires_at: number
  state: 'published' | 'withdrawn'
  checkout: StorageCheckout | null
  services: (FreeMirrorService | PaidStorageService)[]
}

export interface StorageCapability {
  name: string
  description: string
  endpoint: string
}

export interface StorageAnnouncementContent {
  storage: StorageServiceDescription
  capabilities: StorageCapability[]
}

export interface StorageReadOptions {
  /** Inject time for offline verification and cross-language fixtures. */
  now: number
  maxAgeSeconds?: number
  clockSkewSeconds?: number
}
