# Dashboard Redesign — Full Page Restructure

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Hero redesign, dual-audience section, service card action buttons

## Context

The discover.trotters.dev dashboard lists HTTP 402 paid API services discovered via Nostr kind 31402 events and external directories. The current layout is functional but flat — it doesn't communicate why decentralised discovery matters or how different audiences (developers, AI agents) should engage.

Inspired by sats4ai.com's dual-audience framing and trust badges, this redesign restructures the page into distinct zones while keeping the existing dark editorial aesthetic and vanilla HTML/CSS/JS stack.

## Page Structure

```
HERO            — heading, subtitle, trust badges, CTAs, relay status
DUAL AUDIENCE   — "For Developers" / "For AI Agents" side-by-side cards
SERVICES        — search + filters + improved service cards
ANNOUNCE CTA    — existing bottom section (unchanged)
FOOTER          — existing (unchanged)
```

## Section 1: Hero Redesign

The hero gains trust badges and CTA buttons. Current elements reorganise:

1. **Heading + subtitle** — unchanged ("Discover Paid APIs", kind 31402 link)
2. **Trust badges row** — four compact bordered boxes:
   - "No registry"
   - "No API keys"
   - "No gatekeepers"
   - "Lightning native"
   - Text-only (no icons or emojis). Styled as subtle bordered boxes matching the existing editorial aesthetic — not flashy pills
3. **CTA buttons** — two buttons:
   - "Browse APIs" — scrolls to the `.filters` section (so users land at the search bar, not past it). Uses `element.scrollIntoView({ behavior: 'smooth' })`.
   - "Announce yours" — scrolls to the `.announce-cta` section. Same smooth scroll.
   - Primary/secondary button styling (amber fill for Browse, outlined for Announce)
4. **Stats + relay status** — moves below CTAs. Still shows service count, relay count, and connection dots. Functionally identical, just repositioned lower in the visual hierarchy.

## Section 2: Dual Audience Section

New section between hero and services grid. Two cards side by side on desktop, stacked on mobile.

### For Developers (left card, amber left-border accent)

- **Heading:** "For Developers"
- **Intro:** "Browse the grid below, or test any API from your terminal."
- **Benefits list** (3 items):
  - Pay-per-request with Lightning
  - No accounts or API keys
  - Standard HTTP + L402 flow
- **Code block:**
  ```
  # Try any 402 API — you'll get an invoice back
  curl -i https://satgate.trotters.dev/v1/chat/completions \
    -H "Accept: application/json"
  # Pay the Lightning invoice, use the L402 token
  ```
- **Links:** [402-announce on npm](https://www.npmjs.com/package/402-announce), [GitHub](https://github.com/forgesworn/402-announce)

### For AI Agents (right card, blue left-border accent)

- **Heading:** "For AI Agents"
- **Intro:** "Give your agent access to every 402 service with one config line."
- **Benefits list** (3 items):
  - Auto-discover via Nostr
  - Auto-pay via Lightning
  - No approval process
- **Tabbed code block** with two tabs:
  - **MCP tab** (default): JSON config for 402-mcp (`{ "mcpServers": { "402-mcp": { "command": "npx", "args": ["402-mcp"] }}}`)
  - **Nostr tab**: JS snippet subscribing to kind 31402
- **Links:** [402-mcp on npm](https://www.npmjs.com/package/402-mcp), [GitHub](https://github.com/forgesworn/402-mcp)

**Tab implementation:** Two button elements toggle visibility of two code blocks. Active tab gets amber fill, inactive gets outlined style. Pure vanilla JS, no framework. Tabs follow WAI-ARIA Tabs pattern: container has `role="tablist"`, each tab button has `role="tab"` with `aria-selected` and `aria-controls`, each code panel has `role="tabpanel"` with `aria-labelledby`. Arrow keys move focus between tabs.

**Styling:** Same dark surface background as service cards. Subtle coloured left border (2-3px) — amber for Developers, blue for AI Agents. Same border-radius and padding as the announce CTA section.

## Section 3: Service Card Improvements

Building on the recent card restructure (single-column flow with header row, URL, description, pricing chips, meta badges, pubkey footer), we add:

### Action Buttons Row

New row between the meta badges and the pubkey footer:

- **"Visit API"** — opens `s.url` in a new tab. Styled as a small outlined button. External-link indicator is a Unicode arrow character (↗) appended to the button text.
- **"Copy curl"** — copies a generated curl command to clipboard. Same clipboard feedback pattern as the existing "Copy" pubkey button ("Copied!" for 1.5s).

The curl command format (includes a comment explaining the 402 flow):
```
# Returns 402 with a Lightning invoice — pay to get an L402 token
curl -i <service-url> -H "Accept: application/json"
```

Both buttons are small, outlined, matching the existing copy-pubkey button aesthetic but slightly more prominent.

### Pubkey Footer

Moves below the action buttons. Remains the most muted element in the card — it's metadata, not a call to action.

### Card Structure (final)

```
1. Header row:    [icon] name  ···  source-badge  timestamp
2. URL line:      https://service.example.com
3. Description:   One-two lines of about text
4. Pricing chips: capability — price  (horizontal)
5. Meta row:      Lightning · topic1 · topic2 · topic3
6. Action row:    [Visit API ↗]  [Copy curl]
7. Pubkey footer: abc123...wxyz [Copy]
```

## What Stays Unchanged

- Particle canvas background animation
- Search input + filter pills (payment + topic)
- Announce CTA section at bottom (hero CTA scrolls to it)
- Footer
- All relay connection logic, event store, external source fetching
- Reduced motion support (new sections respect `prefers-reduced-motion`)
- Responsive breakpoints: dual-audience cards stack at 1024px, compact at 640px

## Technical Approach

- **No new dependencies.** Vanilla HTML/CSS/JS throughout.
- **Files modified:** `docs/index.html`, `docs/style.css`, `docs/app.js`
- **No new files.**
- HTML structure changes in index.html for hero and dual-audience section (static content).
- CSS additions for trust badges, CTA buttons, audience cards, tab switching, action buttons.
- JS additions: tab toggle handler, curl generation, smooth scroll for CTA buttons, action button event handlers.
- In `app.js`, the `buildCard()` function is modified to insert the new action row DOM construction between the existing meta row block and the pubkey footer block.

## Responsive Behaviour

| Breakpoint | Behaviour |
|------------|-----------|
| Desktop (>1024px) | Dual-audience cards side by side. Full trust badges row. |
| Tablet (<=1024px) | Dual-audience cards stack vertically. Trust badges wrap. |
| Mobile (<=640px) | Compact padding. Trust badges 2x2 grid. Smaller CTA buttons. |
