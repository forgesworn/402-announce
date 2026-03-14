export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error('hexToBytes: input must be an even-length hex string')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/**
 * Returns true if the hostname resolves to a loopback, link-local, or
 * RFC-1918 private address. Used to prevent SSRF via relay URLs.
 *
 * Rejects:
 *   - localhost, localhost., *.localhost
 *   - 127.0.0.0/8 (IPv4 loopback)
 *   - 0.0.0.0/8 (RFC 1122 "this network")
 *   - ::1 (IPv6 loopback)
 *   - :: (IPv6 unspecified)
 *   - 169.254.0.0/16 (IPv4 link-local)
 *   - fe80::/10 (IPv6 link-local)
 *   - fc00::/7 (IPv6 unique-local / ULA)
 *   - 10.0.0.0/8 (RFC-1918)
 *   - 172.16.0.0/12 (RFC-1918)
 *   - 192.168.0.0/16 (RFC-1918)
 *   - ::ffff:<private> (IPv4-mapped IPv6)
 *   - ::<private> (IPv4-compatible IPv6, deprecated)
 *
 * Also rejects octal, hex, and shorthand IPv4 notations that could
 * bypass naive decimal-only checks.
 *
 * Note: This checks the hostname string only. It does not perform DNS
 * resolution, so a hostname that resolves to a private IP at connection
 * time (DNS rebinding) is not caught. Deploy behind network-level
 * egress controls in production.
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase()

  // Reject localhost, localhost., *.localhost, *.localhost.
  if (h === 'localhost' || h === 'localhost.') return true
  if (h.endsWith('.localhost') || h.endsWith('.localhost.')) return true

  // Strip IPv6 brackets
  const stripped = h.replace(/^\[|\]$/g, '')

  // IPv6 loopback ::1 and unspecified ::
  if (stripped === '::1' || stripped === '::') return true

  // IPv6 link-local fe80::/10 (prefix fe80 through febf)
  if (/^fe[89ab][0-9a-f]:/i.test(stripped)) return true

  // IPv6 unique-local fc00::/7 (fc00:: through fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(stripped)) return true

  // IPv4-mapped IPv6 — ::ffff:x.x.x.x or ::ffff:HHHH:HHHH
  const v4mapped = stripped.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
  if (v4mapped) {
    return isPrivateIPv4(v4mapped[1])
  }
  // ::ffff:HHHH:HHHH form (e.g. ::ffff:7f00:1 = 127.0.0.1)
  const v4mappedHex = stripped.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (v4mappedHex) {
    const hi = parseInt(v4mappedHex[1], 16)
    const lo = parseInt(v4mappedHex[2], 16)
    const ip = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isPrivateIPv4(ip)
  }

  // IPv4-compatible IPv6 (deprecated) — ::x.x.x.x
  const v4compat = stripped.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4compat) {
    return isPrivateIPv4(v4compat[1])
  }

  // Reject non-decimal IPv4 notations that could bypass checks:
  // - Octal (leading zero): 0177.0.0.1
  // - Hex: 0x7f.0.0.1 or 0x7f000001
  // - Shorthand: 127.1 (two-part), 127.0.1 (three-part)
  // - Decimal integer: 2130706433
  // These are all valid in some URL parsers / OS network stacks.

  // Reject hex IPv4 (contains 0x)
  if (/^0x/i.test(h) || /\.0x/i.test(h)) return true

  // Reject pure decimal integer IPs (e.g. 2130706433)
  if (/^\d{1,10}$/.test(h) && !h.includes('.')) return true

  // Reject shorthand IPv4 (2 or 3 parts instead of 4).
  // Intentionally conservative: rejects ALL shorthand numeric forms, not just
  // private ranges, because some OS stacks interpret e.g. 10.1 as 10.0.0.1.
  // Single-part all-numeric is already handled above.
  const parts = h.split('.')
  if (parts.length >= 2 && parts.length <= 3 && parts.every(p => /^\d+$/.test(p))) return true

  // Parse dotted-decimal IPv4 (exactly 4 numeric parts)
  const ipv4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4) {
    const rawOctets = [ipv4[1], ipv4[2], ipv4[3], ipv4[4]]
    // Reject leading zeros (octal notation bypass: 0177 = 127)
    for (const octet of rawOctets) {
      if (octet.length > 1 && octet.startsWith('0')) return true
    }
    // Reject out-of-range octets (not valid decimal IPv4)
    if (rawOctets.some(o => Number(o) > 255)) return false
    return isPrivateIPv4(h)
  }

  return false
}

/** Check a strict decimal dotted-quad IPv4 against private ranges. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return false
  const [a, b] = parts
  if (a === 0) return true                                     // 0.0.0.0/8
  if (a === 127) return true                                   // 127.0.0.0/8
  if (a === 10) return true                                    // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true            // 172.16.0.0/12
  if (a === 192 && b === 168) return true                      // 192.168.0.0/16
  if (a === 169 && b === 254) return true                      // 169.254.0.0/16
  return false
}
