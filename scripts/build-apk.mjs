#!/usr/bin/env node
// Build a release APK and stamp it with the build time and commit, e.g.
// feedah-260907-0144-8b21.apk. Replicates the manual flow:
//   pnpm expo prebuild
//   cd android && ./gradlew assembleRelease --no-daemon
// The APK lands in dist/ (gitignored): feedah-<yyMMdd-HHmm>-<short commit>.apk

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

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

// 1. Regenerate the android project from app.json (android/ is gitignored,
//    fully generated, so this is safe to re-run).
run('pnpm exec expo prebuild --platform android');

// 2. Assemble the release APK. Windows runs gradlew.bat through cmd; the sh
//    wrapper covers macOS/Linux.
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(`${gradlew} assembleRelease --no-daemon`, { cwd: path.join(root, 'android') });

// 3. Copy the artifact out under the stamped name.
const built = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(built)) throw new Error(`APK not found at ${built} — did assembleRelease succeed?`);

const name = `feedah-${buildStamp()}-${shortCommit()}.apk`;
mkdirSync(path.join(root, 'dist'), { recursive: true });
copyFileSync(built, path.join(root, 'dist', name));
console.log(`\nAPK ready: dist/${name}`);
