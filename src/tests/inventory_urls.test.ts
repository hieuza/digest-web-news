import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readSubfolders, readUrl, inventoryUrls } from '../tools/inventory_urls_main';

describe('tools/inventory_urls_main.ts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('readSubfolders returns only directories', () => {
    const sub1 = path.join(tempDir, 'story_1');
    const sub2 = path.join(tempDir, 'story_2');
    fs.mkdirSync(sub1);
    fs.mkdirSync(sub2);
    fs.writeFileSync(path.join(tempDir, 'ignored_file.txt'), 'content');

    const result = readSubfolders(tempDir);
    assert.equal(result.length, 2);
    assert.ok(result.includes(sub1));
    assert.ok(result.includes(sub2));
  });

  test('readUrl extracts URL from story.json or returns null', () => {
    const folderValid = path.join(tempDir, 'valid');
    fs.mkdirSync(folderValid);
    fs.writeFileSync(
      path.join(folderValid, 'story.json'),
      JSON.stringify({ url: 'https://example.com/test-story' })
    );

    const folderNoFile = path.join(tempDir, 'no_file');
    fs.mkdirSync(folderNoFile);

    const folderCorrupt = path.join(tempDir, 'corrupt');
    fs.mkdirSync(folderCorrupt);
    fs.writeFileSync(path.join(folderCorrupt, 'story.json'), '{ invalid json');

    assert.equal(readUrl(folderValid), 'https://example.com/test-story');
    assert.equal(readUrl(folderNoFile), null);
    assert.equal(readUrl(folderCorrupt), null);
  });

  test('inventoryUrls writes urls to output file and returns list', () => {
    const story1 = path.join(tempDir, 's1');
    const story2 = path.join(tempDir, 's2');
    fs.mkdirSync(story1);
    fs.mkdirSync(story2);

    fs.writeFileSync(path.join(story1, 'story.json'), JSON.stringify({ url: 'https://a.com' }));
    fs.writeFileSync(path.join(story2, 'story.json'), JSON.stringify({ url: 'https://b.com' }));

    const outputFile = path.join(tempDir, 'urls.txt');
    const urls = inventoryUrls(tempDir, outputFile);

    assert.equal(urls.length, 2);
    assert.ok(fs.existsSync(outputFile));

    const written = fs.readFileSync(outputFile, 'utf8').trim().split('\n');
    assert.deepEqual(written.sort(), ['https://a.com', 'https://b.com']);
  });
});
