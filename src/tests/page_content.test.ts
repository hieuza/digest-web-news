import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PageFolder, WebPageContent } from '../page_content';

describe('page_content.ts: PageFolder', () => {
  const folder = '/tmp/test-page-folder';
  const pageFolder = new PageFolder(folder);

  test('generates correct file paths', () => {
    assert.equal(pageFolder.get_file('custom.json'), path.join(folder, 'custom.json'));
    assert.equal(pageFolder.story_file(), path.join(folder, 'story.json'));
    assert.equal(pageFolder.content_file(), path.join(folder, 'article.json'));
    assert.equal(pageFolder.distillation_file(), path.join(folder, 'distillation.json'));
    assert.equal(pageFolder.article_html(), path.join(folder, 'article.html'));
    assert.equal(pageFolder.processed_file(), path.join(folder, 'processed.json'));
  });
});

describe('page_content.ts: WebPageContent', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webpage-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('fromDistillationResult parses valid result format', () => {
    const rawResult = {
      '1': 'Sample Headline',
      '2': {
        '1': 'Sample article content body text.',
      },
    };
    const content = WebPageContent.fromDistillationResult(rawResult);
    assert.equal(content.headline, 'Sample Headline');
    assert.equal(content.content, 'Sample article content body text.');
    assert.deepEqual(content.distilled, rawResult);
  });

  test('fromDistillationResult safely handles malformed or null results', () => {
    const emptyResult = WebPageContent.fromDistillationResult(null);
    assert.equal(emptyResult.headline, '');
    assert.equal(emptyResult.content, '');

    const missingContent = WebPageContent.fromDistillationResult({ '1': 'Headline Only' });
    assert.equal(missingContent.headline, 'Headline Only');
    assert.equal(missingContent.content, '');
  });

  test('write creates directory, persists files, and fromFolder loads it back', async () => {
    const targetFolder = path.join(tempDir, 'subfolder-target');
    const rawResult = {
      '1': 'Headline Roundtrip',
      '2': {
        '1': '<p>Paragraph 1</p>',
      },
    };

    const original = new WebPageContent(
      'Headline Roundtrip',
      '<p>Paragraph 1</p>',
      rawResult,
      { summary: 'Summary text', tags: ['news'] }
    );

    await original.write(targetFolder);

    const folder = new PageFolder(targetFolder);
    assert.ok(fs.existsSync(folder.content_file()));
    assert.ok(fs.existsSync(folder.distillation_file()));
    assert.ok(fs.existsSync(folder.article_html()));
    assert.ok(fs.existsSync(folder.processed_file()));

    // Verify article.html content
    const html = fs.readFileSync(folder.article_html(), 'utf8');
    assert.match(html, /<h1>Headline Roundtrip<\/h1>/);
    assert.match(html, /<p>Paragraph 1<\/p>/);

    // Verify roundtrip loading via fromFolder
    const loaded = await WebPageContent.fromFolder(targetFolder);
    assert.equal(loaded.headline, 'Headline Roundtrip');
    assert.equal(loaded.content, '<p>Paragraph 1</p>');
    assert.deepEqual(loaded.distilled, rawResult);
  });
});
