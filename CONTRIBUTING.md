# Contributing to 402-announce

## Setup

```bash
git clone https://github.com/forgesworn/402-announce.git
cd 402-announce
npm install
```

## Development

```bash
npm run build        # Compile TypeScript → build/
npm test             # Run tests (Vitest)
npm run typecheck    # Type-check without emitting
```

## Project structure

```
src/
  index.ts       # Public exports
  types.ts       # AnnounceConfig, Announcement, PricingDef, CapabilityDef
  announce.ts    # announceService() — build + sign + publish to relays
  event.ts       # buildAnnounceEvent() — build + sign only
  utils.ts       # Validation helpers (hex conversion, SSRF checks)
tests/
  announce.test.ts
  event.test.ts
```

## Conventions

- **British English** — colour, initialise, behaviour, licence
- **ESM-only** — `"type": "module"`, `.js` extensions in imports
- **Strict TypeScript** — no `any`, no implicit returns
- **Commit messages** — `type: description` (e.g. `feat:`, `fix:`, `docs:`)

## Testing

Tests use [Vitest](https://vitest.dev). Secret key bytes are zeroised after signing, so tests must account for this (e.g. by capturing values before zeroisation).

```bash
npm test
```

## Submitting changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Make your changes and ensure `npm test` and `npm run typecheck` pass
4. Commit with a descriptive message following the conventions above
5. Open a pull request against `main`
