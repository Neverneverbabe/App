import { test } from 'node:test';
import assert from 'node:assert/strict';

// api.js reads config.js (no network at import time). fetch is stubbed.
let calls = 0;
let urls = [];
globalThis.fetch = async (url) => {
  calls++;
  urls.push(String(url));
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

test('pricing notes: free kinds are $0 with no subscription', () => {
  assert.match(api.priceNoteForKind('Free'), /\$0/);
  assert.match(api.priceNoteForKind('Ads'), /\$0/);
  assert.match(api.priceNoteForKind('Stream'), /subscription/i);
  assert.match(api.priceNoteForKind('Rent'), /rental/i);
  assert.match(api.priceNoteForKind('Buy'), /purchase/i);
  assert.equal(api.priceNoteForKind('Nope'), '');
});

test('watch providers carry pricing notes', () => {
  const details = { 'watch/providers': { results: { US: {
    link: 'https://www.themoviedb.org/movie/2/watch',
    ads: [{ provider_id: 73, provider_name: 'Tubi', logo_path: '/t.png' }],
  } } } };
  const { providers } = api.getWatchProvidersFromDetails(details);
  assert.equal(providers[0].kind, 'Ads');
  assert.match(providers[0].priceNote, /\$0/);
});

test('free items use the free/ads monetization filter', async () => {
  urls = [];
  const items = await api.fetchFreeItems('movie', 3);
  assert.equal(items[0].media_type, 'movie');
  assert.equal(urls.length, 1);
  assert.match(urls[0], /with_watch_monetization_types=free\|ads/);
  assert.match(urls[0], /watch_region=US/);
  assert.match(urls[0], /page=3/);
});
