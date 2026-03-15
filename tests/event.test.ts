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

  describe('url allows private hosts (no network I/O)', () => {
    it('accepts localhost url in buildAnnounceEvent', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'https://localhost:3000/api' }))).not.toThrow()
    })

    it('accepts private IP url in buildAnnounceEvent', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'https://192.168.1.1/api' }))).not.toThrow()
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

  describe('url and picture length limits', () => {
    it('rejects url longer than 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2030)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: longUrl }))).toThrow('must not exceed 2048')
    })

    it('accepts url exactly 2048 characters', () => {
      const url = 'https://example.com/' + 'a'.repeat(2028)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url }))).not.toThrow()
    })

    it('rejects picture longer than 2048 characters', () => {
      const longPic = 'https://example.com/' + 'a'.repeat(2030)
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ picture: longPic }))).toThrow('must not exceed 2048')
    })

    it('accepts uppercase HTTP:// url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'HTTP://example.com' }))).not.toThrow()
    })

    it('accepts uppercase HTTPS:// url', () => {
      expect(() => buildAnnounceEvent(makeSecretKeyHex(), makeConfig({ url: 'HTTPS://example.com' }))).not.toThrow()
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
