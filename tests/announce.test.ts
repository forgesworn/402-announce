import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSecretKey } from 'nostr-tools/pure'
import type { AnnounceConfig } from '../src/types.js'

// Mock nostr-tools/relay
const mockPublish = vi.fn().mockResolvedValue('ok')
const mockClose = vi.fn()
const mockRelay = {
  publish: mockPublish,
  close: mockClose,
}
vi.mock('nostr-tools/relay', () => ({
  Relay: {
    connect: vi.fn().mockResolvedValue(mockRelay),
  },
}))

// Import after mock is set up
const { announceService } = await import('../src/announce.js')
const { Relay } = await import('nostr-tools/relay')

function makeSecretKeyHex(): string {
  const sk = generateSecretKey()
  return Buffer.from(sk).toString('hex')
}

function makeConfig(overrides: Partial<AnnounceConfig> = {}): AnnounceConfig {
  return {
    secretKey: makeSecretKeyHex(),
    relays: ['wss://relay.example.com'],
    identifier: 'jokes-api',
    name: 'Jokes API',
    url: 'https://jokes.example.com',
    about: 'A joke-telling service',
    pricing: [{ capability: 'get_joke', price: 1, currency: 'sats' }],
    paymentMethods: ['bitcoin-lightning-bolt11'],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Relay.connect).mockResolvedValue(mockRelay as any)
  mockPublish.mockResolvedValue('ok')
})

describe('announceService', () => {
  it('publishes one event to each relay', async () => {
    const config = makeConfig({ relays: ['wss://relay.example.com'] })
    const result = await announceService(config)

    expect(Relay.connect).toHaveBeenCalledTimes(1)
    expect(Relay.connect).toHaveBeenCalledWith('wss://relay.example.com')
    expect(mockPublish).toHaveBeenCalledTimes(1)
    expect(result.eventId).toMatch(/^[0-9a-f]{64}$/)
    expect(result.pubkey).toMatch(/^[0-9a-f]{64}$/)
  })

  it('rejects invalid relay URLs (not wss:// or ws://)', async () => {
    const config = makeConfig({ relays: ['https://not-a-relay.com'] })
    await expect(announceService(config)).rejects.toThrow(/relay URL/i)
  })

  it('rejects empty relay list', async () => {
    const config = makeConfig({ relays: [] })
    await expect(announceService(config)).rejects.toThrow(/relay/i)
  })

  it('close() disconnects from relays', async () => {
    const config = makeConfig()
    const result = await announceService(config)

    result.close()
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('publishes to multiple relays', async () => {
    const config = makeConfig({
      relays: ['wss://relay1.example.com', 'wss://relay2.example.com', 'ws://relay3.example.com'],
    })
    const result = await announceService(config)

    expect(Relay.connect).toHaveBeenCalledTimes(3)
    expect(mockPublish).toHaveBeenCalledTimes(3)
    expect(result.eventId).toMatch(/^[0-9a-f]{64}$/)

    result.close()
    expect(mockClose).toHaveBeenCalledTimes(3)
  })
})
