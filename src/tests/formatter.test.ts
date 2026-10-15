import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  extractDomain,
  formatDigestDate,
  renderHtmlDigest,
  renderTextDigest,
  DigestItem,
} from '../formatter';

describe('formatter.ts: escapeHtml', () => {
  test('escapes HTML special characters correctly', () => {
    assert.equal(
      escapeHtml('<b>"Tom & Jerry\'s"</b>'),
      '&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;'
    );
  });

  test('returns empty string for null or undefined input', () => {
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null as any), '');
  });
});

describe('formatter.ts: extractDomain', () => {
  test('extracts hostname and strips leading www.', () => {
    assert.equal(extractDomain('https://www.example.com/path?foo=bar'), 'example.com');
    assert.equal(extractDomain('https://github.com/hieuza/repo'), 'github.com');
    assert.equal(extractDomain('http://sub.domain.org/index.html'), 'sub.domain.org');
  });

  test('returns empty string for invalid URLs', () => {
    assert.equal(extractDomain('not a url'), '');
    assert.equal(extractDomain(''), '');
  });
});

describe('formatter.ts: renderHtmlDigest', () => {
  const sampleItems: DigestItem[] = [
    {
      id: 12345,
      title: 'Show HN: <New Framework> & Tool',
      url: 'https://example.com/framework',
      storyUrl: 'https://news.ycombinator.com/item?id=12345',
      score: 342,
      by: 'johndoe',
      descendants: 85,
      summary: 'A direct summary explaining how the new framework optimizes performance.',
      tags: ['ai', 'typescript', 'tools'],
      about_ai: true,
    },
    {
      id: 67890,
      title: 'PostgreSQL 17 Released',
      url: 'https://postgresql.org/about/news/pg17',
      storyUrl: 'https://news.ycombinator.com/item?id=67890',
      score: 198,
      by: 'dbexpert',
      descendants: 42,
      summary: 'PostgreSQL 17 introduces improved memory management and query performance.',
      tags: ['database', 'postgres'],
      about_ai: false,
    },
  ];

  test('renders full modern HTML document with DOCTYPE and styling', () => {
    const fixedDate = new Date('2026-10-15T08:00:00Z');
    const html = renderHtmlDigest(sampleItems, fixedDate);

    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<h1 style='));
    assert.ok(html.includes('Hacker News Digest'));
    assert.ok(html.includes('2 top stories curated with executive AI summaries'));
  });

  test('escapes special characters in title and summary', () => {
    const fixedDate = new Date('2026-10-15T08:00:00Z');
    const html = renderHtmlDigest(sampleItems, fixedDate);

    // Escaped title
    assert.ok(html.includes('&lt;New Framework&gt; &amp; Tool'));
    assert.ok(!html.includes('<New Framework>'));
  });

  test('renders clickable links for both article and HN comments', () => {
    const fixedDate = new Date('2026-10-15T08:00:00Z');
    const html = renderHtmlDigest(sampleItems, fixedDate);

    // Article link
    assert.ok(html.includes('href="https://example.com/framework"'));
    assert.ok(html.includes('href="https://postgresql.org/about/news/pg17"'));

    // HN Discussion link
    assert.ok(html.includes('href="https://news.ycombinator.com/item?id=12345"'));
    assert.ok(html.includes('💬 85 comments'));
    assert.ok(html.includes('href="https://news.ycombinator.com/item?id=67890"'));
    assert.ok(html.includes('💬 42 comments'));
  });

  test('renders scores, author, and domain', () => {
    const fixedDate = new Date('2026-10-15T08:00:00Z');
    const html = renderHtmlDigest(sampleItems, fixedDate);

    assert.ok(html.includes('▲ 342 pts'));
    assert.ok(html.includes('by johndoe'));
    assert.ok(html.includes('(example.com)'));
  });

  test('renders AI badge conditionally', () => {
    const fixedDate = new Date('2026-10-15T08:00:00Z');
    const html = renderHtmlDigest(sampleItems, fixedDate);

    // Story 1 has AI badge
    assert.ok(html.includes('✦ AI'));
    // Tags
    assert.ok(html.includes('#ai'));
    assert.ok(html.includes('#typescript'));
    assert.ok(html.includes('#postgres'));
  });
});

describe('formatter.ts: renderTextDigest', () => {
  test('renders plain-text summary with URLs and discussion links', () => {
    const sampleItems: DigestItem[] = [
      {
        id: 111,
        title: 'Rust 2026 Edition',
        url: 'https://rust-lang.org/edition-2026',
        storyUrl: 'https://news.ycombinator.com/item?id=111',
        score: 512,
        descendants: 210,
        summary: 'Rust announces key milestones.',
        tags: ['rust', 'systems'],
        about_ai: false,
      },
    ];

    const fixedDate = new Date('2026-10-15T08:00:00Z');
    const text = renderTextDigest(sampleItems, fixedDate);

    assert.ok(text.includes('HACKER NEWS DIGEST'));
    assert.ok(text.includes('1. Rust 2026 Edition'));
    assert.ok(text.includes('URL: https://rust-lang.org/edition-2026'));
    assert.ok(text.includes('Discussion (512 pts, 210 comments): https://news.ycombinator.com/item?id=111'));
    assert.ok(text.includes('Rust announces key milestones.'));
    assert.ok(text.includes('Tags: rust, systems'));
  });
});
