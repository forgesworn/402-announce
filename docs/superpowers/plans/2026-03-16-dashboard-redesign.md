# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the discover.trotters.dev dashboard with a hero section (trust badges + CTAs), a dual-audience section ("For Developers" / "For AI Agents"), and action buttons on service cards.

**Architecture:** Static vanilla HTML/CSS/JS. All changes are in three files: `docs/index.html` (structure), `docs/style.css` (styling), `docs/app.js` (interactivity). No build step, no dependencies. The dual-audience section is static HTML. The service card action buttons are added in the existing `buildCard()` function. Tab switching and smooth scroll are vanilla JS event handlers.

**Tech Stack:** HTML5, CSS3 (custom properties, flexbox, grid), vanilla JavaScript (DOM API, Clipboard API)

**Spec:** `docs/superpowers/specs/2026-03-16-dashboard-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/index.html` | Modify (lines 12-21) | Hero restructure: trust badges, CTAs, reorder stats/relay below CTAs |
| `docs/index.html` | Modify (lines 23-29) | Insert dual-audience section before filters |
| `docs/style.css` | Modify (lines 152-237) | Hero section styles: trust badges, CTA buttons |
| `docs/style.css` | Add (after line 237) | Dual-audience section styles |
| `docs/style.css` | Add (after line 732) | Card action buttons styles |
| `docs/style.css` | Modify (lines 932-936, 942-1010) | Responsive rules for new sections |
| `docs/app.js` | Modify (lines 558-582) | Insert action buttons row in `buildCard()` between meta and footer |
| `docs/app.js` | Modify (lines 838-852) | Add delegated handlers for tab toggle, smooth scroll CTAs, copy curl, visit API |

---

## Chunk 1: Hero Redesign

### Task 1: Restructure hero HTML

**Files:**
- Modify: `docs/index.html:12-21`

- [ ] **Step 1: Rewrite the header section in index.html**

Replace lines 12-21 with the new hero structure. Trust badges + CTAs go between subtitle and stats. Stats + relay bar move to the bottom.

```html
  <header>
    <div class="header-content">
      <h1>Discover Paid APIs</h1>
      <p class="subtitle">Live services announcing on the Nostr network via <a href="https://github.com/TheCryptoDonkey/402-announce">kind 31402</a></p>

      <div class="trust-badges">
        <span class="trust-badge">No registry</span>
        <span class="trust-badge">No API keys</span>
        <span class="trust-badge">No gatekeepers</span>
        <span class="trust-badge">Lightning native</span>
      </div>

      <div class="hero-ctas">
        <a href="#filters" class="btn btn-primary" id="browse-cta">Browse APIs</a>
        <a href="#announce" class="btn btn-secondary" id="announce-cta">Announce yours</a>
      </div>

      <div class="stats">
        <span id="service-count">0 services</span> found across <span id="relay-count">0 relays</span>
      </div>
      <div id="relay-status" class="relay-status" role="status" aria-label="Relay connection status"></div>
    </div>
  </header>
```

- [ ] **Step 2: Add anchor IDs to existing sections**

These IDs are needed for the CTA smooth scroll targets. In `docs/index.html`:

- Line 24: add `id="filters"` → `<section class="filters" id="filters" aria-label="Filter services">`
- Line 39: add `id="announce"` → `<section class="announce-cta" id="announce">`

- [ ] **Step 3: Verify the HTML renders without errors**

Open `http://localhost:8765` in a browser. The hero should show the new elements (unstyled). Stats and relay status should still function since their IDs haven't changed.

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "feat: restructure hero HTML — trust badges, CTAs, reordered stats"
```

### Task 2: Style the hero trust badges and CTA buttons

**Files:**
- Modify: `docs/style.css:208-237` (after `.subtitle a:hover`, before `.stats`)

- [ ] **Step 1: Add trust badges CSS**

Insert after the `.subtitle a:hover` block (after line 228) and before `.stats` (line 230):

```css
/* ============================================================
   Trust Badges — Hero Value Props
   ============================================================ */

.trust-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}

.trust-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-family: var(--font-body);
  font-weight: 500;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.02);
  letter-spacing: 0.01em;
}

/* ============================================================
   Hero CTA Buttons
   ============================================================ */

.hero-ctas {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1.4rem;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-family: var(--font-body);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.btn-primary {
  background: var(--accent-amber);
  color: #0a0a0f;
  border: 1px solid var(--accent-amber);
}

.btn-primary:hover {
  background: #d97706;
  border-color: #d97706;
  color: #0a0a0f;
}

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-medium);
}

.btn-secondary:hover {
  border-color: var(--accent-amber);
  background: var(--accent-amber-dim);
  color: var(--accent-amber);
}
```

- [ ] **Step 2: Add smooth scroll JS for CTA buttons**

In `docs/app.js`, add after the existing delegated click handler (after line 852):

```javascript
// Smooth scroll for hero CTA buttons (respects prefers-reduced-motion)
document.addEventListener('click', (e) => {
  const cta = e.target.closest('#browse-cta, #announce-cta')
  if (!cta) return
  e.preventDefault()
  const target = document.querySelector(cta.getAttribute('href'))
  if (!target) return
  const behaviour = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  target.scrollIntoView({ behavior: behaviour })
})
```

- [ ] **Step 3: Verify visually**

Open `http://localhost:8765`. Trust badges should appear as four bordered boxes. Two CTA buttons below — amber filled "Browse APIs" and outlined "Announce yours". Clicking each should smooth-scroll to the correct section.

- [ ] **Step 4: Add responsive rules for trust badges and CTAs**

In the tablet media query (`@media (max-width: 1024px)`) — no changes needed (badges flex-wrap naturally).

In the mobile media query (`@media (max-width: 640px)`), add:

```css
  .trust-badges {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
  }

  .trust-badge {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
    justify-content: center;
  }

  .hero-ctas {
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn {
    justify-content: center;
  }
```

- [ ] **Step 5: Commit**

```bash
git add docs/style.css docs/app.js
git commit -m "feat: style hero trust badges and CTA buttons with smooth scroll"
```

---

## Chunk 2: Dual Audience Section

### Task 3: Add dual-audience HTML

**Files:**
- Modify: `docs/index.html` (insert between `</header>` and `<main>`, or as first child of `<main>` before filters)

- [ ] **Step 1: Insert the dual-audience section HTML**

Insert as the first child of `<main>` (before the filters section):

```html
    <section class="audience-section">
      <div class="audience-card audience-dev">
        <h2>For Developers</h2>
        <p class="audience-intro">Browse the grid below, or test any API from your terminal.</p>
        <ul class="audience-benefits">
          <li>Pay-per-request with Lightning</li>
          <li>No accounts or API keys</li>
          <li>Standard HTTP + L402 flow</li>
        </ul>
        <pre><code># Try any 402 API — you'll get an invoice back
curl -i https://satgate.trotters.dev/v1/chat/completions \
  -H "Accept: application/json"
# Pay the Lightning invoice, use the L402 token</code></pre>
        <div class="audience-links">
          <a href="https://www.npmjs.com/package/402-announce">402-announce on npm</a>
          <a href="https://github.com/TheCryptoDonkey/402-announce">GitHub</a>
        </div>
      </div>

      <div class="audience-card audience-agent">
        <h2>For AI Agents</h2>
        <p class="audience-intro">Give your agent access to every 402 service with one config line.</p>
        <ul class="audience-benefits">
          <li>Auto-discover via Nostr</li>
          <li>Auto-pay via Lightning</li>
          <li>No approval process</li>
        </ul>
        <div class="audience-tabs" role="tablist" aria-label="Agent integration method">
          <button role="tab" id="tab-mcp" aria-selected="true" aria-controls="panel-mcp" class="tab active">MCP</button>
          <button role="tab" id="tab-nostr" aria-selected="false" aria-controls="panel-nostr" class="tab">Nostr</button>
        </div>
        <div id="panel-mcp" role="tabpanel" aria-labelledby="tab-mcp">
          <pre><code>{
  "mcpServers": {
    "402-mcp": {
      "command": "npx",
      "args": ["402-mcp"]
    }
  }
}</code></pre>
        </div>
        <div id="panel-nostr" role="tabpanel" aria-labelledby="tab-nostr" hidden>
          <pre><code>// Subscribe to kind 31402 on any relay
const ws = new WebSocket('wss://relay.damus.io')
ws.onopen = () =>
  ws.send(JSON.stringify(['REQ', 'discover', { kinds: [31402] }]))
ws.onmessage = (e) => {
  const [type, , event] = JSON.parse(e.data)
  if (type === 'EVENT') console.log(event)
}</code></pre>
        </div>
        <div class="audience-links">
          <a href="https://www.npmjs.com/package/402-mcp">402-mcp on npm</a>
          <a href="https://github.com/TheCryptoDonkey/402-mcp">GitHub</a>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Verify HTML renders**

Open `http://localhost:8765`. The two audience cards should appear (unstyled) above the filters section.

- [ ] **Step 3: Commit**

```bash
git add docs/index.html
git commit -m "feat: add dual-audience section HTML — developers and AI agents"
```

### Task 4: Style the dual-audience section

**Files:**
- Modify: `docs/style.css` (insert after the `.stats` block, before the relay status section)

- [ ] **Step 1: Add audience section CSS**

Insert after the `.stats` block (after line ~237 — adjust for earlier insertions):

```css
/* ============================================================
   Dual Audience Section
   ============================================================ */

.audience-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.audience-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 2rem;
  position: relative;
  border-left: 3px solid transparent;
}

.audience-dev {
  border-left-color: var(--accent-amber);
}

.audience-agent {
  border-left-color: var(--accent-blue);
}

.audience-card h2 {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.audience-intro {
  color: var(--text-secondary);
  margin: 0 0 1rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.audience-benefits {
  list-style: none;
  padding: 0;
  margin: 0 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.audience-benefits li {
  font-size: 0.88rem;
  color: var(--text-secondary);
  padding-left: 1.2rem;
  position: relative;
}

.audience-benefits li::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--text-muted);
}

.audience-card pre {
  margin: 0 0 1rem;
}

.audience-card code {
  display: block;
  background: #0d0d14;
  color: #c4c4d0;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  overflow-x: auto;
  font-size: 0.78rem;
  line-height: 1.65;
  font-family: var(--font-code);
  white-space: pre;
}

.audience-links {
  display: flex;
  gap: 0.65rem;
}

.audience-links a {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s;
  font-weight: 500;
}

.audience-links a:hover {
  border-color: var(--accent-amber);
  background: var(--accent-amber-dim);
  color: var(--accent-amber);
}

/* --- Tabs (WAI-ARIA compliant) --- */

.audience-tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.tab {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-family: var(--font-body);
  cursor: pointer;
  border: 1px solid var(--border-medium);
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.2s;
  line-height: 1.4;
}

.tab:hover {
  border-color: var(--text-muted);
  background: rgba(255, 255, 255, 0.03);
}

.tab.active {
  background: var(--accent-amber);
  border-color: var(--accent-amber);
  color: #0a0a0f;
  font-weight: 500;
}

.tab:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Add responsive rules**

In the tablet media query (`@media (max-width: 1024px)`), add:

```css
  .audience-section {
    grid-template-columns: 1fr;
  }
```

In the mobile media query (`@media (max-width: 640px)`), add:

```css
  .audience-card {
    padding: 1.5rem 1.25rem;
  }

  .audience-card code {
    font-size: 0.72rem;
    padding: 1rem;
  }
```

- [ ] **Step 3: Verify visually**

Two cards side by side on desktop. Amber left border on Developers, blue on AI Agents. Code blocks styled. Stacks on tablet. Compact on mobile.

- [ ] **Step 4: Commit**

```bash
git add docs/style.css
git commit -m "feat: style dual-audience section — cards, code blocks, tabs, responsive"
```

### Task 5: Add tab toggle JS

**Files:**
- Modify: `docs/app.js` (add after the smooth scroll handler from Task 2)

- [ ] **Step 1: Add tab switching logic with ARIA updates**

```javascript
// Tab switching for audience-agent code panels
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.audience-tabs [role="tab"]')
  if (!tab) return

  const tablist = tab.closest('[role="tablist"]')
  if (!tablist) return

  // Deactivate all tabs in this group
  tablist.querySelectorAll('[role="tab"]').forEach(t => {
    t.classList.remove('active')
    t.setAttribute('aria-selected', 'false')
    const panel = document.getElementById(t.getAttribute('aria-controls'))
    if (panel) panel.hidden = true
  })

  // Activate clicked tab
  tab.classList.add('active')
  tab.setAttribute('aria-selected', 'true')
  const panel = document.getElementById(tab.getAttribute('aria-controls'))
  if (panel) panel.hidden = false
})

// Arrow key navigation between tabs (WAI-ARIA Tabs pattern)
document.addEventListener('keydown', (e) => {
  const tab = e.target.closest('.audience-tabs [role="tab"]')
  if (!tab) return

  const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')]
  const idx = tabs.indexOf(tab)
  let next

  if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length]
  else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length]

  if (next) {
    e.preventDefault()
    next.focus()
    next.click()
  }
})
```

- [ ] **Step 2: Verify tab switching**

Click "MCP" and "Nostr" tabs. The code block should swap. Arrow keys should cycle between tabs. Check that `aria-selected` updates correctly (browser dev tools).

- [ ] **Step 3: Commit**

```bash
git add docs/app.js
git commit -m "feat: add tab toggle with WAI-ARIA keyboard navigation"
```

---

## Chunk 3: Service Card Action Buttons

### Task 6: Add action buttons to service cards

**Files:**
- Modify: `docs/app.js:558-582` (insert action row before pubkey footer in `buildCard()`)

- [ ] **Step 1: Insert action buttons row in buildCard()**

In `docs/app.js`, find the comment `// --- Footer: pubkey ---` (line 560). Insert the following block BEFORE it:

```javascript
  // --- Action buttons ---
  const actions = document.createElement('div')
  actions.className = 'card-actions'

  const visitBtn = document.createElement('a')
  visitBtn.href = s.url
  visitBtn.target = '_blank'
  visitBtn.rel = 'noopener noreferrer'
  visitBtn.className = 'btn-action btn-visit'
  visitBtn.textContent = 'Visit API \u2197'
  actions.appendChild(visitBtn)

  const curlBtn = document.createElement('button')
  curlBtn.className = 'btn-action btn-curl'
  curlBtn.dataset.url = s.url
  curlBtn.textContent = 'Copy curl'
  actions.appendChild(curlBtn)

  article.appendChild(actions)
```

- [ ] **Step 2: Add delegated click handler for "Copy curl"**

In `docs/app.js`, add to the existing delegated click handler section (or as a new handler):

```javascript
// Copy curl command to clipboard
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-curl')
  if (!btn) return

  const url = btn.dataset.url
  const cmd = '# Returns 402 with a Lightning invoice \u2014 pay to get an L402 token\ncurl -i ' + url + ' -H "Accept: application/json"'
  navigator.clipboard.writeText(cmd).then(() => {
    btn.textContent = 'Copied!'
    setTimeout(() => { btn.textContent = 'Copy curl' }, 1500)
  }).catch(() => {
    btn.textContent = 'Error'
    setTimeout(() => { btn.textContent = 'Copy curl' }, 1500)
  })
})
```

- [ ] **Step 3: Verify action buttons render**

Open `http://localhost:8765`. Each service card should now show "Visit API ↗" and "Copy curl" buttons (unstyled) between the meta row and the pubkey footer.

- [ ] **Step 4: Commit**

```bash
git add docs/app.js
git commit -m "feat: add Visit API and Copy curl action buttons to service cards"
```

### Task 7: Style the action buttons

**Files:**
- Modify: `docs/style.css` (insert after the `.timestamp` block, before the Loading section)

- [ ] **Step 1: Add card action buttons CSS**

Insert after the `.timestamp` block (after line ~732):

```css
/* ============================================================
   Card Action Buttons
   ============================================================ */

.card-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.85rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-body);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  border: 1px solid var(--border-medium);
  background: transparent;
  color: var(--text-secondary);
}

.btn-action:hover {
  border-color: var(--accent-amber);
  background: var(--accent-amber-dim);
  color: var(--accent-amber);
  text-decoration: none;
}

.btn-action:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.btn-visit {
  color: var(--text-secondary);
}

.btn-curl {
  color: var(--text-secondary);
}
```

- [ ] **Step 2: Verify visually**

Open `http://localhost:8765`. Action buttons should appear as small outlined buttons. Hover turns them amber. "Visit API ↗" opens the URL. "Copy curl" copies the command and shows "Copied!" feedback.

- [ ] **Step 3: Commit**

```bash
git add docs/style.css
git commit -m "feat: style card action buttons — visit API and copy curl"
```

---

## Chunk 4: Final Polish

### Task 8: Visual verification and responsive check

**Files:**
- All three files (read-only verification)

- [ ] **Step 1: Desktop verification**

Open `http://localhost:8765` at full width. Verify:
- Hero: heading, subtitle, 4 trust badges in a row, 2 CTA buttons, stats, relay status
- Dual audience: two cards side by side, amber/blue left borders, code blocks, tabs switch
- Service cards: header, URL, description, pricing chips, meta badges, action buttons, pubkey footer
- Announce CTA section unchanged
- Footer unchanged

- [ ] **Step 2: Tablet verification (1024px)**

Resize browser to 1024px width. Verify:
- Dual audience cards stack vertically
- Trust badges wrap naturally
- Service cards unchanged

- [ ] **Step 3: Mobile verification (640px)**

Resize browser to 640px width. Verify:
- Trust badges in 2x2 grid
- CTA buttons stack vertically
- Audience cards compact padding
- Service card headers stack

- [ ] **Step 4: Functional verification**

- Click "Browse APIs" — smooth scrolls to filters
- Click "Announce yours" — smooth scrolls to announce CTA
- Click MCP/Nostr tabs — code blocks swap, arrow keys work
- Click "Visit API ↗" — opens service URL in new tab
- Click "Copy curl" — copies command, shows "Copied!" feedback
- Search and filter pills still work
- Relay status still updates live

- [ ] **Step 5: Verify clean working tree**

```bash
git status
```

Expected: working tree clean (all changes committed in Tasks 1-7).
