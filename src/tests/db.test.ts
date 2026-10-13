import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteDatabase, slugify, parseProcessedJson, getDatabasePath } from '../db';
import { WebPageContent } from '../page_content';

describe('db.ts: slugify', () => {
  test('normalizes standard strings and removes special characters', () => {
    assert.equal(slugify('Machine Learning 101'), 'machine-learning-101');
    assert.equal(slugify('C++ & Rust: The Future?'), 'c-rust-the-future');
    assert.equal(slugify('  Large Language Models (LLMs)  '), 'large-language-models-llms');
  });

  test('collapses consecutive dashes and removes leading/trailing dashes', () => {
    assert.equal(slugify('---hello---world---'), 'hello-world');
    assert.equal(slugify('foo - - bar'), 'foo-bar');
  });

  test('returns unknown for empty, whitespace, or pure symbol strings', () => {
    assert.equal(slugify(''), 'unknown');
    assert.equal(slugify('   '), 'unknown');
    assert.equal(slugify('!@#$%^&*()'), 'unknown');
  });
});

describe('db.ts: parseProcessedJson', () => {
  test('parses clean JSON correctly', () => {
    const raw = JSON.stringify({
      summary: 'Direct summary of the article.',
      tags: ['ai', 'compiler'],
      about_ai: true,
      full_content: true,
    });
    const result = parseProcessedJson(raw);
    assert.equal(result.summary, 'Direct summary of the article.');
    assert.deepEqual(result.tags, ['ai', 'compiler']);
    assert.equal(result.about_ai, 1);
    assert.equal(result.full_content, 1);
  });

  test('handles markdown code fences with ```json and ```', () => {
    const raw = '```json\n{"summary": "Inside fence", "tags": ["test"], "about_ai": false, "full_content": true}\n```';
    const result = parseProcessedJson(raw);
    assert.equal(result.summary, 'Inside fence');
    assert.deepEqual(result.tags, ['test']);
    assert.equal(result.about_ai, 0);
    assert.equal(result.full_content, 1);
  });

  test('handles generic code fence without language identifier', () => {
    const raw = '```\n{"summary": "No lang identifier", "tags": [], "about_ai": false, "full_content": false}\n```';
    const result = parseProcessedJson(raw);
    assert.equal(result.summary, 'No lang identifier');
    assert.deepEqual(result.tags, []);
    assert.equal(result.about_ai, 0);
    assert.equal(result.full_content, 0);
  });

  test('recovers from trailing double closing braces', () => {
    const raw = '{"summary": "Double braces", "tags": ["db"], "about_ai": true, "full_content": true}}';
    const result = parseProcessedJson(raw);
    assert.equal(result.summary, 'Double braces');
    assert.deepEqual(result.tags, ['db']);
    assert.equal(result.about_ai, 1);
  });

  test('recovers from missing final closing brace', () => {
    const raw = '{"summary": "Missing brace", "tags": ["db"], "about_ai": true, "full_content": true';
    const result = parseProcessedJson(raw);
    assert.equal(result.summary, 'Missing brace');
    assert.deepEqual(result.tags, ['db']);
  });

  test('parses comma-delimited string tags into string array', () => {
    const raw = JSON.stringify({
      summary: 'String tags',
      tags: 'ai, machine-learning,  nlp , ',
      about_ai: true,
      full_content: true,
    });
    const result = parseProcessedJson(raw);
    assert.deepEqual(result.tags, ['ai', 'machine-learning', 'nlp']);
  });

  test('handles empty, null, or completely malformed text safely', () => {
    assert.deepEqual(parseProcessedJson(null), { summary: null, tags: [], about_ai: null, full_content: null });
    assert.deepEqual(parseProcessedJson(''), { summary: null, tags: [], about_ai: null, full_content: null });
    assert.deepEqual(parseProcessedJson('   '), { summary: null, tags: [], about_ai: null, full_content: null });
    assert.deepEqual(parseProcessedJson('Fatal internal server error'), { summary: null, tags: [], about_ai: null, full_content: null });
  });
});

describe('db.ts: getDatabasePath', () => {
  const origEnv = process.env.SQLITE_DB_PATH;

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.SQLITE_DB_PATH = origEnv;
    } else {
      delete process.env.SQLITE_DB_PATH;
    }
  });

  test('returns SQLITE_DB_PATH environment variable if set', () => {
    process.env.SQLITE_DB_PATH = '/custom/path/hn.db';
    assert.equal(getDatabasePath(), '/custom/path/hn.db');
  });

  test('returns fallback home directory path when unset', () => {
    delete process.env.SQLITE_DB_PATH;
    const dbPath = getDatabasePath();
    assert.match(dbPath, /hackernews\.db$/);
  });
});

describe('db.ts: SqliteDatabase', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = new SqliteDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  test('contains() returns false for new items, true for seen URLs or stories', () => {
    assert.equal(db.contains('https://example.com/1', 101), false);

    db.markUrlFailed('https://example.com/failed', 102);
    assert.equal(db.contains('https://example.com/failed'), true);
    assert.equal(db.contains('https://other.com', 102), false);
  });

  test('markUrlFailed() records failed status and is idempotent', () => {
    db.markUrlFailed('https://example.com/broken', 201);
    assert.equal(db.contains('https://example.com/broken'), true);

    // Call again to verify INSERT OR REPLACE works without constraint violation
    db.markUrlFailed('https://example.com/broken', 201);
    assert.equal(db.contains('https://example.com/broken'), true);

    // Empty URL is safely ignored
    db.markUrlFailed('');
  });

  test('saveStory() writes atomic record across stories, story_contents, tags, and seen_urls', () => {
    const story = {
      id: 301,
      title: 'Compilers in TypeScript',
      url: 'https://example.com/compilers',
      score: 180,
      by: 'author_dh',
      time: 1712345678,
      type: 'story',
      descendants: 42,
      kids: [302, 303],
    };

    const distilled = new WebPageContent(
      'Compilers in TypeScript',
      'Detailed content explaining AST generation and bytecode emit.',
      { 1: 'Compilers in TypeScript', 2: { 1: 'Detailed content' } }
    );

    const processedText = JSON.stringify({
      summary: 'Summary of TS compiler architecture.',
      tags: ['compilers', 'typescript', 'programming'],
      about_ai: false,
      full_content: true,
    });

    db.saveStory(story, distilled, processedText);

    // Verify presence in seen_urls and stories
    assert.equal(db.contains('https://example.com/compilers', 301), true);

    // Verify underlying SQLite tables
    const rawDb = (db as any).db;
    const storyRow = rawDb.prepare('SELECT * FROM stories WHERE id = ?').get(301);
    assert.equal(storyRow.title, 'Compilers in TypeScript');
    assert.equal(storyRow.score, 180);
    assert.equal(storyRow.about_ai, 0);
    assert.equal(storyRow.full_content, 1);
    assert.equal(storyRow.summary, 'Summary of TS compiler architecture.');
    assert.equal(storyRow.kids, JSON.stringify([302, 303]));

    const contentRow = rawDb.prepare('SELECT * FROM story_contents WHERE story_id = ?').get(301);
    assert.match(contentRow.content, /Detailed content explaining AST/);
    assert.match(contentRow.article_html, /<h1>Compilers in TypeScript<\/h1>/);

    const seenRow = rawDb.prepare('SELECT * FROM seen_urls WHERE url = ?').get('https://example.com/compilers');
    assert.equal(seenRow.status, 'success');
    assert.equal(seenRow.story_id, 301);

    // Verify tag deduplication and story_tags links
    const storyTags = rawDb
      .prepare('SELECT t.name, t.slug FROM story_tags st JOIN tags t ON st.tag_id = t.id WHERE st.story_id = ? ORDER BY t.slug')
      .all(301);
    assert.equal(storyTags.length, 3);
    assert.deepEqual(
      storyTags.map((t: any) => t.slug),
      ['compilers', 'programming', 'typescript']
    );

    // Verify FTS5 search
    const ftsResults = rawDb
      .prepare("SELECT id, title FROM stories_fts WHERE stories_fts MATCH 'bytecode'")
      .all();
    assert.equal(ftsResults.length, 1);
    assert.equal(ftsResults[0].title, 'Compilers in TypeScript');
  });

  test('saveStory() deduplicates tags when multiple stories share tags', () => {
    const rawDb = (db as any).db;
    const distilled = new WebPageContent('Title', 'Content', {});
    const processedText = JSON.stringify({
      summary: 'Summary.',
      tags: ['shared-tag', 'unique1'],
      about_ai: false,
      full_content: true,
    });

    db.saveStory({ id: 401, title: 'Story 1', url: 'https://ex.com/401' }, distilled, processedText);

    const processedText2 = JSON.stringify({
      summary: 'Summary 2.',
      tags: ['SHARED-TAG', 'unique2'],
      about_ai: false,
      full_content: true,
    });

    db.saveStory({ id: 402, title: 'Story 2', url: 'https://ex.com/402' }, distilled, processedText2);

    const allTags = rawDb.prepare('SELECT slug FROM tags ORDER BY slug').all();
    assert.deepEqual(
      allTags.map((t: any) => t.slug),
      ['shared-tag', 'unique1', 'unique2']
    );
  });
});
