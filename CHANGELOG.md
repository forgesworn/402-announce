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
