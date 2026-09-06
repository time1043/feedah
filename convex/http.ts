import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// Required by Convex Auth: the backend discovers the JWKS through
// /.well-known/openid-configuration on CONVEX_SITE_URL to validate the JWTs
// clients present. Without these routes that endpoint 404s and no token can
// be verified, so authenticated connections never come up.
auth.addHttpRoutes(http);

export default http;
