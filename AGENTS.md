# 402-announce

Announce HTTP 402 services on Nostr via kind 31402 parameterised replaceable events.

## Commands

```bash
npm run build        # tsc → build/
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run fixtures:storage        # build, then check the storage fixtures and schema are reproducible
npm run check:storage-package   # build, then check the packed tarball contents and the 402-announce and 402-announce/storage imports
```

## Architecture

```
src/
  index.ts         # Public exports (root entry)
  types.ts         # AnnounceConfig, Announcement, PricingDef, CapabilityDef, L402_ANNOUNCE_KIND
  announce.ts      # announceService(): high-level, build + sign + publish to relays
  event.ts         # buildAnnounceEvent(): low-level, build + sign only
  utils.ts         # Validation helpers (hex conversion, SSRF checks, isPrivateHost)
  storage.ts       # Storage profile functions; also the "./storage" subpath entry
  storage-types.ts # Storage profile constants and types (root entry only)
tests/
  announce.test.ts
  event.test.ts
  storage.test.ts
schemas/
  storage-service-v1.schema.json   # JSON Schema for the storage description (ships in the package)
fixtures/
  storage-v1/                      # Signed synthetic fixtures and manifest.json (ship in the package)
docs/
  storage-service-v1.md            # Storage profile contract (ships in the package)
  guide.md, index.html             # Guide and site (not in the package)
scripts/
  generate-storage-contract.mjs    # Regenerates or checks (--check) the schema and fixtures
  check-storage-package.mjs        # Release gate: checks the tarball contents and imports (never shipped)
examples/                          # Runnable scripts, not in the npm package
```

## Gotchas

- Import paths in src use `.js` extensions (Node16 module resolution)
- Secret key bytes are zeroised after signing: tests must account for this
- Relay connections have a 10-second timeout; individual failures warn but don't reject, and if every relay fails `announceService` still resolves with the `eventId` of an event no relay accepted
- The package is ESM-only: `exports` has no `require` condition. `./storage` exports only the six storage functions and `ParsedStorageAnnouncement`; constants and types are root-only
- The `urls` field is a `string[]` (not singular `url`): supports 1-10 transport endpoints
- `paymentMethods` is `string[][]` (not `string[]`): each entry is `[rail, ...params]`

## Conventions

- **British English**: colour, initialise, behaviour, licence
- **ESM-only**: `"type": "module"`, `.js` extensions in imports
- **Strict TypeScript**: no `any`, no implicit returns
- **Commit messages**: `type: description` format (e.g. `feat:`, `fix:`, `docs:`)
- Do NOT include `Co-Authored-By` lines in commits

## Verification

Always run these before submitting changes:

```bash
npm run typecheck
npm test
```

`prepublishOnly` also runs `npm run fixtures:storage` and `npm run check:storage-package` (each rebuilds first). Run both after any change to `src/storage*.ts`, `schemas/`, `fixtures/storage-v1/`, `scripts/` or the `files` and `exports` fields in `package.json`, because the local checks above can pass while these fail and block the release. The full release gate, in order, is:

```bash
npm run typecheck && npm run build && npm test && npm run fixtures:storage && npm run check:storage-package
```

Tests must pass. There are 200+ tests covering input validation, SSRF prevention, key zeroisation, and event construction.

## Release & Versioning

Automated via [forgesworn/anvil](https://github.com/forgesworn/anvil): `auto-release.yml` reads conventional commits on push to `main`, bumps the version, and creates a GitHub Release; `release.yml` then runs the pre-publish gates and publishes to npm via OIDC trusted publishing.

| Type | Version Bump |
|------|--------------|
| `fix:` | Patch (1.0.x) |
| `feat:` | Minor (1.x.0) |
| `BREAKING CHANGE:` (in commit body) | Major (x.0.0) |
| `chore:`, `docs:`, `refactor:` | None |

Tests must pass before release.
