import { describe, it, expect } from 'vitest'
import { generateSecretKey } from 'nostr-tools/pure'
import { buildAnnounceEvent } from '../src/event.js'
import { hexToBytes } from '../src/utils.js'
import { L402_ANNOUNCE_KIND } from '../src/types.js'
import type { AnnounceConfig } from '../src/types.js'

function makeSecretKeyHex(): string {
  const sk = generateSecretKey()
  return Buffer.from(sk).toString('hex')
}

function makeConfig(overrides: Partial<AnnounceConfig> = {}): Omit<AnnounceConfig, 'relays'> {
  return {
    secretKey: makeSecretKeyHex(),
    identifier: 'jokes-api',
    name: 'Jokes API',
    url: 'https://jokes.example.com',
    about: 'A joke-telling service',
    pricing: [{ capability: 'get_joke', price: 1, currency: 'sats' }],
    paymentMethods: ['bitcoin-lightning-bolt11'],
    ...overrides,
  }
}

describe('buildAnnounceEvent', () => {
  it('creates a kind 31402 event', () => {
    const config = makeConfig()
    const event = buildAnnounceEvent(config.secretKey, config)

    expect(event.kind).toBe(L402_ANNOUNCE_KIND)
    expect(event.kind).toBe(31402)
  })

  it('includes required tags (d, name, url, about, pmi)', () => {
    const config = makeConfig()
    const event = buildAnnounceEvent(config.secretKey, config)

    const tags = new Map(event.tags.map(t => [t[0], t]))

    expect(tags.get('d')?.[1]).toBe('jokes-api')
    expect(tags.get('name')?.[1]).toBe('Jokes API')
    expect(tags.get('url')?.[1]).toBe('https://jokes.example.com')
    expect(tags.get('about')?.[1]).toBe('A joke-telling service')
    expect(tags.has('pmi')).toBe(true)
  })

  it('includes price tags', () => {
    const config = makeConfig({
      pricing: [{ capability: 'get_joke', price: 1, currency: 'sats' }],
    })
    const event = buildAnnounceEvent(config.secretKey, config)

    const priceTags = event.tags.filter(t => t[0] === 'price')
    expect(priceTags).toHaveLength(1)
    expect(priceTags[0]).toEqual(['price', 'get_joke', '1', 'sats'])
  })

  it('includes multiple price tags', () => {
    const config = makeConfig({
      pricing: [
        { capability: 'get_joke', price: 1, currency: 'sats' },
        { capability: 'get_roast', price: 5, currency: 'sats' },
      ],
    })
    const event = buildAnnounceEvent(config.secretKey, config)

    const priceTags = event.tags.filter(t => t[0] === 'price')
    expect(priceTags).toHaveLength(2)
    expect(priceTags[0]).toEqual(['price', 'get_joke', '1', 'sats'])
    expect(priceTags[1]).toEqual(['price', 'get_roast', '5', 'sats'])
  })

  it('includes topic tags (t)', () => {
    const config = makeConfig({ topics: ['comedy', 'ai'] })
    const event = buildAnnounceEvent(config.secretKey, config)

    const topicTags = event.tags.filter(t => t[0] === 't')
    expect(topicTags).toHaveLength(2)
    expect(topicTags[0]).toEqual(['t', 'comedy'])
    expect(topicTags[1]).toEqual(['t', 'ai'])
  })

  it('includes picture tag when provided', () => {
    const config = makeConfig({ picture: 'https://example.com/icon.png' })
    const event = buildAnnounceEvent(config.secretKey, config)

    const picTag = event.tags.find(t => t[0] === 'picture')
    expect(picTag).toEqual(['picture', 'https://example.com/icon.png'])
  })

  it('includes multiple pmi tags', () => {
    const config = makeConfig({
      paymentMethods: ['bitcoin-lightning-bolt11', 'bitcoin-cashu'],
    })
    const event = buildAnnounceEvent(config.secretKey, config)

    const pmiTags = event.tags.filter(t => t[0] === 'pmi')
    expect(pmiTags).toHaveLength(2)
    expect(pmiTags[0]).toEqual(['pmi', 'bitcoin-lightning-bolt11'])
    expect(pmiTags[1]).toEqual(['pmi', 'bitcoin-cashu'])
  })

  it('sets content with capabilities when provided', () => {
    const config = makeConfig({
      capabilities: [
        { name: 'get_joke', description: 'Returns a random joke' },
        { name: 'get_roast', description: 'Returns a roast' },
      ],
      version: '1.2.0',
    })
    const event = buildAnnounceEvent(config.secretKey, config)

    const content = JSON.parse(event.content)
    expect(content.capabilities).toEqual([
      { name: 'get_joke', description: 'Returns a random joke' },
      { name: 'get_roast', description: 'Returns a roast' },
    ])
    expect(content.version).toBe('1.2.0')
  })

  it('sets empty content ({}) when no capabilities', () => {
    const config = makeConfig()
    const event = buildAnnounceEvent(config.secretKey, config)

    expect(event.content).toBe('{}')
  })

  it('is a valid signed Nostr event (id is 64-char hex, sig is 128-char hex)', () => {
    const config = makeConfig()
    const event = buildAnnounceEvent(config.secretKey, config)

    expect(event.id).toMatch(/^[0-9a-f]{64}$/)
    expect(event.sig).toMatch(/^[0-9a-f]{128}$/)
    expect(event.pubkey).toMatch(/^[0-9a-f]{64}$/)
    expect(event.created_at).toBeGreaterThan(0)
  })

  it('rejects invalid secret key', () => {
    const baseConfig = makeConfig()
    expect(() => buildAnnounceEvent('not-hex', baseConfig)).toThrow('64-character hex')
    expect(() => buildAnnounceEvent('ab'.repeat(16), baseConfig)).toThrow('64-character hex')
  })

  describe('url validation (M1)', () => {
    it('accepts http:// and https:// urls', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'https://example.com' }))).not.toThrow()
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'http://example.com' }))).not.toThrow()
    })

    it('rejects javascript: url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'javascript:alert(1)' }))).toThrow('config.url must start with http')
    })

    it('rejects empty string url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: '' }))).toThrow('config.url must start with http')
    })

    it('rejects ftp:// url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'ftp://example.com' }))).toThrow('config.url must start with http')
    })
  })

  describe('picture validation (M1)', () => {
    it('accepts https:// picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'https://example.com/icon.png' }))).not.toThrow()
    })

    it('accepts http:// picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'http://example.com/icon.png' }))).not.toThrow()
    })

    it('rejects javascript: picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'javascript:alert(1)' }))).toThrow('config.picture must start with http')
    })

    it('rejects empty string picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: '' }))).toThrow('config.picture must start with http')
    })

    it('accepts undefined picture (no picture provided)', () => {
      const config = makeConfig()
      delete (config as any).picture
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), config)).not.toThrow()
    })
  })

  describe('url SSRF prevention', () => {
    const privateUrls = [
      'https://localhost/api',
      'https://127.0.0.1/api',
      'https://10.0.0.1/api',
      'https://192.168.1.1/api',
      'https://172.16.0.1/api',
      'https://169.254.169.254/latest/meta-data/',
      'https://100.64.0.1/api',
      'https://[::1]/api',
    ]

    for (const url of privateUrls) {
      it(`rejects private url: ${url}`, () => {
        expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url }))).toThrow('private/loopback')
      })
    }

    it('accepts public url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'https://api.example.com' }))).not.toThrow()
    })
  })

  describe('picture SSRF prevention', () => {
    it('rejects private picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'https://192.168.1.1/icon.png' }))).toThrow('private/loopback')
    })

    it('rejects CGNAT picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'https://100.100.0.1/icon.png' }))).toThrow('private/loopback')
    })

    it('accepts public picture url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'https://cdn.example.com/icon.png' }))).not.toThrow()
    })
  })

  describe('name and about length validation', () => {
    it('rejects name longer than 256 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ name: 'a'.repeat(257) }))).toThrow('must not exceed 256')
    })

    it('accepts name exactly 256 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ name: 'a'.repeat(256) }))).not.toThrow()
    })

    it('rejects about longer than 4096 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: 'a'.repeat(4097) }))).toThrow('must not exceed 4096')
    })

    it('accepts about exactly 4096 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: 'a'.repeat(4096) }))).not.toThrow()
    })
  })

  describe('topics validation', () => {
    it('rejects more than 50 topics', () => {
      const topics = Array.from({ length: 51 }, (_, i) => `topic-${i}`)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ topics }))).toThrow('must not exceed 50')
    })

    it('rejects topic longer than 64 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ topics: ['a'.repeat(65)] }))).toThrow('must not exceed 64')
    })

    it('accepts 50 topics with valid lengths', () => {
      const topics = Array.from({ length: 50 }, (_, i) => `topic-${i}`)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ topics }))).not.toThrow()
    })
  })

  describe('identifier validation (M2)', () => {
    it('rejects empty identifier', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: '' }))).toThrow('must not be empty')
    })

    it('rejects whitespace-only identifier', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: '   ' }))).toThrow('must not be empty')
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: '\t\n' }))).toThrow('must not be empty')
    })

    it('rejects identifier longer than 256 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: 'a'.repeat(257) }))).toThrow('must not exceed 256 characters')
    })

    it('accepts identifier exactly 256 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: 'a'.repeat(256) }))).not.toThrow()
    })

    it('accepts a normal identifier', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: 'jokes-api-v2' }))).not.toThrow()
    })
  })

  describe('price validation (M3)', () => {
    it('rejects NaN price', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: NaN, currency: 'sats' }] }))).toThrow('finite non-negative number')
    })

    it('rejects Infinity price', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: Infinity, currency: 'sats' }] }))).toThrow('finite non-negative number')
    })

    it('rejects negative price', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: -1, currency: 'sats' }] }))).toThrow('finite non-negative number')
    })

    it('accepts price of zero', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: 0, currency: 'sats' }] }))).not.toThrow()
    })

    it('accepts positive price', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: 100, currency: 'sats' }] }))).not.toThrow()
    })
  })

  describe('capability schemas', () => {
    it('includes schema and outputSchema in content when provided', () => {
      const inputSchema = { type: 'object', properties: { count: { type: 'number' } } }
      const outputSchema = { type: 'object', properties: { joke: { type: 'string' } } }
      const config = makeConfig({
        capabilities: [
          {
            name: 'get_joke',
            description: 'Returns a random joke',
            schema: inputSchema,
            outputSchema,
          },
        ],
      })
      const event = buildAnnounceEvent(config.secretKey, config)

      const content = JSON.parse(event.content)
      expect(content.capabilities[0].schema).toEqual(inputSchema)
      expect(content.capabilities[0].outputSchema).toEqual(outputSchema)
    })

    it('omits schema fields from content when not provided', () => {
      const config = makeConfig({
        capabilities: [{ name: 'get_joke', description: 'Returns a random joke' }],
      })
      const event = buildAnnounceEvent(config.secretKey, config)

      const content = JSON.parse(event.content)
      expect(content.capabilities[0]).toEqual({ name: 'get_joke', description: 'Returns a random joke' })
      expect(content.capabilities[0].schema).toBeUndefined()
      expect(content.capabilities[0].outputSchema).toBeUndefined()
    })

    it('supports capabilities with mixed schema presence', () => {
      const inputSchema = { type: 'object' }
      const config = makeConfig({
        capabilities: [
          { name: 'get_joke', description: 'Returns a random joke', schema: inputSchema },
          { name: 'get_roast', description: 'Returns a roast' },
        ],
      })
      const event = buildAnnounceEvent(config.secretKey, config)

      const content = JSON.parse(event.content)
      expect(content.capabilities[0].schema).toEqual(inputSchema)
      expect(content.capabilities[0].outputSchema).toBeUndefined()
      expect(content.capabilities[1].schema).toBeUndefined()
      expect(content.capabilities[1].outputSchema).toBeUndefined()
    })
  })

  describe('content size limit', () => {
    it('rejects content exceeding 64 KiB', () => {
      const hugeSchema = { data: 'x'.repeat(70_000) }
      const config = makeConfig({
        capabilities: [{ name: 'big', description: 'big', schema: hugeSchema }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).toThrow('maximum size')
    })

    it('accepts content under 64 KiB', () => {
      const config = makeConfig({
        capabilities: [{ name: 'small', description: 'small', schema: { type: 'object' } }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).not.toThrow()
    })

    it('rejects multibyte content that exceeds 64 KiB in UTF-8 bytes', () => {
      // 30k € characters = ~30k JS string length but ~90 KiB in UTF-8
      const hugeSchema = { data: '\u20AC'.repeat(30_000) }
      const config = makeConfig({
        capabilities: [{ name: 'big', description: 'big', schema: hugeSchema }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).toThrow('maximum size')
    })
  })
})

describe('hexToBytes', () => {
  it('converts valid hex to bytes', () => {
    const bytes = hexToBytes('deadbeef')
    expect(bytes).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('rejects odd-length hex string', () => {
    expect(() => hexToBytes('abc')).toThrow('even-length hex string')
  })

  it('rejects non-hex characters', () => {
    expect(() => hexToBytes('gggg')).toThrow('even-length hex string')
  })

  it('accepts empty string', () => {
    expect(hexToBytes('')).toEqual(new Uint8Array([]))
  })
})
