/**
 * app.js — Live discovery dashboard for kind 31402 Nostr events
 *
 * Connects to multiple Nostr relays, subscribes to kind 31402 service
 * announcements, and renders them in a filterable grid.
 *
 * XSS safety: ALL strings from Nostr events are passed through escapeHtml()
 * before being inserted via innerHTML. escapeHtml() uses the browser's own
 * DOM text-node escaping (div.textContent = ...; return div.innerHTML) which
 * is the safest approach available without a library — no regex, no allow-list.
 */

/* ============================================================
   Constants
   ============================================================ */

const L402_KIND = 31402

const DEFAULT_RELAYS = [
  'wss://relay.trotters.cc',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
]

/** localStorage key for user-added relay URLs */
const STORAGE_KEY = 'l402-dashboard-relays'

/** Maximum reconnect backoff in milliseconds (30 s) */
const RECONNECT_MAX = 30_000

/* ============================================================
   Relay Manager
   ============================================================ */

/**
 * Per-relay state:
 *   url        {string}   WebSocket URL
 *   ws         {WebSocket|null}
 *   status     {'connecting'|'connected'|'disconnected'}
 *   backoff    {number}   Current reconnect delay in ms
 */
const relays = new Map()

/** Returns the merged list of default + user-supplied relay URLs. */
function getRelayUrls() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (Array.isArray(stored) && stored.length > 0) {
      return [...new Set([...DEFAULT_RELAYS, ...stored])]
    }
  } catch {
    // Ignore parse errors — fall through to defaults
  }
  return [...DEFAULT_RELAYS]
}

/**
 * Opens (or reopens) a WebSocket connection to a relay URL.
 * On success, sends a REQ for all kind 31402 events.
 * On close, schedules an exponential-backoff reconnect.
 *
 * @param {string} url - WebSocket relay URL
 */
function connectToRelay(url) {
  const existing = relays.get(url)
  const state = existing || { url, ws: null, status: 'disconnected', backoff: 1000 }
  if (!existing) relays.set(url, state)

  state.status = 'connecting'
  renderRelayStatus()

  try {
    const ws = new WebSocket(url)
    state.ws = ws

    ws.onopen = () => {
      state.status = 'connected'
      state.backoff = 1000 // Reset backoff on successful connect
      renderRelayStatus()

      // Subscribe to all kind 31402 events (past + future)
      const subId = 'l402-' + Math.random().toString(36).slice(2, 8)
      ws.send(JSON.stringify(['REQ', subId, { kinds: [L402_KIND] }]))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg[0] === 'EVENT' && msg[2]) {
          handleEvent(msg[2])
        } else if (msg[0] === 'EOSE') {
          handleEose(url)
        } else if (msg[0] === 'NOTICE') {
          console.log('[' + url + '] NOTICE:', msg[1])
        }
      } catch {
        // Silently discard malformed relay messages
      }
    }

    ws.onclose = () => {
      state.status = 'disconnected'
      state.ws = null
      renderRelayStatus()
      // Schedule reconnect with capped exponential backoff
      setTimeout(() => connectToRelay(url), state.backoff)
      state.backoff = Math.min(state.backoff * 2, RECONNECT_MAX)
    }

    ws.onerror = () => {
      // onclose always fires after onerror — backoff is handled there
    }
  } catch {
    // WebSocket constructor can throw for invalid URLs
    state.status = 'disconnected'
    renderRelayStatus()
    setTimeout(() => connectToRelay(url), state.backoff)
    state.backoff = Math.min(state.backoff * 2, RECONNECT_MAX)
  }
}

/** Opens connections to all configured relay URLs. */
function connectAll() {
  getRelayUrls().forEach(connectToRelay)
}

/* ============================================================
   Event Store
   ============================================================ */

/**
 * De-duplicated service map.
 * Key: `${pubkey}:${dTag}` — one entry per (publisher, identifier) pair.
 * Value: parsed service object (see handleEvent).
 */
const services = new Map()

/** Number of relays that have sent EOSE — used to hide the loading indicator. */
let eoseCount = 0

/**
 * Processes a raw Nostr event. Validates it is a kind 31402 event with
 * all required tags, checks NIP-40 expiration, de-duplicates by
 * (pubkey, d-tag), and upserts the service store.
 *
 * @param {object} event - Raw Nostr event object
 */
function handleEvent(event) {
  if (event.kind !== L402_KIND) return

  const tags = event.tags || []

  /** Returns the first value of a named tag, or undefined. */
  const getTag = (name) => tags.find(t => t[0] === name)?.[1]

  /** Returns all tags with a given name. */
  const getTags = (name) => tags.filter(t => t[0] === name)

  const dTag = getTag('d')
  const name = getTag('name')
  const url = getTag('url')
  const about = getTag('about')

  // Require all four mandatory fields
  if (!dTag || !name || !url || !about) return

  // Skip localhost/private URLs — these are misconfigured announcements
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '0.0.0.0') return
  } catch { return }

  // NIP-40: honour event expiration
  const expiration = getTag('expiration')
  if (expiration && parseInt(expiration, 10) < Math.floor(Date.now() / 1000)) return

  // Deduplicate: keep the most recently created version
  const key = event.pubkey + ':' + dTag
  const existing = services.get(key)
  if (existing && existing.createdAt >= event.created_at) return

  // Parse pricing tags: ['price', capability, amount, currency]
  const pricing = getTags('price').map(t => ({
    capability: t[1] || '',
    price: parseFloat(t[2]) || 0,
    currency: t[3] || 'sats',
  }))

  // Parse payment method identifiers (pmi tags)
  const paymentMethods = getTags('pmi').map(t => t[1]).filter(Boolean)

  // Parse topic tags
  const topics = getTags('t').map(t => t[1]).filter(Boolean)

  // Optionally parse JSON content for capabilities + version
  let capabilities, version
  try {
    if (event.content) {
      const content = JSON.parse(event.content)
      capabilities = content.capabilities
      version = content.version
    }
  } catch {
    // Content is optional — ignore parse failures
  }

  services.set(key, {
    id: event.id,
    pubkey: event.pubkey,
    identifier: dTag,
    name,
    url,
    about,
    picture: getTag('picture'),
    pricing,
    paymentMethods,
    topics,
    capabilities,
    version,
    createdAt: event.created_at,
    source: 'nostr',
  })

  renderServices()
}

/**
 * Called when a relay sends EOSE (End of Stored Events).
 * Hides the loading indicator after the first relay responds.
 *
 * @param {string} url - The relay that sent EOSE
 */
function handleEose(url) {
  eoseCount++
  const loading = document.getElementById('loading')
  if (loading) loading.hidden = true
  renderServices()
}

/* ============================================================
   UI Renderer
   ============================================================ */

// Current filter state
let searchQuery = ''
let activePaymentFilters = new Set()
let activeTopicFilters = new Set()

/**
 * Rebuilds the relay status row in the header.
 * Each relay gets a coloured dot + text label (colour-blind safe).
 * All relay URLs (including user-added ones from localStorage) are escaped.
 */
function renderRelayStatus() {
  const container = document.getElementById('relay-status')
  if (!container) return

  const relayList = [...relays.values()]
  const connected = relayList.filter(r => r.status === 'connected').length

  document.getElementById('relay-count').textContent =
    connected + ' relay' + (connected !== 1 ? 's' : '')

  // Build each relay indicator using safe DOM construction
  // (not innerHTML) since relay URLs may come from localStorage
  container.textContent = ''

  relayList.forEach(r => {
    let colour, label
    switch (r.status) {
      case 'connected':  colour = '#22c55e'; label = 'Connected';    break
      case 'connecting': colour = '#f59e0b'; label = 'Connecting';   break
      default:           colour = '#ef4444'; label = 'Disconnected'; break
    }

    let host
    try {
      host = new URL(r.url).hostname
    } catch {
      host = r.url
    }

    const wrapper = document.createElement('span')
    wrapper.className = 'relay-dot'
    wrapper.title = r.url + ' — ' + label
    wrapper.style.setProperty('--dot-colour', colour)

    const dot = document.createElement('span')
    dot.className = 'dot'
    dot.setAttribute('aria-hidden', 'true')

    const labelEl = document.createElement('span')
    labelEl.className = 'relay-label'
    labelEl.textContent = host + ' (' + label + ')'

    wrapper.appendChild(dot)
    wrapper.appendChild(labelEl)
    container.appendChild(wrapper)
  })
}

/**
 * Applies current filters to the service store, sorts by recency,
 * and re-renders the services grid and filter pills.
 */
function renderServices() {
  const grid = document.getElementById('services-grid')
  const emptyState = document.getElementById('empty-state')
  const allServices = [...services.values()]

  // Rebuild filter pills based on all available services
  renderFilterPills(allServices)

  // Apply search query
  let filtered = allServices
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.about.toLowerCase().includes(q) ||
      s.topics.some(t => t.toLowerCase().includes(q))
    )
  }

  // Apply payment method filters (AND logic — must have all selected)
  if (activePaymentFilters.size > 0) {
    filtered = filtered.filter(s =>
      [...activePaymentFilters].every(f => s.paymentMethods.includes(f))
    )
  }

  // Apply topic filters (AND logic)
  if (activeTopicFilters.size > 0) {
    filtered = filtered.filter(s =>
      [...activeTopicFilters].every(f => s.topics.includes(f))
    )
  }

  // Sort by most recently announced first
  filtered.sort((a, b) => b.createdAt - a.createdAt)

  // Update service count in header
  const nostrCount = allServices.filter(s => s.source === 'nostr').length
  const indexedCount = allServices.length - nostrCount
  const parts = []
  if (nostrCount > 0) parts.push(nostrCount + ' self-announced')
  if (indexedCount > 0) parts.push(indexedCount + ' indexed')
  document.getElementById('service-count').textContent =
    allServices.length + ' service' + (allServices.length !== 1 ? 's' : '') +
    (parts.length > 0 ? ' (' + parts.join(', ') + ')' : '')

  // Show empty state if filters produced no results but services exist
  if (filtered.length === 0 && allServices.length > 0) {
    grid.textContent = ''
    emptyState.hidden = false
    return
  }

  emptyState.hidden = true

  // Build cards via safe DOM fragment
  const fragment = document.createDocumentFragment()
  filtered.forEach(s => {
    fragment.appendChild(buildCard(s))
  })
  grid.textContent = ''
  grid.appendChild(fragment)

  // Attach clipboard handlers to "Copy" buttons
  grid.querySelectorAll('.copy-pubkey').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.pubkey).then(() => {
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = 'Copy' }, 1500)
      }).catch(() => {
        btn.textContent = 'Error'
        setTimeout(() => { btn.textContent = 'Copy' }, 1500)
      })
    })
  })
}

/**
 * Builds a service card as a DOM element tree.
 * All untrusted strings are set via .textContent — never innerHTML.
 *
 * @param {object} s - Parsed service object
 * @returns {HTMLElement} The constructed article element
 */
function buildCard(s) {
  const article = document.createElement('article')
  article.className = 'service-card'

  // --- Header ---
  const header = document.createElement('div')
  header.className = 'card-header'

  // Source badge
  const sourceBadge = document.createElement('span')
  sourceBadge.className = 'badge source source-' + (s.source === 'nostr' ? 'nostr' : 'indexed')
  sourceBadge.textContent = s.source === 'nostr' ? 'Self-announced' : 'Indexed via ' + s.source
  header.appendChild(sourceBadge)

  if (s.picture) {
    const img = document.createElement('img')
    img.src = s.picture           // URL — browser will not execute this
    img.alt = s.name + ' icon'    // .alt set as property, not attribute injection
    img.className = 'service-icon'
    img.width = 32
    img.height = 32
    header.appendChild(img)
  }

  const nameLink = document.createElement('a')
  nameLink.href = s.url           // URL — browser handles safely
  nameLink.target = '_blank'
  nameLink.rel = 'noopener noreferrer'
  nameLink.className = 'service-name'
  nameLink.textContent = s.name
  header.appendChild(nameLink)

  article.appendChild(header)

  // --- About ---
  const about = document.createElement('p')
  about.className = 'service-about'
  about.textContent = s.about
  article.appendChild(about)

  // --- Pricing table ---
  if (s.pricing.length > 0) {
    const table = document.createElement('table')
    table.className = 'pricing-table'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    const thCap = document.createElement('th')
    thCap.scope = 'col'
    thCap.textContent = 'Capability'
    const thPrice = document.createElement('th')
    thPrice.scope = 'col'
    thPrice.textContent = 'Price'
    headRow.appendChild(thCap)
    headRow.appendChild(thPrice)
    thead.appendChild(headRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    s.pricing.forEach(p => {
      const row = document.createElement('tr')
      const tdCap = document.createElement('td')
      tdCap.textContent = p.capability
      const tdPrice = document.createElement('td')
      tdPrice.textContent = p.price + ' ' + p.currency
      row.appendChild(tdCap)
      row.appendChild(tdPrice)
      tbody.appendChild(row)
    })
    table.appendChild(tbody)
    article.appendChild(table)
  }

  // --- Payment method badges ---
  if (s.paymentMethods.length > 0) {
    const badgesDiv = document.createElement('div')
    badgesDiv.className = 'badges'
    badgesDiv.setAttribute('aria-label', 'Payment methods')
    s.paymentMethods.forEach(m => {
      const badge = document.createElement('span')
      badge.className = 'badge payment'
      badge.textContent = formatPaymentMethod(m)
      badgesDiv.appendChild(badge)
    })
    article.appendChild(badgesDiv)
  }

  // --- Topic pills ---
  if (s.topics.length > 0) {
    const topicsDiv = document.createElement('div')
    topicsDiv.className = 'badges topics'
    topicsDiv.setAttribute('aria-label', 'Topics')
    s.topics.forEach(t => {
      const pill = document.createElement('span')
      pill.className = 'badge topic'
      pill.textContent = t
      topicsDiv.appendChild(pill)
    })
    article.appendChild(topicsDiv)
  }

  // --- Footer ---
  const footer = document.createElement('div')
  footer.className = 'card-footer'

  const pubkeySpan = document.createElement('span')
  pubkeySpan.className = 'pubkey'

  const code = document.createElement('code')
  code.title = s.pubkey
  code.textContent = s.pubkey.slice(0, 8) + '...' + s.pubkey.slice(-4)
  pubkeySpan.appendChild(code)

  const copyBtn = document.createElement('button')
  copyBtn.className = 'copy-pubkey'
  copyBtn.dataset.pubkey = s.pubkey
  copyBtn.setAttribute('aria-label', 'Copy full public key')
  copyBtn.textContent = 'Copy'
  pubkeySpan.appendChild(copyBtn)

  const timestampSpan = document.createElement('span')
  timestampSpan.className = 'timestamp'
  timestampSpan.title = new Date(s.createdAt * 1000).toISOString()
  timestampSpan.textContent = getTimeAgo(s.createdAt)

  footer.appendChild(pubkeySpan)
  footer.appendChild(timestampSpan)
  article.appendChild(footer)

  return article
}

/**
 * Rebuilds payment method and topic filter pill rows based on the
 * full set of available services (not the filtered subset).
 * Pills are built with DOM methods to avoid any injection risk from
 * payment method strings sourced from Nostr events.
 *
 * @param {Array} allServices - All parsed service objects
 */
function renderFilterPills(allServices) {
  const allPayments = [...new Set(allServices.flatMap(s => s.paymentMethods))].sort()
  const allTopics   = [...new Set(allServices.flatMap(s => s.topics))].sort()

  buildPillGroup(
    document.getElementById('payment-filters'),
    allPayments,
    activePaymentFilters,
    'payment',
    formatPaymentMethod
  )

  buildPillGroup(
    document.getElementById('topic-filters'),
    allTopics,
    activeTopicFilters,
    'topic',
    t => t
  )
}

/**
 * Replaces the contents of a pill container with buttons built via DOM methods.
 *
 * @param {HTMLElement} container
 * @param {string[]} values
 * @param {Set<string>} activeSet
 * @param {string} filterType   - 'payment' or 'topic'
 * @param {function} labelFn    - Maps a value to its display label
 */
function buildPillGroup(container, values, activeSet, filterType, labelFn) {
  container.textContent = ''
  if (values.length === 0) return

  values.forEach(value => {
    const btn = document.createElement('button')
    btn.className = 'pill' + (activeSet.has(value) ? ' active' : '')
    btn.dataset.filter = filterType
    btn.dataset.value = value
    btn.setAttribute('aria-pressed', String(activeSet.has(value)))
    btn.textContent = labelFn(value)
    container.appendChild(btn)
  })
}

/* ============================================================
   Utility Functions
   ============================================================ */

/**
 * Maps a payment method identifier to a short human-readable label.
 *
 * @param {string} m - Raw payment method string (e.g. 'bitcoin-lightning-bolt11')
 * @returns {string} Short label (e.g. 'Lightning')
 */
function formatPaymentMethod(m) {
  if (m.includes('lightning')) return 'Lightning'
  if (m.includes('cashu'))     return 'Cashu'
  if (m.includes('x402'))      return 'x402'
  return m
}

/**
 * Returns a human-friendly relative time string for a Unix timestamp.
 *
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} e.g. 'just now', '5m ago', '2h ago'
 */
function getTimeAgo(timestamp) {
  const seconds = Math.floor(Date.now() / 1000) - timestamp
  if (seconds < 60)     return 'just now'
  if (seconds < 3600)   return Math.floor(seconds / 60) + 'm ago'
  if (seconds < 86400)  return Math.floor(seconds / 3600) + 'h ago'
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago'
  return new Date(timestamp * 1000).toLocaleDateString()
}

/* ============================================================
   External Directory Sources
   ============================================================ */

/**
 * Fetches services from external L402 directories and merges them
 * into the service store. Each indexed service is marked with its
 * source so cards can display provenance badges.
 *
 * Nostr self-announced services always take precedence — if a service
 * exists in both Nostr and an external directory (matched by URL),
 * the Nostr version wins.
 */

const EXTERNAL_SOURCES = [
  // satring.com — disabled: CORS headers not set, browser fetch blocked.
  // Re-enable when they add Access-Control-Allow-Origin or use pre-seeded JSON.
  // { name: 'satring.com', url: 'https://satring.com/api/v1/services/bulk', parse: parseSatringServices },
  {
    name: 'l402.directory',
    url: 'https://l402.directory/api/services',
    parse: parseL402DirectoryServices,
  },
]

/**
 * Fetches all external sources in parallel. Failures are logged
 * but do not affect other sources or the Nostr subscription.
 */
async function fetchExternalSources() {
  await Promise.allSettled(
    EXTERNAL_SOURCES.map(async (src) => {
      try {
        const res = await fetch(src.url)
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const data = await res.json()
        const parsed = src.parse(data, src.name)
        let added = 0
        parsed.forEach(svc => {
          // Only add if no Nostr self-announced version exists for this URL
          const existingByUrl = [...services.values()].find(
            s => s.url === svc.url && s.source === 'nostr'
          )
          if (existingByUrl) return

          const key = 'ext:' + src.name + ':' + svc.identifier
          services.set(key, svc)
          added++
        })
        console.log(`[${src.name}] Indexed ${added} services (${parsed.length} total, ${parsed.length - added} skipped — already on Nostr)`)
      } catch (err) {
        console.warn(`[${src.name}] Fetch failed:`, err.message || err)
      }
    })
  )
  renderServices()
}

/**
 * Parses the satring.com bulk API response into service objects.
 * Response is an array of service objects with name, url, description,
 * category_ids, protocol, status, pricing, etc.
 *
 * @param {Array} data - Raw API response array
 * @param {string} sourceName - Source identifier for provenance
 * @returns {Array} Parsed service objects
 */
function parseSatringServices(data, sourceName) {
  const items = Array.isArray(data) ? data : []
  return items
    .filter(s => s.name && s.url && s.status !== 'dead')
    .map(s => ({
      id: 'satring-' + (s.slug || s.name),
      pubkey: '',
      identifier: s.slug || s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: s.name,
      url: s.url,
      about: s.description || '',
      picture: s.logo_url || undefined,
      pricing: (s.endpoints || [])
        .filter(e => e.pricing)
        .map(e => ({
          capability: e.method + ' ' + (e.url || '').split('?')[0],
          price: e.pricing?.amount || 0,
          currency: e.pricing?.currency || 'sats',
        }))
        .slice(0, 5),
      paymentMethods: s.protocol === 'X402'
        ? ['x402-stablecoin']
        : ['bitcoin-lightning-bolt11'],
      topics: (s.category_ids || []).map(String),
      capabilities: undefined,
      version: undefined,
      createdAt: s.listed_at ? Math.floor(new Date(s.listed_at).getTime() / 1000) : 0,
      source: sourceName,
    }))
}

/**
 * Parses the l402.directory API response into service objects.
 * Response is { services: [...], count: N }.
 *
 * @param {object} data - Raw API response
 * @param {string} sourceName - Source identifier for provenance
 * @returns {Array} Parsed service objects
 */
function parseL402DirectoryServices(data, sourceName) {
  const items = data?.services || []
  return items
    .filter(s => s.name)
    .map(s => {
      const endpoints = s.endpoints || []
      const firstUrl = endpoints[0]?.url || s.provider?.url || ''
      return {
        id: 'l402dir-' + (s.service_id || s.name),
        pubkey: s.destination_pubkey || '',
        identifier: (s.service_id || s.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: s.name,
        url: firstUrl,
        about: s.description || '',
        picture: undefined,
        pricing: endpoints
          .filter(e => e.pricing && e.pricing.amount > 0)
          .map(e => ({
            capability: (e.method || 'GET') + ' ' + (e.url || '').split('?')[0],
            price: e.pricing.amount,
            currency: e.pricing.currency || 'sats',
          }))
          .slice(0, 5),
        paymentMethods: ['bitcoin-lightning-bolt11'],
        topics: s.categories || [],
        capabilities: undefined,
        version: undefined,
        createdAt: s.listed_at ? Math.floor(new Date(s.listed_at).getTime() / 1000) : 0,
        source: sourceName,
      }
    })
}

/* ============================================================
   Event Listeners
   ============================================================ */

// Live search — re-render on every keystroke
document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim()
  renderServices()
})

// Delegated click handler for filter pills (payment + topic)
// Pills are matched by data-filter attribute, set during buildPillGroup.
document.addEventListener('click', (e) => {
  const pill = e.target.closest('[data-filter]')
  if (!pill) return

  const { filter, value } = pill.dataset
  const set = filter === 'payment' ? activePaymentFilters : activeTopicFilters

  if (set.has(value)) {
    set.delete(value)
  } else {
    set.add(value)
  }

  renderServices()
})

/* ============================================================
   Health Check — All Relays Down Banner
   ============================================================ */

/**
 * Periodically checks whether every relay is disconnected.
 * If so, and no services have been loaded yet, shows an error banner.
 */
function checkAllDown() {
  const allDown = [...relays.values()].every(r => r.status === 'disconnected')
  const loading = document.getElementById('loading')
  if (!loading) return

  if (allDown && services.size === 0) {
    loading.hidden = false
    loading.textContent = 'Unable to connect to any relays. Check your connection or try again later.'
    loading.classList.add('error')
  }
}

setInterval(checkAllDown, 5000)

/* ============================================================
   Initialise
   ============================================================ */

connectAll()
fetchExternalSources()
