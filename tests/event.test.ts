import { describe, it, expect } from 'vitest'
import { generateSecretKey } from 'nostr-tools/pure'
import { buildAnnounceEvent } from '../src/event.js'
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
})
