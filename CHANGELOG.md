## [2.1.1](https://github.com/forgesworn/402-announce/compare/v2.1.0...v2.1.1) (2026-04-12)


### Bug Fixes

* resolve development dependency vulnerabilities ([999b39c](https://github.com/forgesworn/402-announce/commit/999b39c0b502f4e026109ca25a0d225c25f4ce74))

# [2.1.0](https://github.com/forgesworn/402-announce/compare/v2.0.1...v2.1.0) (2026-03-24)


### Features

* accept 'payment' as valid rail for IETF Payment announcements ([fde4763](https://github.com/forgesworn/402-announce/commit/fde47630a22f9f94280dc39d6b5817c0c60f5db9))

## [2.0.1](https://github.com/forgesworn/402-announce/compare/v2.0.0...v2.0.1) (2026-03-20)


### Bug Fixes

* correct copyright to TheCryptoDonkey ([b3d9c15](https://github.com/forgesworn/402-announce/commit/b3d9c1575131a7a14fc4d4fa3ddd18c4f895de2c))

# [2.0.0](https://github.com/forgesworn/402-announce/compare/v1.11.2...v2.0.0) (2026-03-18)


### Features

* structured payment method arrays ([d1eb2f7](https://github.com/forgesworn/402-announce/commit/d1eb2f7f4595403977383157eb80a1baf3b39542))


### BREAKING CHANGES

* paymentMethods type changed from string[] to string[][].

## [1.11.2](https://github.com/TheCryptoDonkey/402-announce/compare/v1.11.1...v1.11.2) (2026-03-16)


### Bug Fixes

* add control char validation to capabilities and version fields ([7134fb2](https://github.com/TheCryptoDonkey/402-announce/commit/7134fb29f68356362b2bdcf5aaa24642c4d64d70))
* add secret file patterns to .gitignore ([066679d](https://github.com/TheCryptoDonkey/402-announce/commit/066679d219008456d6533c79add57d6d7657d959))
* harden input validation with control char rejection and schema depth limit ([d4b143b](https://github.com/TheCryptoDonkey/402-announce/commit/d4b143bb5e173d212eb540cd069dda8a5970908c))
* pin CI actions by SHA to prevent supply chain attacks ([8b30438](https://github.com/TheCryptoDonkey/402-announce/commit/8b304385cba8a7a1e0b4a5b66dc90f7255defd9a))
* prevent stack overflow in jsonDepth and reject control chars in URLs ([6d7aba6](https://github.com/TheCryptoDonkey/402-announce/commit/6d7aba69b14f3d303275e8bdc0f72f67ab63e78f))

## [1.11.1](https://github.com/TheCryptoDonkey/402-announce/compare/v1.11.0...v1.11.1) (2026-03-16)


### Bug Fixes

* harden input validation and SSRF prevention ([293a652](https://github.com/TheCryptoDonkey/402-announce/commit/293a65267bd860b43f5db3f03e01ebc1e50b3e62))

# [1.11.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.10.0...v1.11.0) (2026-03-16)


### Features

* announceService iterates urls for SSRF check, skips .onion ([651ff62](https://github.com/TheCryptoDonkey/402-announce/commit/651ff622dcb2b31d5807c6d046713b7f858beac4))
* buildAnnounceEvent supports multiple url tags (1-10 urls) ([00ae404](https://github.com/TheCryptoDonkey/402-announce/commit/00ae4042d0e5e15992d3f136a72f00ede30f6ced))
* change AnnounceConfig.url to urls (string[]) ([70bdcd5](https://github.com/TheCryptoDonkey/402-announce/commit/70bdcd599f39f59a54f911ee368fa60f7167ff28))
* redirect discover.trotters.dev to 402.pub ([c139750](https://github.com/TheCryptoDonkey/402-announce/commit/c13975057336f3fc5e5af356f6adbbcce5551576))

# [1.10.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.9.0...v1.10.0) (2026-03-16)


### Features

* add Open Graph and Twitter Card meta tags ([ba65cd1](https://github.com/TheCryptoDonkey/402-announce/commit/ba65cd1104a730fa86efeb17b29ae27449dae85d))
* add SVG favicon — amber lightning bolt ([a218609](https://github.com/TheCryptoDonkey/402-announce/commit/a2186091db3a15085c6ae390fda2b138bde9c22f))
* mobile polish, expandable cards, health indicators, analytics ([245e920](https://github.com/TheCryptoDonkey/402-announce/commit/245e920b9cd1a63d3579bc307975f8f01d119524))

# [1.9.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.8.0...v1.9.0) (2026-03-16)


### Features

* sticky toolbar with live status, bigger search/pills, distinct section backgrounds ([33aa19d](https://github.com/TheCryptoDonkey/402-announce/commit/33aa19d340c2939bb9118f3e90f42c5f48ad9edd))

# [1.8.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.7.0...v1.8.0) (2026-03-16)


### Features

* card action buttons — visit API and copy curl ([a60771a](https://github.com/TheCryptoDonkey/402-announce/commit/a60771a0b6338f2a595f46df61a3118afa51273e))
* dual-audience section — developers and AI agents with tab toggle ([dffb611](https://github.com/TheCryptoDonkey/402-announce/commit/dffb611cb8610553649afcf0a2f107dd574fa27b))
* hero redesign — trust badges, CTAs, smooth scroll ([d6ece6c](https://github.com/TheCryptoDonkey/402-announce/commit/d6ece6c493e23187fd0565093f0cc7105076b0bc))

# [1.7.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.6.0...v1.7.0) (2026-03-16)


### Features

* add particle network, pulsing relays, live counters, new-service flash ([679bf27](https://github.com/TheCryptoDonkey/402-announce/commit/679bf27148610bfbca5c0dd97ffb7e92854e9c4e))

# [1.6.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.5.0...v1.6.0) (2026-03-16)


### Features

* switch to row layout, larger text, better contrast ([45fda00](https://github.com/TheCryptoDonkey/402-announce/commit/45fda00476aeda264a8a2862c33b150881a8bb12))

# [1.5.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.4.1...v1.5.0) (2026-03-16)


### Features

* redesign dashboard — dark refined editorial aesthetic ([d124b0f](https://github.com/TheCryptoDonkey/402-announce/commit/d124b0f008d0fd979754a38c9c03b76fcdae128d))

## [1.4.1](https://github.com/TheCryptoDonkey/402-announce/compare/v1.4.0...v1.4.1) (2026-03-16)


### Bug Fixes

* filter localhost URLs from dashboard, disable satring.com (CORS blocked) ([d3a03ad](https://github.com/TheCryptoDonkey/402-announce/commit/d3a03ad8a4f90727e4767b4b91ebcda40b6c30a7))

# [1.4.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.3.0...v1.4.0) (2026-03-15)


### Features

* add external directory sources (satring.com, l402.directory) with provenance badges ([46cb169](https://github.com/TheCryptoDonkey/402-announce/commit/46cb169728a93e6a9f0674789afe9e9400a8a721))

# [1.3.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.2.1...v1.3.0) (2026-03-15)


### Bug Fixes

* reject private/loopback service URLs in announceService ([909c9a7](https://github.com/TheCryptoDonkey/402-announce/commit/909c9a72b7106ba382e83b51f620e09f4cd5b3fc))


### Features

* add live discovery dashboard for kind 31402 services ([09aaea6](https://github.com/TheCryptoDonkey/402-announce/commit/09aaea6af76cbb758e380c8b8f0932cd670ae802))

## [1.2.1](https://github.com/TheCryptoDonkey/402-announce/compare/v1.2.0...v1.2.1) (2026-03-15)


### Bug Fixes

* harden schema serialisation and input validation consistency ([a8518ba](https://github.com/TheCryptoDonkey/402-announce/commit/a8518babda3a31fd65ce713d2e56a2800710d8f1))

# [1.2.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.1.5...v1.2.0) (2026-03-15)


### Features

* add optional endpoint field to capability definitions ([294af78](https://github.com/TheCryptoDonkey/402-announce/commit/294af78f081c2a47b471eb8b805f25d6b458dacb))

## [1.1.5](https://github.com/TheCryptoDonkey/402-announce/compare/v1.1.4...v1.1.5) (2026-03-15)


### Bug Fixes

* harden input validation and add key zeroing tests ([5f6e850](https://github.com/TheCryptoDonkey/402-announce/commit/5f6e850f44e31c37045bb5b2ff21e1e210949448))
* remove integer-only price guard to allow fractional and large values ([d954140](https://github.com/TheCryptoDonkey/402-announce/commit/d954140802efa763dc2a728f92ece8bf8e4eee98))
* replace MAX_SAFE_INTEGER guard with integer check for x402-evm compat ([64a576a](https://github.com/TheCryptoDonkey/402-announce/commit/64a576aa84abd2c43a4905bc000904262df0efe4))

## [1.1.4](https://github.com/TheCryptoDonkey/402-announce/compare/v1.1.3...v1.1.4) (2026-03-15)


### Bug Fixes

* add missing input validation and harden SSRF prevention ([8e173b6](https://github.com/TheCryptoDonkey/402-announce/commit/8e173b6c4be3054cdf1994b828ffdc5c9fbfdc41))
* address re-review findings ([846f6cb](https://github.com/TheCryptoDonkey/402-announce/commit/846f6cbb6d1305c024976962fee7c943f8ce1741))

## [1.1.3](https://github.com/TheCryptoDonkey/402-announce/compare/v1.1.2...v1.1.3) (2026-03-15)


### Bug Fixes

* harden SSRF prevention and add input validation limits ([da5a3f5](https://github.com/TheCryptoDonkey/402-announce/commit/da5a3f523a252e5c32d349e23bcc56d96c830c48))
* normalise compressed IPv6 before 6to4/Teredo prefix checks ([043e6be](https://github.com/TheCryptoDonkey/402-announce/commit/043e6be353acd7dff62d3154f72c78e8a1b8816f))
* remove private host check from buildAnnounceEvent ([e4b36c1](https://github.com/TheCryptoDonkey/402-announce/commit/e4b36c1cb0a7c996d20fdf992118dd5a4f64b730))

## [1.1.2](https://github.com/TheCryptoDonkey/402-announce/compare/v1.1.1...v1.1.2) (2026-03-14)


### Bug Fixes

* address Codex cross-check findings ([1e70861](https://github.com/TheCryptoDonkey/402-announce/commit/1e70861719799b7f978f7f0943cd531de5fe3dcc))
* address re-review findings from security audit ([ce891ce](https://github.com/TheCryptoDonkey/402-announce/commit/ce891ceec8827d55c6f81a78f5aeb2c7ee0f29a3))
* harden isPrivateHost against SSRF bypass vectors ([f9afd28](https://github.com/TheCryptoDonkey/402-announce/commit/f9afd28704b1e7ad8d48f6fd2abfa899b917f81a))

## [1.1.1](https://github.com/TheCryptoDonkey/402-announce/compare/v1.1.0...v1.1.1) (2026-03-14)


### Bug Fixes

* correct key zeroing documentation and remove redundant decode ([b52b5da](https://github.com/TheCryptoDonkey/402-announce/commit/b52b5da412eae32028be8fbc43c05c2161b1321e))
* reject private/loopback relay URLs (SSRF prevention) ([7427753](https://github.com/TheCryptoDonkey/402-announce/commit/7427753b512899f1a664ba40c0a900885f473124))
* remove dead relayRef variable and unused test imports ([64aa93a](https://github.com/TheCryptoDonkey/402-announce/commit/64aa93ae40735c9743ee060a638a6bc2f64f06d9))

# [1.1.0](https://github.com/TheCryptoDonkey/402-announce/compare/v1.0.0...v1.1.0) (2026-03-14)


### Features

* add optional status tag and capability schemas per NIP kind 31402 ([f38c7fe](https://github.com/TheCryptoDonkey/402-announce/commit/f38c7feaeb46d4f838c0e95a942efecc98cb410a))

# 1.0.0 (2026-03-14)


### Bug Fixes

* security hardening — key validation, connection timeout, parallel relays ([b36d67e](https://github.com/TheCryptoDonkey/402-announce/commit/b36d67e16b139d434bbc9f9dccee2662a57bc901))


### Code Refactoring

* rename l402-announce to 402-announce ([dd3be09](https://github.com/TheCryptoDonkey/402-announce/commit/dd3be0934abc4361a8d368dc1ceb7de907171102))


### Features

* add CI/CD pipeline with semantic-release and GitHub sponsorship ([25821bb](https://github.com/TheCryptoDonkey/402-announce/commit/25821bb2847e994c61c28bb012251db01bd98cf1))
* add type definitions ([cb89ccd](https://github.com/TheCryptoDonkey/402-announce/commit/cb89ccd0d72d3bb1200778ffae112be1c593cf35))
* announceService publishes kind 31402 events to Nostr relays ([3b1cfac](https://github.com/TheCryptoDonkey/402-announce/commit/3b1cfac05b4f020791fbf8a910eeb949fa7818e4))
* build kind 31402 L402 service announcement events ([a200a4e](https://github.com/TheCryptoDonkey/402-announce/commit/a200a4e0212377ce58241eabf708a7a5a5007328))
* public exports and README ([504c175](https://github.com/TheCryptoDonkey/402-announce/commit/504c1759a5658e2845b4c427bcefefe97f7bbea6))


### BREAKING CHANGES

* package name changed from @thecryptodonkey/l402-announce to 402-announce.
