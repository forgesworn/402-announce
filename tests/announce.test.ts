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
    urls: ['https://jokes.example.com'],
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

    it('rejects CGNAT range relay', async () => {
      const config = makeConfig({ relays: ['wss://100.64.0.1/relay'] })
      await expect(announceService(config)).rejects.toThrow(/private\/loopback/)
    })

    it('rejects reserved range relay (240.0.0.0/4)', async () => {
      const config = makeConfig({ relays: ['wss://240.0.0.1/relay'] })
      await expect(announceService(config)).rejects.toThrow(/private\/loopback/)
    })

    it('rejects benchmarking range relay (198.18.0.0/15)', async () => {
      const config = makeConfig({ relays: ['wss://198.18.0.1/relay'] })
      await expect(announceService(config)).rejects.toThrow(/private\/loopback/)
    })

    it('accepts a public relay URL', async () => {
      const config = makeConfig({ relays: ['wss://relay.example.com'] })
      await expect(announceService(config)).resolves.toBeDefined()
    })

    it('deduplicates relay URLs', async () => {
      const config = makeConfig({ relays: ['wss://relay.example.com', 'wss://relay.example.com'] })
      await announceService(config)
      expect(Relay.connect).toHaveBeenCalledTimes(1)
    })
  })

  describe('relay URL userinfo rejection', () => {
    it('rejects relay URL with username', async () => {
      const config = makeConfig({ relays: ['wss://user@relay.example.com'] })
      await expect(announceService(config)).rejects.toThrow(/credentials/)
    })

    it('rejects relay URL with username and password', async () => {
      const config = makeConfig({ relays: ['wss://user:pass@relay.example.com'] })
      await expect(announceService(config)).rejects.toThrow(/credentials/)
    })

    it('does not leak credentials in error message', async () => {
      const config = makeConfig({ relays: ['wss://user:secret@relay.example.com'] })
      try {
        await announceService(config)
        expect.unreachable('should have thrown')
      } catch (e) {
        const msg = (e as Error).message
        expect(msg).not.toContain('secret')
        expect(msg).not.toContain('user:')
        expect(msg).toContain('credentials')
      }
    })
  })

  describe('relay count limit', () => {
    it('rejects more than 50 relays', async () => {
      const relays = Array.from({ length: 51 }, (_, i) => `wss://relay${i}.example.com`)
      const config = makeConfig({ relays })
      await expect(announceService(config)).rejects.toThrow(/maximum 50/)
    })

    it('accepts exactly 50 relays', async () => {
      const relays = Array.from({ length: 50 }, (_, i) => `wss://relay${i}.example.com`)
      const config = makeConfig({ relays })
      await expect(announceService(config)).resolves.toBeDefined()
    })
  })

  describe('isPrivateHost helper (H3)', () => {
    it('identifies localhost as private', () => {
      expect(isPrivateHost('localhost')).toBe(true)
    })

    it('identifies localhost. (FQDN) as private', () => {
      expect(isPrivateHost('localhost.')).toBe(true)
    })

    it('identifies *.localhost subdomains as private', () => {
      expect(isPrivateHost('foo.localhost')).toBe(true)
      expect(isPrivateHost('bar.baz.localhost')).toBe(true)
      expect(isPrivateHost('foo.localhost.')).toBe(true)
    })

    it('identifies 127.x.x.x as private', () => {
      expect(isPrivateHost('127.0.0.1')).toBe(true)
      expect(isPrivateHost('127.255.0.1')).toBe(true)
    })

    it('identifies ::1 as private', () => {
      expect(isPrivateHost('::1')).toBe(true)
      expect(isPrivateHost('[::1]')).toBe(true)
    })

    it('identifies :: (unspecified) as private', () => {
      expect(isPrivateHost('::')).toBe(true)
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

    it('identifies entire 0.0.0.0/8 range as private', () => {
      expect(isPrivateHost('0.0.0.0')).toBe(true)
      expect(isPrivateHost('0.1.0.0')).toBe(true)
      expect(isPrivateHost('0.255.255.255')).toBe(true)
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

    describe('SSRF bypass vectors', () => {
      it('rejects octal IPv4 notation (leading zeros)', () => {
        expect(isPrivateHost('0177.0.0.1')).toBe(true)   // 127.0.0.1 in octal
        expect(isPrivateHost('012.0.0.1')).toBe(true)     // 10.0.0.1 in octal
        expect(isPrivateHost('0300.0250.0.1')).toBe(true)  // 192.168.0.1 in octal
      })

      it('rejects hex IPv4 notation', () => {
        expect(isPrivateHost('0x7f.0.0.1')).toBe(true)
        expect(isPrivateHost('0x7f000001')).toBe(true)
        expect(isPrivateHost('0x0a000001')).toBe(true)
      })

      it('does not reject DNS names with 0x-prefixed labels', () => {
        expect(isPrivateHost('0xchat.example')).toBe(false)
        expect(isPrivateHost('relay.0xchat.example')).toBe(false)
        expect(isPrivateHost('0x7f.example.com')).toBe(false)
      })

      it('rejects shorthand IPv4 (fewer than 4 parts)', () => {
        expect(isPrivateHost('127.1')).toBe(true)       // 127.0.0.1
        expect(isPrivateHost('10.1')).toBe(true)         // 10.0.0.1
        expect(isPrivateHost('127.0.1')).toBe(true)      // 127.0.0.1
      })

      it('rejects decimal integer IPv4', () => {
        expect(isPrivateHost('2130706433')).toBe(true)   // 127.0.0.1
        expect(isPrivateHost('167772161')).toBe(true)    // 10.0.0.1
      })

      it('rejects IPv4-mapped IPv6 (dotted-quad form)', () => {
        expect(isPrivateHost('::ffff:127.0.0.1')).toBe(true)
        expect(isPrivateHost('::ffff:10.0.0.1')).toBe(true)
        expect(isPrivateHost('::ffff:192.168.1.1')).toBe(true)
        expect(isPrivateHost('::ffff:169.254.1.1')).toBe(true)
      })

      it('rejects IPv4-mapped IPv6 (hex form)', () => {
        expect(isPrivateHost('::ffff:7f00:1')).toBe(true)    // 127.0.0.1
        expect(isPrivateHost('::ffff:a00:1')).toBe(true)      // 10.0.0.1
        expect(isPrivateHost('::ffff:c0a8:101')).toBe(true)   // 192.168.1.1
      })

      it('allows IPv4-mapped IPv6 with public IP', () => {
        expect(isPrivateHost('::ffff:8.8.8.8')).toBe(false)
        expect(isPrivateHost('::ffff:808:808')).toBe(false)   // 8.8.8.8
      })

      it('rejects IPv4-compatible IPv6 (deprecated)', () => {
        expect(isPrivateHost('::127.0.0.1')).toBe(true)
        expect(isPrivateHost('::10.0.0.1')).toBe(true)
      })

      it('rejects IPv6 unique-local (fc00::/7)', () => {
        expect(isPrivateHost('fc00::1')).toBe(true)
        expect(isPrivateHost('fd00::1')).toBe(true)
        expect(isPrivateHost('fdff::1')).toBe(true)
      })

      it('rejects IPv6 link-local (fe80::/10)', () => {
        expect(isPrivateHost('fe80::1')).toBe(true)
        expect(isPrivateHost('febf::1')).toBe(true)
      })

      it('rejects CGNAT / shared address space (100.64.0.0/10)', () => {
        expect(isPrivateHost('100.64.0.1')).toBe(true)
        expect(isPrivateHost('100.100.0.1')).toBe(true)
        expect(isPrivateHost('100.127.255.255')).toBe(true)
      })

      it('does not flag 100.128+ as private', () => {
        expect(isPrivateHost('100.128.0.1')).toBe(false)
        expect(isPrivateHost('100.63.0.1')).toBe(false)
      })

      it('rejects reserved range 240.0.0.0/4', () => {
        expect(isPrivateHost('240.0.0.1')).toBe(true)
        expect(isPrivateHost('255.255.255.254')).toBe(true)
        expect(isPrivateHost('255.255.255.255')).toBe(true)
      })

      it('rejects benchmarking range 198.18.0.0/15', () => {
        expect(isPrivateHost('198.18.0.1')).toBe(true)
        expect(isPrivateHost('198.19.255.255')).toBe(true)
      })

      it('does not flag 198.17 or 198.20 as private', () => {
        expect(isPrivateHost('198.17.0.1')).toBe(false)
        expect(isPrivateHost('198.20.0.1')).toBe(false)
      })

      it('rejects IANA special-purpose ranges', () => {
        expect(isPrivateHost('192.0.0.1')).toBe(true)       // 192.0.0.0/24
        expect(isPrivateHost('192.0.2.1')).toBe(true)       // TEST-NET-1
        expect(isPrivateHost('198.51.100.1')).toBe(true)    // TEST-NET-2
        expect(isPrivateHost('203.0.113.1')).toBe(true)     // TEST-NET-3
        expect(isPrivateHost('192.88.99.1')).toBe(true)     // 6to4 relay anycast
      })

      it('does not flag adjacent ranges as special-purpose', () => {
        expect(isPrivateHost('192.0.3.1')).toBe(false)
        expect(isPrivateHost('198.51.101.1')).toBe(false)
        expect(isPrivateHost('203.0.114.1')).toBe(false)
        expect(isPrivateHost('192.88.100.1')).toBe(false)
      })

      it('rejects 6to4 addresses embedding private IPv4 (2002::/16)', () => {
        expect(isPrivateHost('2002:7f00:0001::1')).toBe(true)   // 127.0.0.1
        expect(isPrivateHost('2002:0a00:0001::1')).toBe(true)   // 10.0.0.1
        expect(isPrivateHost('2002:c0a8:0101::1')).toBe(true)   // 192.168.1.1
      })

      it('rejects compressed 6to4 with zero hextet (2002:7f00::1)', () => {
        expect(isPrivateHost('2002:7f00::1')).toBe(true)        // 127.0.0.0 embedded
        expect(isPrivateHost('2002:0a00::1')).toBe(true)        // 10.0.0.0 embedded
      })

      it('allows 6to4 addresses embedding public IPv4', () => {
        expect(isPrivateHost('2002:0808:0808::1')).toBe(false)  // 8.8.8.8
      })

      it('rejects Teredo addresses (2001:0000::/32)', () => {
        expect(isPrivateHost('2001:0000:abcd::1')).toBe(true)
        expect(isPrivateHost('2001:0:abcd::1')).toBe(true)
      })

      it('rejects compressed Teredo addresses (2001::1)', () => {
        expect(isPrivateHost('2001::1')).toBe(true)
        expect(isPrivateHost('2001::abcd')).toBe(true)
      })

      it('rejects fully expanded IPv4-mapped IPv6 with private IP', () => {
        expect(isPrivateHost('0000:0000:0000:0000:0000:ffff:7f00:0001')).toBe(true)  // 127.0.0.1
        expect(isPrivateHost('0000:0000:0000:0000:0000:ffff:0a00:0001')).toBe(true)  // 10.0.0.1
        expect(isPrivateHost('0000:0000:0000:0000:0000:ffff:c0a8:0101')).toBe(true)  // 192.168.1.1
      })

      it('allows fully expanded IPv4-mapped IPv6 with public IP', () => {
        expect(isPrivateHost('0000:0000:0000:0000:0000:ffff:0808:0808')).toBe(false)  // 8.8.8.8
      })

      it('rejects IPv6 with zone ID suffix', () => {
        expect(isPrivateHost('[::1%25eth0]')).toBe(true)
        expect(isPrivateHost('::1%eth0')).toBe(true)
        expect(isPrivateHost('fe80::1%eth0')).toBe(true)
      })
    })
  })

  describe('SSRF prevention — private/loopback service URLs', () => {
    const privateServiceUrls = [
      'http://localhost:3000/api',
      'http://127.0.0.1:3000/api',
      'http://10.0.0.1/api',
      'http://192.168.1.1/api',
      'http://[::1]/api',
    ]

    for (const url of privateServiceUrls) {
      it(`rejects event when all urls are private (${url})`, async () => {
        const config = makeConfig({ urls: [url] })
        await expect(announceService(config)).rejects.toThrow(/private\/loopback/)
      })
    }

    it('accepts public service URL', async () => {
      const config = makeConfig({ urls: ['https://satgate.trotters.dev'] })
      await expect(announceService(config)).resolves.toBeDefined()
    })

    it('allows event when at least one url is public', async () => {
      const config = makeConfig({
        urls: ['http://192.168.1.1/api', 'https://satgate.trotters.dev'],
      })
      await expect(announceService(config)).resolves.toBeDefined()
    })

    it('rejects event when ALL urls are private', async () => {
      const config = makeConfig({
        urls: ['http://localhost:3000/api', 'http://10.0.0.1/api'],
      })
      await expect(announceService(config)).rejects.toThrow(/private\/loopback/)
    })

    it('skips SSRF check for .onion urls (treats them as public)', async () => {
      const config = makeConfig({
        urls: ['http://exampleonion123.onion/api'],
      })
      await expect(announceService(config)).resolves.toBeDefined()
    })

    it('skips SSRF check for non-http/https schemes', async () => {
      const config = makeConfig({
        urls: ['hyper://abc123.example'],
      })
      await expect(announceService(config)).resolves.toBeDefined()
    })

    it('allows mix of .onion and private http (onion counts as public)', async () => {
      const config = makeConfig({
        urls: ['http://192.168.1.1/api', 'http://exampleonion123.onion/api'],
      })
      await expect(announceService(config)).resolves.toBeDefined()
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

    it('emits a warning for uppercase WS:// relay URLs', async () => {
      const config = makeConfig({ relays: ['WS://relay.example.com'] })
      await announceService(config)

      const wsWarning = warnSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Insecure WebSocket'),
      )
      expect(wsWarning).toBeDefined()
    })
  })
})
