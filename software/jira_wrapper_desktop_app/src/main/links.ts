/**
 * Decides which URLs stay inside the app and which are handed to the real browser.
 *
 * The subtle part is single sign-on: an Atlassian login can bounce through Google,
 * Microsoft, Okta and friends. Sending those to the system browser strands the login
 * half-finished, so identity providers have to be treated as internal too.
 */

const IDENTITY_HOSTS = new Set([
  'id.atlassian.com',
  'auth.atlassian.com',
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.live.com',
  'login.yahoo.com',
]);

const IDENTITY_SUFFIXES = [
  '.okta.com',
  '.oktapreview.com',
  '.auth0.com',
  '.onelogin.com',
  '.pingidentity.com',
  '.duosecurity.com',
];

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isIdentityProvider(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (IDENTITY_HOSTS.has(host)) return true;
  return IDENTITY_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** True for the configured Jira host and Atlassian's own domains. */
export function isJiraHost(url: string, domain: string | null): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (domain && host === domain) return true;
  return (
    host === 'atlassian.net' ||
    host === 'atlassian.com' ||
    host.endsWith('.atlassian.net') ||
    host.endsWith('.atlassian.com')
  );
}

/** Anything that should render inside the app window rather than the system browser. */
export function isInternal(url: string, domain: string | null): boolean {
  return isJiraHost(url, domain) || isIdentityProvider(url);
}
