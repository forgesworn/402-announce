# Public storage service announcements, version 1

**Status: executable experimental contract.** This is a ForgeSworn extension to
the kind `31402` discovery ecosystem, not a ratified NIP or BUD. It describes
public paid storage, public free mirror shelter, or both. Native publication,
HTTP serving and consumer UI integration are separate implementation stages.

The schema, unsigned builder, signed verifier and fixtures are implemented in
this package. They perform no network access and take no signing key. The
existing `announceService`/`buildAnnounceEvent` paid-API contract is unchanged;
do not pass a storage description to either function.

## Roles and consent

- The operator explicitly enables public service publication, choosing the
  services, service identity, origins and relays to expose.
- The node builds the snapshot from enabled capabilities and actual admission
  policy, including sold capacity, pending holds and configured sales/owner
  limits. Public availability is coarse; exact disk usage is excluded.
- An external signer signs the exact requested unsigned event. The publisher
  verifies the signature, service public key and unchanged template before sending.
- A client queries relays only after an explicit discovery action. Discovery
  neither contacts the advertised nodes nor authorises a payment or upload.
- After selecting a node, the user separately fetches its current description,
  reviews terms and obtains a paid quote or authorises an exact mirror request.

Private owner/friend nodes are unpublished unless the operator deliberately
enables a public service. Publication exposes the selected service identity,
endpoints, offers and issuer choices; removal or expiry cannot undo disclosure.
Do not link clearnet/onion endpoints or a personal identity automatically.

## HTTP description

The planned public endpoint is `GET /services/v1`, returning one
`StorageServiceDescription` directly as JSON. Existing
`GET /checkout/v1/offers` remains compatible. The endpoint path is a versioned
ForgeSworn extension and is not a standard Blossom endpoint.

The [JSON Schema](../schemas/storage-service-v1.schema.json) is structural.
Semantic validation below is also REQUIRED. Numbers are JSON integers in the
JavaScript safe range (`0..9007199254740991`); no floating prices or conversions.
Unknown fields, types and profile versions are rejected in version 1.

| Field | Meaning |
| --- | --- |
| `profile` | Exactly `forgesworn-storage-service-v1` |
| `service_pubkey` | Lower-case hex Nostr public key of the dedicated service signer |
| `identifier` | Stable listing ID, 1–128 ASCII letters, digits, underscores or hyphens |
| `name`, `about` | Public display text; always render as untrusted text |
| `origins` | 1–10 unique canonical origin URLs, including the root `/` |
| `max_blob_bytes` | Positive per-blob ciphertext limit; admission may impose a smaller package limit |
| `observed_at`, `expires_at` | Snapshot and expiry timestamps, integer Unix seconds |
| `state` | `published` or `withdrawn` |
| `checkout` | Checkout description when paid services exist; otherwise `null` |
| `services` | 1–32 uniquely identified free/paid capabilities |

Origins MUST be public HTTPS or checksum-valid v3 onion HTTP/HTTPS. No
credentials, query, fragment, non-root path, noncanonical URL spelling or
private/loopback IP literals. Validation does not resolve DNS: a fetcher MUST
apply DNS/connection egress policy, streaming limits and redirect refusal.
Onion endpoints require an explicit Tor transport; an onion URL never authorises
clearnet DNS, a direct request or transport fallback.

`expires_at` MUST exceed `observed_at`, by no more than 86400 seconds. A newly
signed event MUST be created between `observed_at` and `observed_at + 300`, and
before expiry. Recommended publication defaults are 1800-second refresh and
7200-second expiry, with coalesced/rate-limited updates on material changes.

### Free mirror shelter

At most one free shelter capability is permitted per listing:

- `type: "free-mirror"`, `operation: "mirror"`, `authorisation: "bud-11"`;
- positive `revision`, unique `id`, and `availability`;
- `retention: "best-effort"` and an explicit `eviction_policy`.

This advertises signed BUD-04 mirrors under the node's actual guest admission
policy. It MUST NOT imply anonymous access, unrestricted direct uploads,
guaranteed retention or replication. A zero price is attached to this capability
for display, without a fabricated payment method. A free-only kind `31402`
listing omits `pmi`; this is a documented exception in this storage extension.
Legacy consumers requiring `pmi` are not compatible with free-only listings.

### Paid storage packages

Each `type: "paid-storage"` service contains the existing checkout offer fields:
`id`, positive `revision`, `capacity_bytes`, `duration_seconds`, `grace_seconds`,
`price_msat`, `delivery_bytes`, `delivery_policy`, `retention_policy`, and
`refund_policy`, plus its `availability`.

Capacity, duration, price and delivery allowance are positive integers; grace
may be zero. Price is for the **whole package**, not per request, per byte or
per month unless its duration explicitly says so. `price_msat` MUST be divisible
by 1000 for the current checkout; the `price` tag displays the equivalent sats.
All policy strings are explicit, nonblank and bounded to 2048 characters.
No storage contract, durability guarantee or extra replica is implied by price.

`checkout` exists if and only if at least one paid service exists. It contains:

- `protocol: "wildbloom-checkout-v1"`;
- `origin`, which MUST be public HTTPS and also occur in `origins`;
- `network: "bitcoin" | "testnet" | "regtest"`;
- 1–2 unique `rails: "lightning" | "lnurlcash"`;
- `issuers`, with the existing public `id`, `note_endpoint`, `callback` and
  compressed `mint_pubkey` fields.

LNURLcash requires Bitcoin and at least one issuer. Without LNURLcash, issuers
MUST be empty. Issuer IDs are unique; endpoint/callback are canonical public
HTTPS URLs without credentials/query/fragment and share one origin.

Paid checkout is supported **only at `checkout.origin`**. A mixed HTTPS/onion
listing does not promise onion checkout. Payment transports, issuer validation,
NIP-98 identity, quote consent and BUD-11 storage authorisation remain separate.

### Availability and withdrawal

| `availability` | Meaning |
| --- | --- |
| `accepting` | Operator's snapshot says this operation/package can currently be admitted |
| `full` | Current capacity/admission policy cannot accommodate new requests |
| `paused` | Operator has paused this capability |
| `unknown` | Current admission cannot be safely determined |

These are self-reported admission observations, not endpoint liveness proofs.
No advertised state reserves disk. Paid quotes perform an atomic reservation;
free mirror requests check admission at request time. Existing paid obligations
survive a paused, full, expired or withdrawn listing.

A withdrawn snapshot retains the same service key and identifier, marks all
services `paused`, and publishes a replacement. It is an availability
tombstone, not a refund, deletion of stored files or cancellation of an allowance.
The publisher stops heartbeats and may additionally request NIP-09 deletion.
Expiry is enforced locally even if a relay retains the record. NIP-40 deletion
and third-party deletion are never guaranteed.

## Nostr event mapping

Use kind `31402`. The unsigned builder returns standard `EventTemplate` fields
only. The signed event's `pubkey` MUST equal `content.storage.service_pubkey`.
Each version-1 event is bounded to 65536 UTF-8 bytes including the signed JSON
envelope. Descriptions are bounded to 60000 bytes before capability duplication.

| Tag | Mapping |
| --- | --- |
| `d`, `name`, `about` | Description fields |
| `url` | One tag for each canonical origin |
| `source` | `self`; only the operator's signer can make this listing |
| `status` | `active` for published; `stale` for withdrawn, for legacy display compatibility |
| `expiration` | `expires_at`, as an integer decimal string |
| `t` | `storage`, `wildbloom`, `forgesworn-storage-service-v1` |
| `price` | Service ID, whole-package sats, `sats`; `0` for free shelter |
| `pmi` | `wildbloom-checkout`, actual rail, network; accepted unique mint hosts appended for LNURLcash |

The new `wildbloom-checkout` flow identifier MUST be recognised explicitly by
consumers. It does not enable generic L402, IETF Payment or LNURLcash-header
automatic purchasing. Do not mislabel Wildbloom checkout as any of those flows.

Clients filter at relays with the single-letter `#t` tags. Multi-letter `#pmi`
filters are not reliably indexed; match payment methods locally.

Content is exactly `{ "storage": <description>, "capabilities": [...] }`.
Capabilities are deterministically derived in service order, as implemented by
the builder and recorded in fixtures. Names equal service IDs. Free capability
endpoint is `/mirror`; paid capability endpoint is `/checkout/v1/offers`.
Endpoints describe the workflow, not permission to invoke it automatically.

Parsers accept object-key and tag reordering. They MUST require the complete
expected tag multiset and capability mapping, including no duplicated/extra
tags or fields. This binds displayed identity, package price, payment flow and
expiry to the signed description. UTF-8 event bytes are signed using ordinary
Nostr canonical event serialisation; this profile adds no signing algorithm.

## Replacement, freshness and identity

Verify signature and the full profile before considering a record valid. Select
the newest valid record per `pubkey + d`. Equal timestamps use the lower event
ID. **Select latest before applying expiry or availability.** Do not resurrect
an older accepting offer when the newest is full, paused, withdrawn or expired.

Retain latest valid signed records as session watermarks across lookups. The
selector returns expired/withdrawn records for that reason; callers must pass
them back with new relay results. Relay omission/eclipse can still hide a newer
record from a fresh client. Always confirm current service terms at the endpoint.

Default client maximum age is 7200 seconds, configurable up to 86400; default
future-clock allowance is 30 seconds, configurable up to 300. `expires_at <= now`
is expired. A record older than the maximum age is stale even before expiry.
Timestamp freshness never proves current reachability or signer honesty.

After a separate user action fetches `/services/v1`, match its service public
key, listing ID and selected origin to the signed description. The HTTP snapshot
must itself be fresh and unexpired. A valid signature identifies its publisher;
it does not prove that publisher owns an advertised endpoint. HTTPS serving the
same configured service identity provides the binding check. Apply equivalent
origin authentication for a selected onion transport.

Current HTTP offers may differ from advertised prices. Surface changed revisions,
terms, rails or issuers, invalidate previous consent and request a fresh quote.
Never send an invoice request, payment, signer identity or file on discovery.

## APIs and fixtures

```ts
import {
  buildStorageAnnouncement, acceptSignedStorageAnnouncement,
  selectStorageAnnouncements, validateStorageEndpointBinding,
} from '402-announce'

const requested = buildStorageAnnouncement(publicDescription)
// Hand off `requested` to the explicitly configured external signer.
const accepted = acceptSignedStorageAnnouncement(returnedSignedEvent, requested, { now })
// Publishing `accepted.event` is a separate action owned by the publisher.

const latest = selectStorageAnnouncements([...sessionWatermarks, ...relayEvents], { now })
// Retain latest records; display only current, published, accepting capabilities.
const current = validateStorageEndpointBinding(fetchedDescription, chosenListing, selectedOrigin, { now })
// Review current terms; no quote or request has been sent by these functions.
```

The schema and [fixture manifest](../fixtures/storage-v1/manifest.json) ship in
the npm package so Rust and browser implementations can consume identical data.
All fixture domains and keys are synthetic. The public test signing seed is
`01` repeated 32 times; NEVER use it for real services or relay publication.
Fixtures inject their own clock. Their timestamps are not production timestamps.

Valid examples cover paid-only, free-only, combined, checksum-valid onion,
full, withdrawn and expired listings. Signed rejection vectors have valid
cryptographic signatures but invalid author binding, price, checkout mapping,
expiry, future time, secret fields, free operations, numeric bounds or onion
checksums. Selection cases require no resurrection after full/withdrawn/expired.

Run `npm run fixtures:storage` to build and check reproducibility. To intentionally
regenerate after a reviewed contract change, build and run
`node scripts/generate-storage-contract.mjs`. The generator preserves valid
signatures of unchanged events, accounting for Schnorr auxiliary randomness.
`npm run check:storage-package` verifies root/subpath imports and that the npm
package contains the schema, documentation and every fixture, without writing a tarball.

## Delivery sequence and acceptance

1. **Contract (this change):** schema, pure builder/verifier, signed examples,
   rejection/replacement fixtures, package exports and CI drift gate.
2. **Node:** authoritative `/services/v1`, admission snapshot from the same
   policy as reservation, opt-in native publisher, exact external signing,
   bounded relay acknowledgement/retry, refresh/withdrawal and Tor routing.
3. **Consumers:** Wildbloom explicit service discovery and current-term review;
   402-indexer, 402.pub and 402-mcp profile support, expiry/watermarks and
   non-payment service display. Automated checkout support is a separate gate.
4. **Acceptance/release:** two real nodes, paid and free mirror journeys,
   capacity/price races, crashes/restart/expiry, relay failures, malicious
   listings, no implicit browser requests, Tor fail-closed checks and independent
   encrypted retrieval. Real wallet/mint acceptance is recorded separately.
5. **Operator integration:** Archipelago opt-in configuration and runbook after
   the end-to-end journey passes. Never enable sales/publication during installation.

Do not report an HTTP server, native publisher, public-relay publication, consumer
UI, unattended purchasing or live receiving acceptance as implemented by this
contract package alone.
