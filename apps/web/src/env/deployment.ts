/**
 * True where Vercel serves the site, always over HTTPS, so cookies there are marked Secure
 * (D-077). Local servers and the CI end-to-end tests use plain HTTP, where a browser would not
 * send a Secure cookie back. Reads only VERCEL, which Vercel sets to "1" itself (env/server.ts),
 * so the proxy does not parse the whole server environment for every refreshed session.
 */
export function isHttpsDeployment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.VERCEL === '1';
}
