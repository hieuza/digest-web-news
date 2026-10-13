import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Distiller } from '../extractor';

describe('extractor.ts: Distiller', () => {
  test('distilPage navigates, evaluates scripts with arguments, and extracts content', async () => {
    let closed = false;
    let gotoUrl = '';
    const evaluatedScripts: any[] = [];

    const mockPage = {
      goto: async (url: string) => {
        gotoUrl = url;
      },
      evaluate: async (scriptOrFn: any, ...args: any[]) => {
        evaluatedScripts.push({ scriptOrFn, args });
        if (typeof scriptOrFn === 'function') {
          // Mock return from DOM Distiller applyWithOptions
          return {
            '1': 'Mock Extracted Title',
            '2': { '1': '<p>Mock Distilled Body</p>' },
          };
        }
        return undefined;
      },
      close: async () => {
        closed = true;
      },
    };

    const mockBrowser = {
      newPage: async () => mockPage,
      close: async () => {},
    };

    const distiller = Distiller.fromBrowser(mockBrowser, true);
    const content = await distiller.distilPage('https://example.com/article');

    assert.equal(gotoUrl, 'https://example.com/article');
    assert.equal(closed, true);
    assert.equal(content.headline, 'Mock Extracted Title');
    assert.equal(content.content, '<p>Mock Distilled Body</p>');
    assert.equal(evaluatedScripts.length, 2);
    // Verify arguments passed to evaluate function
    assert.deepEqual(evaluatedScripts[1].args, [true, 'https://example.com/article']);
  });

  test('distilPage closes page cleanly even when navigation fails', async () => {
    let closed = false;
    const mockPage = {
      goto: async () => {
        throw new Error('Navigation timeout after 90000ms');
      },
      evaluate: async () => {},
      close: async () => {
        closed = true;
      },
    };

    const mockBrowser = {
      newPage: async () => mockPage,
      close: async () => {},
    };

    const distiller = Distiller.fromBrowser(mockBrowser, false);
    await assert.rejects(
      async () => await distiller.distilPage('https://timeout.com'),
      /Navigation timeout/
    );

    assert.equal(closed, true);
  });

  test('closeBrowser closes browser instance and clears singleton', async () => {
    let browserClosed = false;
    const mockBrowser = {
      close: async () => {
        browserClosed = true;
      },
    };

    const distiller = Distiller.fromBrowser(mockBrowser, false);
    await distiller.closeBrowser();
    assert.equal(browserClosed, true);
  });
});
