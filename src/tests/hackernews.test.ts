import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HackerNews } from '../hackernews';

describe('hackernews.ts: HackerNews', () => {
  test('fetchJson invokes globalThis.fetch and parses JSON', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url: string | URL) => {
      assert.equal(url.toString(), 'https://api.test/data.json');
      return new Response(JSON.stringify({ status: 'ok' }));
    });

    const data = await HackerNews.fetchJson('https://api.test/data.json');
    assert.deepEqual(data, { status: 'ok' });
  });

  test('fetchStories filters non-story items, handles null items, and preserves story objects', async (t) => {
    t.mock.method(globalThis, 'fetch', async (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('topstories.json')) {
        return new Response(JSON.stringify([101, 102, 103, 104]));
      }
      if (urlStr.includes('item/101.json')) {
        return new Response(JSON.stringify({ id: 101, type: 'story', title: 'Valid Story 1', score: 100 }));
      }
      if (urlStr.includes('item/102.json')) {
        // Deleted item returning null
        return new Response(JSON.stringify(null));
      }
      if (urlStr.includes('item/103.json')) {
        // Comment item
        return new Response(JSON.stringify({ id: 103, type: 'comment', text: 'Some comment' }));
      }
      if (urlStr.includes('item/104.json')) {
        return new Response(JSON.stringify({ id: 104, type: 'story', title: 'Valid Story 2', score: 250 }));
      }
      return new Response(null, { status: 404 });
    });

    const stories = await HackerNews.fetchTopStories();
    assert.equal(stories.length, 2);
    assert.equal(stories[0].id, 101);
    assert.equal(stories[0].title, 'Valid Story 1');
    assert.equal(stories[1].id, 104);
    assert.equal(stories[1].title, 'Valid Story 2');
  });

  test('fetchBestStories queries beststories endpoint', async (t) => {
    let queriedUrl = '';
    t.mock.method(globalThis, 'fetch', async (url: string | URL) => {
      queriedUrl = url.toString();
      if (queriedUrl.includes('beststories.json')) {
        return new Response(JSON.stringify([201]));
      }
      if (queriedUrl.includes('item/201.json')) {
        return new Response(JSON.stringify({ id: 201, type: 'story', title: 'Best Story' }));
      }
      return new Response(null, { status: 404 });
    });

    const stories = await HackerNews.fetchBestStories();
    assert.equal(stories.length, 1);
    assert.equal(stories[0].id, 201);
  });

  test('fetchStories handles non-array response from stories endpoint safely', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => {
      return new Response(JSON.stringify({ error: 'service unavailable' }));
    });

    const stories = await HackerNews.fetchStories('https://hacker-news.firebaseio.com/v0/invalid.json');
    assert.deepEqual(stories, []);
  });
});
