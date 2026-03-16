# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in 402-announce, please report it
responsibly via **GitHub private vulnerability reporting**:

1. Go to [Security > Advisories](https://github.com/TheCryptoDonkey/402-announce/security/advisories)
2. Click **"Report a vulnerability"**
3. Provide a clear description, steps to reproduce, and any relevant context

You will receive an acknowledgement within 48 hours. Please do not open public
issues for security vulnerabilities.

## Scope

The following are in scope for security reports:

- Input validation bypasses (SSRF, injection via config fields)
- Secret key material leakage or incomplete zeroisation
- Relay connection handling issues (resource leaks, timeouts)
- Dependency vulnerabilities with a viable exploit path

The following are **out of scope**:

- DNS rebinding attacks (documented limitation — deploy behind egress controls)
- JavaScript string immutability preventing hex key zeroisation (documented limitation)
- Relay operators choosing not to store events (by design — relays are untrusted)

## Supported Versions

Only the latest release on the `main` branch is supported with security fixes.
