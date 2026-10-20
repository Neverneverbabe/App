import { test } from 'node:test';
import assert from 'node:assert/strict';

// api.js reads config.js (no network at import time). fetch is stubbed.
let calls = 0;
globalThis.fetch = async () => {
  calls++;
  return { ok: true, status: 200, statusText: 'OK', json: async () => ({ results: [{ id: 1, title: 'X' }] }) };
};
const api = await import('../api.js');

test('trending results are cached + de-duplicated', async () => {
  calls = 0;
  const a = await api.fetchTrendingItems('movie');
  const b = await api.fetchTrendingItems('movie');
  assert.equal(a[0].media_type, 'movie');
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
});

test('search results are not cached', async () => {
  calls = 0;
  await api.fetchSearchResults('test');
  await api.fetchSearchResults('test');
  assert.equal(calls, 2);
});

test('watch providers: dedupes by provider, prefers Stream kind', () => {
  const details = { 'watch/providers': { results: { US: {
    link: 'https://www.themoviedb.org/movie/1/watch',
    flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }],
    rent: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' },
           { provider_id: 10, provider_name: 'Amazon Video', logo_path: '/a.png' }],
  } } } };
  const { link, providers } = api.getWatchProvidersFromDetails(details);
  assert.equal(link, 'https://www.themoviedb.org/movie/1/watch');
  assert.equal(providers.length, 2);
  assert.equal(providers[0].kind, 'Stream');
  assert.equal(providers[1].kind, 'Rent');
});

test('trailer picker prefers official YouTube trailers', () => {
  const details = { videos: { results: [
    { site: 'YouTube', key: 'teaser1', type: 'Teaser', official: true },
    { site: 'YouTube', key: 'trailer1', type: 'Trailer', official: true },
    { site: 'Vimeo', key: 'v1', type: 'Trailer', official: true },
  ] } };
  assert.equal(api.getTrailerFromDetails(details).key, 'trailer1');
  assert.equal(api.getTrailerFromDetails({ videos: { results: [] } }), null);
  assert.equal(api.getTrailerFromDetails({}), null);
});

test('watch providers handle missing data', () => {
  assert.deepEqual(api.getWatchProvidersFromDetails({}), { link: '', providers: [] });
});
