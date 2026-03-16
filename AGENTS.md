# AI Agent Instructions — 402-announce

Announce HTTP 402 services on Nostr via kind 31402 parameterised replaceable events.

## Commands

```bash
npm run build        # tsc → build/
npm test             # vitest run
npm run typecheck    # tsc --noEmit
```

## Architecture

```
src/
  index.ts       # Public exports
  types.ts       # AnnounceConfig, Announcement, PricingDef, CapabilityDef, L402_ANNOUNCE_KIND
  announce.ts    # announceService() — high-level: build + sign + publish to relays
  event.ts       # buildAnnounceEvent() — low-level: build + sign only
  utils.ts       # Validation helpers (hex conversion, SSRF checks)
tests/
  announce.test.ts
  event.test.ts
```

## Gotchas

- Import paths in src use `.js` extensions (Node16 module resolution)
- Secret key bytes are zeroised after signing — tests must account for this
- Relay connections have a 10-second timeout; individual failures warn but don't reject
- The `urls` field is a `string[]` (not singular `url`) — supports 1-10 transport endpoints

## Conventions

- **British English** — colour, initialise, behaviour, licence
- **ESM-only** — `"type": "module"`, `.js` extensions in imports
- **Strict TypeScript** — no `any`, no implicit returns
- **Commit messages** — `type: description` format (e.g. `feat:`, `fix:`, `docs:`)
- Do NOT include `Co-Authored-By` lines in commits

## Verification

Always run both before submitting changes:

```bash
npm run typecheck
npm test
```

Tests must pass. There are 200+ tests covering input validation, SSRF prevention, key zeroisation, and event construction.
