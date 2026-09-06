import { convexAuth } from '@convex-dev/auth/server';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { Password } from '@convex-dev/auth/providers/Password';

// Anonymous keeps the app fully usable without an account (offline-first);
// Password adds the optional email + password upgrade. Email verification is
// intentionally skipped — no mail service dependency for the MVP.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous, Password],
});
