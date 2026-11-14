#!/usr/bin/env node
// Assemble the release APK in the existing android/ project (run `pn expo
// prebuild` yourself first; this script does no prebuild) and copy it to
// dist/ (gitignored) under a stamped name:
//   feedah-<yyMMdd-HHmm>-<short commit>[-<abi>].apk
//   e.g. feedah-260915-0144-8b21-arm64-v8a.apk
//
// `--abi <abi>` restricts the native libraries to a single architecture so the
// APK only carries that ABI's .so files (e.g. arm64-v8a for modern phones).
// It passes -PreactNativeArchitectures=<abi> to gradle; gradle still emits
// app-release.apk, so the ABI is stamped onto the copied artifact instead:
// node scripts/build-apk.mjs --abi arm64-v8a
//   -> dist/feedah-260915-0144-8b21-arm64-v8a.apk

import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

// `--abi <abi>` (e.g. arm64-v8a) limits the bundled native libs to one
// architecture via gradle's reactNativeArchitectures property.
const abiArgIndex = process.argv.indexOf('--abi')
const abi = abiArgIndex !== -1 ? process.argv[abiArgIndex + 1] : undefined

const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts })
}

// The timestamp in the name is taken when the APK is finished, not when the
// script starts, so it reflects when the artifact was actually produced.
const buildStamp = () => {
  const now = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  return `${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
}

const shortCommit = () =>
  execSync('git rev-parse --short=4 HEAD', { cwd: root, encoding: 'utf8' }).trim()

// Assemble the release APK. Windows runs gradlew.bat through cmd; the sh
// wrapper covers macOS/Linux. Keep the daemon locally (warm JVM + plugin
// classpath across runs); --no-daemon only in CI so no daemon lingers.
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const daemonFlag = process.env.CI ? '--no-daemon' : ''
const abiFlag = abi ? `-PreactNativeArchitectures=${abi}` : ''
console.log(abi ? `\nBuilding for ABI: ${abi}` : '\nBuilding universal APK (all ABIs)')
run(`${gradlew} assembleRelease ${abiFlag} ${daemonFlag}`.trimEnd(), {
  cwd: path.join(root, 'android'),
})

// Copy the artifact out under the stamped name.
const built = path.join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
)
if (!existsSync(built)) throw new Error(`APK not found at ${built} — did assembleRelease succeed?`)

// The ABI is stamped onto the copied artifact because gradle emits the same
// app-release.apk no matter what reactNativeArchitectures was set to — without
// it a single-ABI build would be indistinguishable from a universal one.
const abiSuffix = abi ? `-${abi}` : ''
const name = `feedah-${buildStamp()}-${shortCommit()}${abiSuffix}.apk`
mkdirSync(path.join(root, 'dist'), { recursive: true })
copyFileSync(built, path.join(root, 'dist', name))
console.log(`\nAPK ready: dist/${name}`)
