import 'server-only';
export type OidcMetadata = {
  authorization_endpoint: string; token_endpoint: string; jwks_uri: string; end_session_endpoint?: string;
};
export function validIssuerUrl(raw:string): boolean {
  try {
    const url=new URL(raw);
    if(url.protocol==='https:')return true;
    return process.env.NODE_ENV!=='production' && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname);
  } catch {return false;}
}
export async function oidcMetadata(): Promise<OidcMetadata> {
  const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
  if (!issuer || !validIssuerUrl(issuer)) throw new Error('OIDC_ISSUER must be HTTPS (local loopback HTTP allowed only in development)');
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`OIDC discovery failed (${response.status})`);
  const meta = await response.json() as OidcMetadata & { issuer?: string };
  if (meta.issuer !== issuer) throw new Error('OIDC issuer mismatch');
  for (const url of [meta.authorization_endpoint, meta.token_endpoint, meta.jwks_uri]) {
    if (!url || !validIssuerUrl(url)) throw new Error('OIDC endpoint must be HTTPS (local loopback HTTP allowed only in development)');
  }
  return meta;
}
export function origin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error('APP_ORIGIN missing');
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('APP_ORIGIN must be HTTPS in production');
  return url.origin;
}
export function sameOrigin(request: Request): boolean {
  const supplied = request.headers.get('origin');
  const target = origin();
  // State-changing browser requests must supply Origin. This proxy is not a cross-site public API.
  return supplied === target;
}
