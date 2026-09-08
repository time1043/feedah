#!/usr/bin/env node
// Build a release APK and stamp it with the build time and commit, e.g.
// feedah-260907-0144-8b21.apk. With `--abi` the ABI is appended before the
// extension, e.g. feedah-260907-0144-8b21-arm64-v8a.apk. The APK lands in
// dist/ (gitignored): feedah-<yyMMdd-HHmm>-<short commit>[-<abi>].apk
//
// Prebuild policy (android/ is gitignored, CNG):
// - android/ missing, or the native fingerprint changed (app.json +
//   package.json + pnpm-lock.yaml): run `expo prebuild --no-clean`, which
//   syncs config plugins and autolinking into the existing project while
//   keeping gradle's incremental intermediates. Plain prebuild in SDK 57
//   recreates android/ from scratch and throws away android/app/build/, so
//   every build would pay for a full native recompile.
// - otherwise: skip prebuild; gradle rebuilds the embedded JS bundle and only
//   whatever else actually changed.
// `--clean` forces a from-scratch prebuild (SDK upgrades, inexplicable native
// build errors): node scripts/build-apk.mjs --clean
//
// `--abi <abi>` restricts the native libraries to a single architecture so the
// APK only carries that ABI's .so files (e.g. arm64-v8a for modern phones).
// It passes -PreactNativeArchitectures=<abi> to gradle; gradle still emits
// app-release.apk, so the ABI is stamped onto the copied artifact instead:
// node scripts/build-apk.mjs --abi arm64-v8a
//   -> dist/feedah-260907-0144-8b21-arm64-v8a.apk

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const FINGERPRINT_FILE = path.join(root, 'android', '.prebuild-fingerprint');

// `--abi <abi>` (e.g. arm64-v8a) limits the bundled native libs to one
// architecture via gradle's reactNativeArchitectures property.
const abiArgIndex = process.argv.indexOf('--abi');
const abi = abiArgIndex !== -1 ? process.argv[abiArgIndex + 1] : undefined;

const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
};

// The timestamp in the name is taken when the APK is finished, not when the
// script starts, so it reflects when the artifact was actually produced.
const buildStamp = () => {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${yy}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
};

const shortCommit = () =>
  execSync('git rev-parse --short=4 HEAD', { cwd: root, encoding: 'utf8' }).trim();

// The lockfile is hashed rather than just package.json so that `pnpm update`
// on a native package is caught even when no version range changed. Pure-JS
// lockfile churn costs one cheap sync prebuild, which is the safe side to err on.
const nativeFingerprint = () => {
  const hash = createHash('sha256');
  for (const file of ['app.json', 'package.json', 'pnpm-lock.yaml']) {
    hash.update(file);
    hash.update(readFileSync(path.join(root, file)));
  }
  return hash.digest('hex');
};

const needsPrebuild = () =>
  !existsSync(path.join(root, 'android', 'settings.gradle')) ||
  !existsSync(FINGERPRINT_FILE) ||
  readFileSync(FINGERPRINT_FILE, 'utf8') !== nativeFingerprint();

if (process.argv.includes('--clean')) {
  run('pnpm exec expo prebuild --platform android');
} else if (needsPrebuild()) {
  // --no-clean still generates from scratch when android/ is absent; it only
  // avoids deleting an existing project. If that project is malformed, the CLI
  // clears and reinitializes it on its own in non-interactive runs.
  run('pnpm exec expo prebuild --platform android --no-clean');
} else {
  console.log('\nNative layer unchanged (fingerprint matches) — skipping prebuild');
}

// Record only after a successful prebuild, so a failed prebuild is retried.
if (!existsSync(FINGERPRINT_FILE) || readFileSync(FINGERPRINT_FILE, 'utf8') !== nativeFingerprint()) {
  writeFileSync(FINGERPRINT_FILE, nativeFingerprint());
}

// 2. Assemble the release APK. Windows runs gradlew.bat through cmd; the sh
//    wrapper covers macOS/Linux. Keep the daemon locally (warm JVM + plugin
//    classpath across runs); --no-daemon only in CI so no daemon lingers.
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const daemonFlag = process.env.CI ? '--no-daemon' : '';
const abiFlag = abi ? `-PreactNativeArchitectures=${abi}` : '';
console.log(abi ? `\nBuilding for ABI: ${abi}` : '\nBuilding universal APK (all ABIs)');
run(`${gradlew} assembleRelease ${abiFlag} ${daemonFlag}`.trimEnd(), { cwd: path.join(root, 'android') });

// 3. Copy the artifact out under the stamped name.
const built = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(built)) throw new Error(`APK not found at ${built} — did assembleRelease succeed?`);

// The ABI is stamped onto the copied artifact because gradle emits the same
// app-release.apk no matter what reactNativeArchitectures was set to — without
// it a single-ABI build would be indistinguishable from a universal one.
const abiSuffix = abi ? `-${abi}` : '';
const name = `feedah-${buildStamp()}-${shortCommit()}${abiSuffix}.apk`;
mkdirSync(path.join(root, 'dist'), { recursive: true });
copyFileSync(built, path.join(root, 'dist', name));
console.log(`\nAPK ready: dist/${name}`);
