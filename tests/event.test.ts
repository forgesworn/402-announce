import { describe, it, expect, vi } from 'vitest'
import { generateSecretKey } from 'nostr-tools/pure'
import { buildAnnounceEvent } from '../src/event.js'
import * as utils from '../src/utils.js'
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
    urls: ['https://jokes.example.com'],
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

  describe('urls validation (M1)', () => {
    it('rejects empty urls array', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: [] }))).toThrow('config.urls must contain at least one entry')
    })

    it('rejects more than 10 urls', () => {
      const urls = Array.from({ length: 11 }, (_, i) => `https://example${i}.com`)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls }))).toThrow('config.urls must not exceed 10 entries')
    })

    it('rejects duplicate urls', () => {
      const urls = ['https://example.com', 'https://example.com']
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls }))).toThrow('config.urls must not contain duplicate entries')
    })

    it('rejects unparseable urls', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['not a url'] }))).toThrow('config.urls entry is not a valid URL')
    })

    it('rejects url longer than 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2030)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: [longUrl] }))).toThrow('config.urls entry must not exceed 2048 characters')
    })

    it('accepts multiple valid urls (clearnet, .onion, HNS)', () => {
      const urls = [
        'https://example.com',
        'http://exampleonion.onion/api',
        'https://example.hns',
      ]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls }))).not.toThrow()
    })

    it('accepts exotic schemes (hyper://)', () => {
      const urls = ['hyper://abc123.example']
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls }))).not.toThrow()
    })

    it('accepts url exactly 2048 characters', () => {
      const url = 'https://example.com/' + 'a'.repeat(2028)
      expect(url).toHaveLength(2048)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: [url] }))).not.toThrow()
    })

    it('accepts exactly 10 urls', () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://example${i}.com`)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls }))).not.toThrow()
    })

    it('emits one url tag per entry', () => {
      const urls = ['https://example.com', 'http://example2.com']
      const event = buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls }))
      const urlTags = event.tags.filter(t => t[0] === 'url')
      expect(urlTags).toHaveLength(2)
      expect(urlTags[0]).toEqual(['url', 'https://example.com'])
      expect(urlTags[1]).toEqual(['url', 'http://example2.com'])
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

  describe('urls allow private hosts (no network I/O)', () => {
    it('accepts localhost url in buildAnnounceEvent', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['https://localhost:3000/api'] }))).not.toThrow()
    })

    it('accepts private IP url in buildAnnounceEvent', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['https://192.168.1.1/api'] }))).not.toThrow()
    })

    it('accepts private picture url in buildAnnounceEvent', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'https://10.0.0.1/icon.png' }))).not.toThrow()
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

    it('rejects empty about', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: '' }))).toThrow('must not be empty')
    })

    it('rejects whitespace-only about', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: '   ' }))).toThrow('must not be empty')
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

  describe('paymentMethods validation', () => {
    it('rejects empty paymentMethods array', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: [] }))).toThrow('at least one entry')
    })

    it('rejects more than 20 paymentMethods', () => {
      const paymentMethods = Array.from({ length: 21 }, (_, i) => `method-${i}`)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods }))).toThrow('must not exceed 20')
    })

    it('rejects empty string paymentMethod', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: [''] }))).toThrow('must not be empty')
    })

    it('rejects whitespace-only paymentMethod', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: ['  '] }))).toThrow('must not be empty')
    })

    it('rejects paymentMethod longer than 64 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: ['a'.repeat(65)] }))).toThrow('must not exceed 64')
    })

    it('accepts valid paymentMethods', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: ['bitcoin-lightning-bolt11', 'bitcoin-cashu'] }))).not.toThrow()
    })
  })

  describe('pricing capability and currency validation', () => {
    it('rejects empty capability', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: '', price: 1, currency: 'sats' }] }))).toThrow('capability must not be empty')
    })

    it('rejects whitespace-only capability', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: '  ', price: 1, currency: 'sats' }] }))).toThrow('capability must not be empty')
    })

    it('rejects capability longer than 64 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'a'.repeat(65), price: 1, currency: 'sats' }] }))).toThrow('capability must not exceed 64')
    })

    it('rejects empty currency', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: 1, currency: '' }] }))).toThrow('currency must not be empty')
    })

    it('rejects whitespace-only currency', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: 1, currency: '  ' }] }))).toThrow('currency must not be empty')
    })

    it('rejects currency longer than 32 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [{ capability: 'x', price: 1, currency: 'a'.repeat(33) }] }))).toThrow('currency must not exceed 32')
    })

    it('rejects empty pricing array', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: [] }))).toThrow('at least one entry')
    })

    it('rejects more than 100 pricing entries', () => {
      const pricing = Array.from({ length: 101 }, (_, i) => ({ capability: `cap-${i}`, price: 1, currency: 'sats' }))
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing }))).toThrow('must not exceed 100')
    })
  })

  describe('name validation', () => {
    it('rejects empty name', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ name: '' }))).toThrow('must not be empty')
    })

    it('rejects whitespace-only name', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ name: '   ' }))).toThrow('must not be empty')
    })
  })

  describe('version validation', () => {
    it('rejects version longer than 64 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ version: 'a'.repeat(65) }))).toThrow('must not exceed 64')
    })

    it('accepts version exactly 64 characters', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ version: 'a'.repeat(64) }))).not.toThrow()
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

  describe('capability endpoint', () => {
    it('includes endpoint in content when provided', () => {
      const config = makeConfig({
        capabilities: [{ name: 'get_joke', description: 'Returns a joke', endpoint: '/api/joke' }],
      })
      const event = buildAnnounceEvent(config.secretKey, config)
      const content = JSON.parse(event.content)
      expect(content.capabilities[0].endpoint).toBe('/api/joke')
    })

    it('omits endpoint from content when not provided', () => {
      const config = makeConfig({
        capabilities: [{ name: 'get_joke', description: 'Returns a joke' }],
      })
      const event = buildAnnounceEvent(config.secretKey, config)
      const content = JSON.parse(event.content)
      expect(content.capabilities[0].endpoint).toBeUndefined()
    })

    it('rejects endpoint longer than 2048 characters', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: '/' + 'a'.repeat(2048) }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('must not exceed 2048')
    })

    it('rejects endpoint that does not start with / or http:// or https://', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: 'ftp://example.com/api' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('must start with /, http://, or https://')
    })

    it('accepts relative path endpoint', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: '/api/joke' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).not.toThrow()
    })

    it('accepts full URL endpoint', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: 'https://api.example.com/v1/chat' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).not.toThrow()
    })
  })

  describe('key zeroing', () => {
    it('zeroes the secret key bytes after signing', () => {
      let captured: Uint8Array | undefined
      const orig = utils.hexToBytes
      vi.spyOn(utils, 'hexToBytes').mockImplementation((hex: string) => {
        captured = orig(hex)
        return captured
      })
      buildAnnounceEvent(makeSecretKeyHex(), makeConfig())
      vi.restoreAllMocks()
      expect(captured).toBeDefined()
      expect(captured!.every(b => b === 0)).toBe(true)
    })

    it('zeroes the secret key bytes even when event construction throws', () => {
      let captured: Uint8Array | undefined
      const orig = utils.hexToBytes
      vi.spyOn(utils, 'hexToBytes').mockImplementation((hex: string) => {
        captured = orig(hex)
        return captured
      })
      // Trigger a throw after hexToBytes by using content that exceeds 64 KiB
      const hugeSchema = { data: 'x'.repeat(70_000) }
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({
        capabilities: [{ name: 'big', description: 'big', schema: hugeSchema }],
      }))).toThrow('maximum size')
      vi.restoreAllMocks()
      expect(captured).toBeDefined()
      expect(captured!.every(b => b === 0)).toBe(true)
    })
  })

  describe('picture length limit', () => {
    it('rejects picture longer than 2048 characters', () => {
      const longPic = 'https://example.com/' + 'a'.repeat(2030)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: longPic }))).toThrow('must not exceed 2048')
    })

    it('accepts uppercase HTTP:// picture', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'HTTP://example.com/img.png' }))).not.toThrow()
    })

    it('accepts uppercase HTTPS:// picture', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'HTTPS://example.com/img.png' }))).not.toThrow()
    })
  })

  describe('price precision', () => {
    it('accepts fractional price (e.g. 0.99 USD)', () => {
      const pricing = [{ capability: 'x', price: 0.99, currency: 'usd' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing }))).not.toThrow()
    })

    it('accepts price above MAX_SAFE_INTEGER (e.g. 1e18 wei)', () => {
      const pricing = [{ capability: 'x', price: 1e18, currency: 'wei' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing }))).not.toThrow()
    })
  })

  describe('capabilities validation', () => {
    it('rejects more than 100 capabilities', () => {
      const capabilities = Array.from({ length: 101 }, (_, i) => ({
        name: `cap-${i}`,
        description: 'desc',
      }))
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('must not exceed 100')
    })

    it('rejects capability with empty name', () => {
      const capabilities = [{ name: '', description: 'desc' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('name must not be empty')
    })

    it('rejects capability name longer than 128 characters', () => {
      const capabilities = [{ name: 'a'.repeat(129), description: 'desc' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('name must not exceed 128')
    })

    it('rejects capability description longer than 4096 characters', () => {
      const capabilities = [{ name: 'x', description: 'a'.repeat(4097) }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('description must not exceed 4096')
    })
  })

  describe('circular reference in schema', () => {
    it('rejects schema with circular reference (caught by depth check)', () => {
      const circular: Record<string, unknown> = { name: 'test' }
      circular.self = circular
      const capabilities = [{ name: 'x', description: 'desc', schema: circular }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('nesting exceeds maximum depth')
    })

    it('zeroes key bytes even when schema has circular reference', () => {
      let captured: Uint8Array | undefined
      const orig = utils.hexToBytes
      vi.spyOn(utils, 'hexToBytes').mockImplementation((hex: string) => {
        captured = orig(hex)
        return captured
      })
      const circular: Record<string, unknown> = { name: 'test' }
      circular.self = circular
      const capabilities = [{ name: 'x', description: 'desc', schema: circular }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('nesting exceeds maximum depth')
      vi.restoreAllMocks()
      expect(captured).toBeDefined()
      expect(captured!.every(b => b === 0)).toBe(true)
    })
  })

  describe('dangerous scheme in capability endpoint', () => {
    it('rejects javascript: endpoint', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: 'javascript:alert(1)' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('must start with /')
    })

    it('rejects data: endpoint', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: 'data:text/html,<h1>hi</h1>' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('must start with /')
    })

    it('rejects file: endpoint', () => {
      const capabilities = [{ name: 'x', description: 'desc', endpoint: 'file:///etc/passwd' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('must start with /')
    })
  })

  describe('runtime type guards', () => {
    it('rejects non-string secretKey', () => {
      expect(() => buildAnnounceEvent(123 as any, makeConfig())).toThrow('64-character hex')
    })

    it('rejects null config', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), null as any)).toThrow('config must be an object')
    })

    it('rejects non-array urls', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: 'https://example.com' as any }))).toThrow('config.urls must be an array')
    })

    it('rejects non-string identifier', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: 42 as any }))).toThrow('config.identifier must be a string')
    })

    it('rejects non-string name', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ name: 42 as any }))).toThrow('config.name must be a string')
    })

    it('rejects non-string about', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: null as any }))).toThrow('config.about must be a string')
    })

    it('rejects non-array pricing', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ pricing: 'bad' as any }))).toThrow('config.pricing must be an array')
    })

    it('rejects non-array paymentMethods', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: 'bolt11' as any }))).toThrow('config.paymentMethods must be an array')
    })
  })

  describe('dangerous URL schemes in urls', () => {
    it('rejects data: URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['data:text/html,<h1>hi</h1>'] }))).toThrow('disallowed scheme')
    })

    it('rejects file: URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['file:///etc/passwd'] }))).toThrow('disallowed scheme')
    })

    it('rejects blob: URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['blob:http://example.com/uuid'] }))).toThrow('disallowed scheme')
    })

    it('rejects javascript: URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['javascript:alert(1)'] }))).toThrow(/disallowed scheme|not a valid URL/)
    })

    it('rejects vbscript: URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['vbscript:msgbox'] }))).toThrow(/disallowed scheme|not a valid URL/)
    })

    it('still accepts http:// and https:// URLs', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['https://example.com'] }))).not.toThrow()
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['http://example.com'] }))).not.toThrow()
    })

    it('still accepts exotic transport schemes (hyper://)', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['hyper://abc123.example'] }))).not.toThrow()
    })
  })

  describe('topics empty/whitespace validation', () => {
    it('rejects empty string topic', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ topics: [''] }))).toThrow('must not be empty')
    })

    it('rejects whitespace-only topic', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ topics: ['  '] }))).toThrow('must not be empty')
    })
  })

  describe('version empty/whitespace validation', () => {
    it('rejects empty string version', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ version: '' }))).toThrow('non-empty string')
    })

    it('rejects whitespace-only version', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ version: '   ' }))).toThrow('non-empty string')
    })

    it('accepts undefined version (optional)', () => {
      const config = makeConfig()
      delete (config as any).version
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), config)).not.toThrow()
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

  describe('control character rejection', () => {
    it('rejects null byte in identifier', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ identifier: 'test\x00id' }))).toThrow('control characters')
    })

    it('rejects null byte in name', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ name: 'Test\x00Name' }))).toThrow('control characters')
    })

    it('rejects null byte in about', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: 'About\x00text' }))).toThrow('control characters')
    })

    it('rejects control chars in topics', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ topics: ['valid', 'bad\x01topic'] }))).toThrow('control characters')
    })

    it('rejects control chars in paymentMethods', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ paymentMethods: ['method\x7f'] }))).toThrow('control characters')
    })

    it('rejects control chars in pricing capability', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({
        pricing: [{ capability: 'cap\x02', price: 1, currency: 'sats' }],
      }))).toThrow('control characters')
    })

    it('rejects control chars in pricing currency', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({
        pricing: [{ capability: 'cap', price: 1, currency: 'sa\x03ts' }],
      }))).toThrow('control characters')
    })

    it('allows tabs and newlines in about (display-safe whitespace)', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ about: 'Line one\nLine two\ttabbed' }))).not.toThrow()
    })

    it('rejects control chars in version', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ version: '1.0\x00.0' }))).toThrow('control characters')
    })

    it('rejects control chars in capabilities name', () => {
      const capabilities = [{ name: 'cap\x01name', description: 'desc' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('control characters')
    })

    it('rejects control chars in capabilities description', () => {
      const capabilities = [{ name: 'cap', description: 'desc\x7f' }]
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ capabilities }))).toThrow('control characters')
    })

    it('rejects control chars in service URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ urls: ['https://example.com/\x00api'] }))).toThrow('control characters')
    })

    it('rejects control chars in picture URL', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: 'https://example.com/\x7fimg.png' }))).toThrow('control characters')
    })

    it('allows normal Unicode in all fields', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({
        identifier: 'cafe-\u00E9',
        name: 'Caf\u00E9 API',
        about: 'Serves \u2615 and \u{1F370}',
        topics: ['\u00E9spresso'],
      }))).not.toThrow()
    })
  })

  describe('schema depth limit', () => {
    it('rejects deeply nested schema (>20 levels)', () => {
      let nested: Record<string, unknown> = { value: 'leaf' }
      for (let i = 0; i < 25; i++) {
        nested = { child: nested }
      }
      const config = makeConfig({
        capabilities: [{ name: 'deep', description: 'desc', schema: nested }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).toThrow('nesting exceeds maximum depth')
    })

    it('rejects pure self-referential schema without stack overflow', () => {
      const selfRef: Record<string, unknown> = {}
      selfRef.self = selfRef
      const config = makeConfig({
        capabilities: [{ name: 'loop', description: 'desc', schema: selfRef }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).toThrow('nesting exceeds maximum depth')
    })

    it('accepts schema at exactly 20 levels', () => {
      let nested: Record<string, unknown> = { value: 'leaf' }
      // capabilities → [0] → schema → 17 more levels = 20 total depth from contentObj
      for (let i = 0; i < 15; i++) {
        nested = { child: nested }
      }
      const config = makeConfig({
        capabilities: [{ name: 'ok', description: 'desc', schema: nested }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).not.toThrow()
    })

    it('zeroes key bytes when depth check fails', () => {
      let captured: Uint8Array | undefined
      const orig = utils.hexToBytes
      vi.spyOn(utils, 'hexToBytes').mockImplementation((hex: string) => {
        captured = orig(hex)
        return captured
      })
      let nested: Record<string, unknown> = { value: 'leaf' }
      for (let i = 0; i < 25; i++) {
        nested = { child: nested }
      }
      const config = makeConfig({
        capabilities: [{ name: 'deep', description: 'desc', schema: nested }],
      })
      expect(() => buildAnnounceEvent(config.secretKey, config)).toThrow('nesting exceeds maximum depth')
      vi.restoreAllMocks()
      expect(captured).toBeDefined()
      expect(captured!.every(b => b === 0)).toBe(true)
    })
  })

  describe('key zeroing when finalizeEvent throws', () => {
    it('zeroes key bytes even when finalizeEvent throws', async () => {
      // Mock finalizeEvent at the module level before importing event.ts
      vi.doMock('nostr-tools/pure', () => ({
        finalizeEvent: () => { throw new Error('signing failed') },
      }))
      vi.resetModules()

      // Re-import utils to spy on hexToBytes in the fresh module graph
      const freshUtils = await import('../src/utils.js')
      let captured: Uint8Array | undefined
      const orig = freshUtils.hexToBytes
      vi.spyOn(freshUtils, 'hexToBytes').mockImplementation((hex: string) => {
        captured = orig(hex)
        return captured
      })

      const eventModule = await import('../src/event.js')
      expect(() => eventModule.buildAnnounceEvent(makeSecretKeyHex(), makeConfig())).toThrow('signing failed')

      expect(captured).toBeDefined()
      expect(captured!.every(b => b === 0)).toBe(true)

      vi.restoreAllMocks()
      vi.doUnmock('nostr-tools/pure')
      vi.resetModules()
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
