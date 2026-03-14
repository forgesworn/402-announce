export function hexToBytes(hex: string): Uint8Array {
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
 *   - localhost
 *   - 127.0.0.0/8 (IPv4 loopback)
 *   - ::1 (IPv6 loopback)
 *   - 0.0.0.0
 *   - 169.254.0.0/16 (IPv4 link-local)
 *   - fe80::/10 (IPv6 link-local)
 *   - 10.0.0.0/8 (RFC-1918)
 *   - 172.16.0.0/12 (RFC-1918)
 *   - 192.168.0.0/16 (RFC-1918)
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase()

  // Reject literal "localhost"
  if (h === 'localhost') return true

  // IPv6 loopback ::1 (may appear as [::1] in URLs — strip brackets)
  const stripped = h.replace(/^\[|\]$/g, '')
  if (stripped === '::1') return true

  // IPv6 link-local fe80::/10 (prefix fe80 through febf)
  if (/^fe[89ab][0-9a-f]:/i.test(stripped)) return true

  // Parse dotted-decimal IPv4
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [, a, b, c] = ipv4.map(Number)
    if (a === 127) return true                                      // 127.0.0.0/8
    if (a === 0 && b === 0 && c === 0) return true                  // 0.0.0.0
    if (a === 10) return true                                       // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true               // 172.16.0.0/12
    if (a === 192 && b === 168) return true                         // 192.168.0.0/16
    if (a === 169 && b === 254) return true                         // 169.254.0.0/16
  }

  return false
}
