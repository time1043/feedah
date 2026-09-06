// Generates the Convex Auth signing keys — the same RS256 recipe as the
// official `npx @convex-dev/auth` CLI — and writes them to the linked
// deployment's env vars (JWT_PRIVATE_KEY + JWKS). Convex Auth fails every
// sign-in with "Missing environment variable JWT_PRIVATE_KEY" until this runs
// once per deployment.
//
// Requires a logged-in Convex CLI: run `npx convex login` (or a one-off
// `npx convex dev`) first. Targets the linked dev deployment by default;
// pass --prod for the production deployment.
import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';

const target = process.argv.includes('--prod') ? '--prod' : '';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
// Same shape the official CLI produces: single-line PKCS8 PEM, JWKS with one sig key.
const privatePem = privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString()
  .trimEnd()
  .replace(/\n/g, ' ');
const jwks = JSON.stringify({
  keys: [{ use: 'sig', ...publicKey.export({ format: 'jwk' }) }],
});

function setEnvVar(name, value) {
  const escaped = value.replace(/"/g, '\\"');
  try {
    execSync(`npx convex env set ${target} -- ${name} "${escaped}"`, { stdio: 'pipe' });
    console.log(`set ${name} (value hidden)`);
  } catch {
    console.error(
      `Could not set ${name}. Is the CLI logged in and the project linked?\n` +
        'Run `npx convex login`, then `npx convex dev --once` (or check .env.local CONVEX_DEPLOYMENT).',
    );
    process.exit(1);
  }
}

setEnvVar('JWT_PRIVATE_KEY', privatePem);
setEnvVar('JWKS', jwks);
console.log('Convex Auth keys written. Sign-in works after this; no app rebuild needed.');
