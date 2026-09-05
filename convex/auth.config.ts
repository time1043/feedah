// Identity config that lets Convex verify authJWTs issued by Convex Auth.
// Written verbatim per the Convex Auth manual setup docs.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
