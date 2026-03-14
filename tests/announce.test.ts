import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateSecretKey } from 'nostr-tools/pure'
import type { AnnounceConfig } from '../src/types.js'
import { isPrivateHost } from '../src/utils.js'

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

  it('rejects invalid secret key', async () => {
    await expect(announceService({ ...makeConfig(), secretKey: 'bad' })).rejects.toThrow('64-character hex')
  })

  describe('SSRF prevention — private/loopback relay URLs (H3)', () => {
    const privateUrls = [
      'wss://localhost/relay',
      'wss://127.0.0.1/relay',
      'wss://127.0.0.2/relay',
      'ws://localhost/relay',
      'wss://0.0.0.0/relay',
      'wss://10.0.0.1/relay',
      'wss://10.255.255.255/relay',
      'wss://192.168.1.1/relay',
      'wss://192.168.0.255/relay',
      'wss://172.16.0.1/relay',
      'wss://172.31.255.255/relay',
      'wss://169.254.1.1/relay',
      'wss://[::1]/relay',
    ]

    for (const url of privateUrls) {
      it(`rejects ${url}`, async () => {
        const config = makeConfig({ relays: [url] })
        await expect(announceService(config)).rejects.toThrow(/private\/loopback/)
      })
    }

    it('accepts a public relay URL', async () => {
      const config = makeConfig({ relays: ['wss://relay.example.com'] })
      await expect(announceService(config)).resolves.toBeDefined()
    })
  })

  describe('isPrivateHost helper (H3)', () => {
    it('identifies localhost as private', () => {
      expect(isPrivateHost('localhost')).toBe(true)
    })

    it('identifies 127.x.x.x as private', () => {
      expect(isPrivateHost('127.0.0.1')).toBe(true)
      expect(isPrivateHost('127.255.0.1')).toBe(true)
    })

    it('identifies ::1 as private', () => {
      expect(isPrivateHost('::1')).toBe(true)
      expect(isPrivateHost('[::1]')).toBe(true)
    })

    it('identifies 10.x.x.x as private', () => {
      expect(isPrivateHost('10.0.0.1')).toBe(true)
      expect(isPrivateHost('10.255.255.255')).toBe(true)
    })

    it('identifies 172.16-31.x.x as private', () => {
      expect(isPrivateHost('172.16.0.1')).toBe(true)
      expect(isPrivateHost('172.31.255.255')).toBe(true)
    })

    it('does not flag 172.15 or 172.32 as private', () => {
      expect(isPrivateHost('172.15.0.1')).toBe(false)
      expect(isPrivateHost('172.32.0.1')).toBe(false)
    })

    it('identifies 192.168.x.x as private', () => {
      expect(isPrivateHost('192.168.0.1')).toBe(true)
      expect(isPrivateHost('192.168.255.255')).toBe(true)
    })

    it('identifies 0.0.0.0 as private', () => {
      expect(isPrivateHost('0.0.0.0')).toBe(true)
    })

    it('identifies 169.254.x.x as link-local', () => {
      expect(isPrivateHost('169.254.0.1')).toBe(true)
      expect(isPrivateHost('169.254.169.254')).toBe(true)
    })

    it('does not flag public IPs as private', () => {
      expect(isPrivateHost('8.8.8.8')).toBe(false)
      expect(isPrivateHost('1.1.1.1')).toBe(false)
      expect(isPrivateHost('relay.example.com')).toBe(false)
    })
  })

  describe('ws:// insecure relay warning (M4)', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      warnSpy.mockRestore()
    })

    it('emits a console.warn for ws:// relay URLs', async () => {
      const config = makeConfig({ relays: ['ws://relay.example.com'] })
      await announceService(config)

      const wsWarning = warnSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Insecure WebSocket'),
      )
      expect(wsWarning).toBeDefined()
      expect(wsWarning![0]).toContain('ws://relay.example.com')
      expect(wsWarning![0]).toContain('wss://')
    })

    it('does not emit a ws:// warning for wss:// relay URLs', async () => {
      const config = makeConfig({ relays: ['wss://relay.example.com'] })
      await announceService(config)

      const wsWarning = warnSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Insecure WebSocket'),
      )
      expect(wsWarning).toBeUndefined()
    })
  })
})
