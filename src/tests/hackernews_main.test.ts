import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteDatabase } from '../db';
import { getStory, fetch_stories } from '../hackernews_main';
import { HackerNews } from '../hackernews';
import { Digestor, GenerativeModelLike } from '../digest';
import { WebPageContent } from '../page_content';

describe('hackernews_main.ts: getStory routing', () => {
  test('routes best and top to respective HackerNews methods', async (t) => {
    t.mock.method(HackerNews, 'fetchBestStories', async () => [{ id: 1, type: 'story' }]);
    t.mock.method(HackerNews, 'fetchTopStories', async () => [{ id: 2, type: 'story' }]);

    const best = await getStory('best');
    assert.deepEqual(best, [{ id: 1, type: 'story' }]);

    const top = await getStory('top');
    assert.deepEqual(top, [{ id: 2, type: 'story' }]);
  });

  test('throws TypeError on unknown story type', async () => {
    await assert.rejects(
      async () => await getStory('invalid_type'),
      /Unknown story type/
    );
  });
});

describe('hackernews_main.ts: fetch_stories pipeline orchestration', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = new SqliteDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
    Digestor.setModel(null);
  });

  test('filters min_score, deduplicates via DB, isolates distillation errors, and categorizes AI stories', async () => {
    const mockDistiller: any = {
      distilPage: async (url: string) => {
        if (url.includes('failing')) {
          throw new Error('404 Page Not Found');
        }
        return new WebPageContent(`Headline for ${url}`, `Content body for ${url}`, {});
      },
    };

    const mockModel: GenerativeModelLike = {
      generateContent: async (prompt: string) => {
        if (prompt.includes('ai-story')) {
          return {
            response: {
              text: () =>
                '```json\n{"summary": "Summary of AI.", "tags": ["ai", "llm"], "about_ai": true, "full_content": true}\n```',
            },
          };
        } else {
          return {
            response: {
              text: () =>
                '```json\n{"summary": "General tech.", "tags": ["tech"], "about_ai": false, "full_content": true}\n```',
            },
          };
        }
      },
    };
    Digestor.setModel(mockModel);

    // Pre-seed a seen URL in DB
    db.markUrlFailed('https://example.com/already-seen', 99);

    const inputStories = [
      { id: 10, score: 50, title: 'Low score', url: 'https://example.com/low-score' }, // filtered by min_score (100)
      { id: 99, score: 200, title: 'Already seen', url: 'https://example.com/already-seen' }, // filtered by db.contains
      { id: 20, score: 150, title: 'Failing page', url: 'https://example.com/failing-page' }, // throws in distilPage -> markUrlFailed
      { id: 30, score: 180, title: 'Non-AI story', url: 'https://example.com/regular-story' }, // non-AI
      { id: 40, score: 250, title: 'AI story', url: 'https://example.com/ai-story' }, // AI (about_ai: 1)
    ];

    // Suppress console logs during test run
    const origLog = console.log;
    const origErr = console.error;
    console.log = () => {};
    console.error = () => {};

    try {
      await fetch_stories(
        mockDistiller,
        db,
        true, // do_digest
        inputStories,
        100, // min_score
        10, // max_candidates
        5 // max_output
      );
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    // Story 10: Skipped due to low score
    assert.equal(db.contains('https://example.com/low-score', 10), false);

    // Story 20: Failed distillation recorded in seen_urls
    assert.equal(db.contains('https://example.com/failing-page', 20), true);
    const failedSeen = (db as any).db
      .prepare('SELECT status FROM seen_urls WHERE url = ?')
      .get('https://example.com/failing-page');
    assert.equal(failedSeen.status, 'failed');

    // Story 30 and 40: Saved successfully
    assert.equal(db.contains('https://example.com/regular-story', 30), true);
    assert.equal(db.contains('https://example.com/ai-story', 40), true);

    const aiStory = (db as any).db.prepare('SELECT about_ai FROM stories WHERE id = ?').get(40);
    assert.equal(aiStory.about_ai, 1);

    const regularStory = (db as any).db.prepare('SELECT about_ai FROM stories WHERE id = ?').get(30);
    assert.equal(regularStory.about_ai, 0);
  });

  test('respects max_candidates boundary', async () => {
    let distilledCount = 0;
    const mockDistiller: any = {
      distilPage: async () => {
        distilledCount++;
        return new WebPageContent('Head', 'Body', {});
      },
    };

    const inputStories = [
      { id: 1, score: 200, title: 'Story 1', url: 'https://ex.com/1' },
      { id: 2, score: 200, title: 'Story 2', url: 'https://ex.com/2' },
      { id: 3, score: 200, title: 'Story 3', url: 'https://ex.com/3' },
      { id: 4, score: 200, title: 'Story 4', url: 'https://ex.com/4' },
    ];

    const origLog = console.log;
    console.log = () => {};
    try {
      await fetch_stories(
        mockDistiller,
        db,
        false, // do_digest = false
        inputStories,
        -1, // min_score
        2, // max_candidates = 2
        2 // max_output
      );
    } finally {
      console.log = origLog;
    }

    assert.equal(distilledCount, 2);
  });
});
