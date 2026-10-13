import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Digestor, GenerativeModelLike } from '../digest';
import { WebPageContent } from '../page_content';

describe('digest.ts: Digestor', () => {
  const originalApiKey = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    delete process.env.GOOGLE_API_KEY;
    Digestor.setModel(null);
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_API_KEY = originalApiKey;
    } else {
      delete process.env.GOOGLE_API_KEY;
    }
    Digestor.setModel(null);
  });

  test('processPage returns null when no generative model is configured', async () => {
    const page = new WebPageContent('Title', 'Short article text', {});
    const result = await Digestor.processPage(page);
    assert.equal(result, null);
  });

  test('processPage returns null when content exceeds token limit (>64000 chars)', async () => {
    const mockModel: GenerativeModelLike = {
      generateContent: async () => ({
        response: { text: () => '{"summary": "Never reached"}' },
      }),
    };
    Digestor.setModel(mockModel);

    const hugeContent = 'a'.repeat(64004);
    const page = new WebPageContent('Huge Article', hugeContent, {});
    const result = await Digestor.processPage(page);
    assert.equal(result, null);
  });

  test('processPage executes model with expected prompt structure for valid content', async () => {
    let receivedPrompt = '';
    const mockResponseText = JSON.stringify({
      summary: 'Direct summary.',
      tags: ['technology'],
      about_ai: false,
      full_content: true,
    });

    const mockModel: GenerativeModelLike = {
      generateContent: async (prompt: string) => {
        receivedPrompt = prompt;
        return {
          response: { text: () => mockResponseText },
        };
      },
    };
    Digestor.setModel(mockModel);

    const page = new WebPageContent('Testing Compilers', 'Article about AST parsing.', {});
    const result = await Digestor.processPage(page);

    assert.equal(result, mockResponseText);
    assert.match(receivedPrompt, /Title:\s*Testing Compilers/);
    assert.match(receivedPrompt, /Content:\s*Article about AST parsing\./);
  });

  test('printProcessed logs summary and tags when full_content is 1', () => {
    const logged: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logged.push(args.join(' '));

    try {
      // 1. Valid AI article
      const aiJson = JSON.stringify({
        summary: 'Breakthrough transformer architecture announced.',
        tags: ['ai', 'transformers'],
        about_ai: true,
        full_content: true,
      });
      Digestor.printProcessed(aiJson);

      assert.ok(logged.some((line) => line.includes('Breakthrough transformer')));
      assert.ok(
        logged.some(
          (line) => line.includes('Tags: ai, transformers') && line.includes('| AI')
        )
      );

      // 2. Non-full content should not log summary
      logged.length = 0;
      const partialJson = JSON.stringify({
        summary: 'Paywalled content.',
        tags: ['news'],
        about_ai: false,
        full_content: false,
      });
      Digestor.printProcessed(partialJson);
      assert.equal(logged.length, 0);

      // 3. Null or invalid string should not throw
      Digestor.printProcessed(null);
      Digestor.printProcessed('broken-json');
      assert.equal(logged.length, 0);
    } finally {
      console.log = origLog;
    }
  });
});
