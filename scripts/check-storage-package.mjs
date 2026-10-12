import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import { buildStorageAnnouncement, STORAGE_PROFILE } from '402-announce'
import { parseStorageAnnouncement } from '402-announce/storage'

const fixture = JSON.parse(readFileSync(new URL('../fixtures/storage-v1/combined.json', import.meta.url), 'utf8'))
assert.equal(buildStorageAnnouncement(fixture.description).kind, 31402)
assert.equal(parseStorageAnnouncement(fixture.signed_event, { now: fixture.now }).description.profile, STORAGE_PROFILE)
const manifest = JSON.parse(readFileSync(new URL('../fixtures/storage-v1/manifest.json', import.meta.url), 'utf8'))
const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }))[0]
const paths = new Set(pack.files.map(f => f.path))
for (const path of ['build/index.js', 'build/storage.js', 'build/storage.d.ts',
  'build/storage-types.js', 'build/storage-types.d.ts', 'schemas/storage-service-v1.schema.json',
  'docs/storage-service-v1.md', 'fixtures/storage-v1/manifest.json',
  ...manifest.cases.map(f => `fixtures/storage-v1/${f}`)]) {
  assert(paths.has(path), `Missing package contract artefact: ${path}`)
}
assert(![...paths].some(p => /(^|\/)(scripts|tests|node_modules)\//.test(p)), 'Development-only material included in package')
console.log(`Package exports and ${manifest.cases.length} signed fixture cases verified (${pack.size} packed bytes). No tarball written.`)
