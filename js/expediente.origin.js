export const CANONICAL_HOST = 'www.mexillum.com';

// The apex domain currently serves the pages but not the Vercel API routes.
// Preserve path, query and capability-token fragment when moving to www.
export function canonicalExpedienteURL(href) {
  const url = new URL(href);
  if (url.hostname !== 'mexillum.com') return null;
  url.hostname = CANONICAL_HOST;
  return url.href;
}

export function redirectToCanonicalHost(locationObject = globalThis.location) {
  const target = locationObject && canonicalExpedienteURL(locationObject.href);
  if (!target) return false;
  locationObject.replace(target);
  return true;
}
