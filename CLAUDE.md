# 402-announce

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
  utils.ts       # Validation helpers
tests/
  announce.test.ts
  event.test.ts
```

## Gotchas

- Import paths in src use `.js` extensions (Node16 module resolution)
- Secret key bytes are zeroised after signing — tests must account for this
- Relay connections have a 10-second timeout; individual failures warn but don't reject

## Conventions

- **British English** — colour, initialise, behaviour, licence
- **ESM-only** — `"type": "module"`, `.js` extensions in imports
- **Strict TypeScript** — no `any`, no implicit returns
- **Git:** commit messages use `type: description` format
- **Git:** Do NOT include `Co-Authored-By` lines in commits
