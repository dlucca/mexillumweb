import { trackDx } from './diagnostico.analytics.js';

const params = new URLSearchParams(globalThis.location?.search || '');
const retained = new URLSearchParams();
for (const [key, value] of params) {
  if (key.startsWith('utm_') || ['source', 'ref'].includes(key)) retained.set(key, value);
}

document.querySelectorAll('[data-profile]').forEach((link) => {
  const url = new URL(link.href);
  for (const [key, value] of retained) url.searchParams.set(key, value);
  link.href = url.href;
  link.addEventListener('click', () => trackDx('profile_selected', {
    profile_id: link.dataset.profile,
    source: params.get('utm_source') || params.get('source') || 'direct'
  }));
});

trackDx('hub_viewed', { source: params.get('utm_source') || params.get('source') || 'direct' });
